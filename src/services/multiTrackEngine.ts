/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MultiTrackProject, ProjectClip, AudioTrack, SelectionRange } from '../types/audio';

export interface VUMeterData {
  leftPeak: number;       // 0 to 1+
  rightPeak: number;      // 0 to 1+
  leftDb: number;         // -60 to +6
  rightDb: number;        // -60 to +6
  isClipping: boolean;    // true if peak > 1.0 (0 dBFS)
}

class MultiTrackEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  // Track Nodes mapping: trackId -> { gainNode, pannerNode }
  private trackGainNodes: Map<string, GainNode> = new Map();
  private trackPanNodes: Map<string, StereoPannerNode> = new Map();

  // Active playing buffer source nodes
  private activeSources: AudioBufferSourceNode[] = [];

  private isPlaying: boolean = false;
  private startTime: number = 0;       // AudioContext.currentTime when started
  private pauseOffset: number = 0;     // Playhead position in seconds
  private loopSelection: boolean = false;
  private selectionRange: SelectionRange | null = null;
  private soloClipId: string | null = null;
  private activeProject: MultiTrackProject | null = null;

  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private onPlaybackEndCallbacks: Set<() => void> = new Set();
  private onMeterCallbacks: Set<(meter: VUMeterData) => void> = new Set();
  private animFrameId: number | null = null;

  // Clipping indicator retention timer
  private clipHoldTimer: number | null = null;
  private isClippingLatched: boolean = false;

  public getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getMasterGain(): GainNode {
    const ctx = this.getAudioContext();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.getMasterAnalyser());
      this.getMasterAnalyser().connect(ctx.destination);
    }
    return this.masterGain;
  }

  public getMasterAnalyser(): AnalyserNode {
    const ctx = this.getAudioContext();
    if (!this.masterAnalyser) {
      this.masterAnalyser = ctx.createAnalyser();
      this.masterAnalyser.fftSize = 512;
      this.masterAnalyser.smoothingTimeConstant = 0.7;
    }
    return this.masterAnalyser;
  }

  /**
   * Sets up or updates the Web Audio graph nodes for each track.
   */
  public setupTrackNodes(tracks: AudioTrack[]): void {
    const ctx = this.getAudioContext();
    const master = this.getMasterGain();

    const currentTrackIds = new Set(tracks.map((t) => t.id));

    // Cleanup nodes of deleted tracks
    for (const [id, gain] of this.trackGainNodes.entries()) {
      if (!currentTrackIds.has(id)) {
        try {
          gain.disconnect();
          this.trackPanNodes.get(id)?.disconnect();
        } catch {
          // ignore
        }
        this.trackGainNodes.delete(id);
        this.trackPanNodes.delete(id);
      }
    }

    // Determine if any track is soloed
    const hasSolo = tracks.some((t) => t.solo);

    // Create / update nodes for each track
    for (const track of tracks) {
      let gain = this.trackGainNodes.get(track.id);
      let panner = this.trackPanNodes.get(track.id);

      if (!gain || !panner) {
        gain = ctx.createGain();
        panner = ctx.createStereoPanner();
        gain.connect(panner);
        panner.connect(master);
        this.trackGainNodes.set(track.id, gain);
        this.trackPanNodes.set(track.id, panner);
      }

      // Compute track gain based on mute, solo, and volumeDb
      let targetGain = 0;
      if (!track.mute && (!hasSolo || track.solo)) {
        targetGain = Math.pow(10, track.volumeDb / 20);
      }
      gain.gain.setValueAtTime(targetGain, ctx.currentTime);

      // Pan: -100 to +100 -> -1.0 to +1.0
      const panValue = Math.max(-1, Math.min(1, track.pan / 100));
      panner.pan.setValueAtTime(panValue, ctx.currentTime);
    }
  }

  /**
   * Plays the multi-track project starting from offset seconds.
   */
  public play(
    project: MultiTrackProject,
    offset: number = 0,
    loop: boolean = false,
    selection?: SelectionRange | null,
    soloClipId?: string | null
  ): void {
    const ctx = this.getAudioContext();
    this.stopPlaybackOnly();

    this.activeProject = project;
    this.loopSelection = loop;
    this.selectionRange = selection || null;
    this.soloClipId = soloClipId || null;

    this.setupTrackNodes(project.tracks);

    let startOffset = Math.max(0, offset);
    if (loop && selection && selection.end > selection.start) {
      if (startOffset < selection.start || startOffset >= selection.end) {
        startOffset = selection.start;
      }
    }

    this.startTime = ctx.currentTime - startOffset;
    this.pauseOffset = startOffset;
    this.isPlaying = true;

    // Filter clips to play
    let clipsToPlay = project.clips;
    if (this.soloClipId) {
      clipsToPlay = project.clips.filter((c) => c.id === this.soloClipId);
    }

    const tracksMap = new Map(project.tracks.map((t) => [t.id, t]));
    const hasSolo = project.tracks.some((t) => t.solo);

    this.activeSources = [];

    for (const clip of clipsToPlay) {
      const track = tracksMap.get(clip.trackId);
      // Skip muted or locked inactive tracks
      if (track && (track.mute || (hasSolo && !track.solo))) {
        continue;
      }

      const clipDuration = clip.sourceEnd - clip.sourceStart;
      if (clipDuration <= 0) continue;

      const clipTimelineEnd = clip.startTime + clipDuration;

      // If clip ends before current playhead, skip
      if (clipTimelineEnd <= startOffset) continue;

      const trackGain = this.trackGainNodes.get(clip.trackId);
      if (!trackGain) continue;

      const source = ctx.createBufferSource();
      source.buffer = clip.sourceBuffer;

      // Connect to track GainNode
      source.connect(trackGain);

      if (clip.startTime <= startOffset) {
        // Clip is already underway: play remaining part immediately
        const offsetIntoClip = startOffset - clip.startTime;
        const sourceOffset = clip.sourceStart + offsetIntoClip;
        const remainingDuration = clip.sourceEnd - sourceOffset;

        source.start(ctx.currentTime, sourceOffset, remainingDuration);
      } else {
        // Clip begins in the future
        const delayUntilStart = clip.startTime - startOffset;
        source.start(ctx.currentTime + delayUntilStart, clip.sourceStart, clipDuration);
      }

      this.activeSources.push(source);
    }

    this.startTracking();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    const ctx = this.getAudioContext();
    this.pauseOffset = ctx.currentTime - this.startTime;
    this.stopPlaybackOnly();
  }

  public stop(): void {
    this.pauseOffset = 0;
    this.stopPlaybackOnly();
  }

  private stopPlaybackOnly(): void {
    this.isPlaying = false;
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore if already finished
      }
    }
    this.activeSources = [];

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onPlaybackEndCallbacks.forEach((cb) => cb());
  }

  public seek(project: MultiTrackProject, targetTime: number): void {
    const wasPlaying = this.isPlaying;
    this.pauseOffset = Math.max(0, targetTime);
    if (wasPlaying) {
      this.play(project, this.pauseOffset, this.loopSelection, this.selectionRange, this.soloClipId);
    } else {
      this.onTimeUpdateCallbacks.forEach((cb) => cb(this.pauseOffset));
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseOffset;
    const ctx = this.getAudioContext();
    let time = ctx.currentTime - this.startTime;

    // Handle loop selection wrap-around
    if (
      this.loopSelection &&
      this.selectionRange &&
      this.selectionRange.end > this.selectionRange.start
    ) {
      const dur = this.selectionRange.end - this.selectionRange.start;
      if (time >= this.selectionRange.end) {
        const excess = (time - this.selectionRange.start) % dur;
        time = this.selectionRange.start + excess;
        // Re-trigger loop playback at start of selection
        if (this.activeProject) {
          this.play(
            this.activeProject,
            time,
            this.loopSelection,
            this.selectionRange,
            this.soloClipId
          );
        }
      }
    }

    return Math.max(0, time);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setMasterGainValue(val: number): void {
    const master = this.getMasterGain();
    master.gain.setValueAtTime(Math.max(0, Math.min(2, val)), this.getAudioContext().currentTime);
  }

  public onTimeUpdate(cb: (time: number) => void): () => void {
    this.onTimeUpdateCallbacks.add(cb);
    return () => this.onTimeUpdateCallbacks.delete(cb);
  }

  public onPlaybackEnd(cb: () => void): () => void {
    this.onPlaybackEndCallbacks.add(cb);
    return () => this.onPlaybackEndCallbacks.delete(cb);
  }

  public onMeterUpdate(cb: (meter: VUMeterData) => void): () => void {
    this.onMeterCallbacks.add(cb);
    return () => this.onMeterCallbacks.delete(cb);
  }

  private startTracking(): void {
    const analyser = this.getMasterAnalyser();
    const timeDomainData = new Float32Array(analyser.fftSize);

    const loop = () => {
      if (this.isPlaying) {
        const currentTime = this.getCurrentTime();
        this.onTimeUpdateCallbacks.forEach((cb) => cb(currentTime));

        // Read Analyser peak levels for master VU meter
        analyser.getFloatTimeDomainData(timeDomainData);
        let peak = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const abs = Math.abs(timeDomainData[i]);
          if (abs > peak) peak = abs;
        }

        const db = peak > 0.0001 ? 20 * Math.log10(peak) : -60;
        const isClippingNow = peak >= 0.999;

        if (isClippingNow) {
          this.isClippingLatched = true;
          if (this.clipHoldTimer) window.clearTimeout(this.clipHoldTimer);
          this.clipHoldTimer = window.setTimeout(() => {
            this.isClippingLatched = false;
          }, 1500);
        }

        const meter: VUMeterData = {
          leftPeak: peak,
          rightPeak: peak * 0.96, // Slight decorrelation for visual stereo
          leftDb: Math.max(-60, Math.min(6, db)),
          rightDb: Math.max(-60, Math.min(6, db - 0.2)),
          isClipping: this.isClippingLatched,
        };

        this.onMeterCallbacks.forEach((cb) => cb(meter));

        this.animFrameId = requestAnimationFrame(loop);
      }
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Calculates overall duration of project (furthest clip end)
   */
  public getProjectDuration(project: MultiTrackProject): number {
    let maxEnd = 0;
    for (const clip of project.clips) {
      const end = clip.startTime + (clip.sourceEnd - clip.sourceStart);
      if (end > maxEnd) maxEnd = end;
    }
    return Math.max(0.5, maxEnd);
  }

  // =========================================================================
  // OFFLINE RENDERING FOR MIXDOWN, STEMS, MERGE & NORMALIZATION
  // =========================================================================

  /**
   * Renders the entire multi-track project into a stereo AudioBuffer
   * with complete fidelity to track volumes, pan, mute, solo, and clip fades.
   */
  public async renderProjectOffline(
    project: MultiTrackProject,
    options: {
      range?: SelectionRange;
      soloTrackId?: string;
      onProgress?: (percent: number) => void;
    } = {}
  ): Promise<AudioBuffer> {
    const totalDuration = options.range
      ? options.range.end - options.range.start
      : this.getProjectDuration(project);

    const safeDuration = Math.max(0.1, totalDuration);
    const sampleRate = 44100;
    const totalSamples = Math.ceil(safeDuration * sampleRate);

    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(offlineCtx.destination);

    const tracksMap = new Map(project.tracks.map((t) => [t.id, t]));
    const hasSolo = project.tracks.some((t) => t.solo);

    // Create per-track nodes in offline context
    const trackGains = new Map<string, GainNode>();
    for (const track of project.tracks) {
      if (options.soloTrackId && track.id !== options.soloTrackId) {
        continue;
      }
      if (track.mute || (hasSolo && !track.solo)) {
        continue;
      }

      const tGain = offlineCtx.createGain();
      const tPan = offlineCtx.createStereoPanner();

      const gainVal = Math.pow(10, track.volumeDb / 20);
      tGain.gain.value = gainVal;

      const panVal = Math.max(-1, Math.min(1, track.pan / 100));
      tPan.pan.value = panVal;

      tGain.connect(tPan);
      tPan.connect(masterGain);
      trackGains.set(track.id, tGain);
    }

    const rangeStart = options.range ? options.range.start : 0;
    const rangeEnd = options.range ? options.range.end : this.getProjectDuration(project);

    // Schedule clips
    for (const clip of project.clips) {
      const track = tracksMap.get(clip.trackId);
      if (!track || !trackGains.has(clip.trackId)) continue;

      const clipDur = clip.sourceEnd - clip.sourceStart;
      const clipStart = clip.startTime;
      const clipEnd = clipStart + clipDur;

      // Check if clip falls outside requested range
      if (clipEnd <= rangeStart || clipStart >= rangeEnd) continue;

      const schedStartOnOffline = Math.max(0, clipStart - rangeStart);
      const offsetIntoSource =
        clip.sourceStart + (clipStart < rangeStart ? rangeStart - clipStart : 0);
      const playDuration = Math.min(
        clip.sourceEnd - offsetIntoSource,
        rangeEnd - Math.max(clipStart, rangeStart)
      );

      if (playDuration <= 0) continue;

      const src = offlineCtx.createBufferSource();
      src.buffer = clip.sourceBuffer;

      // Handle fades if applicable
      const clipGain = offlineCtx.createGain();
      src.connect(clipGain);
      clipGain.connect(trackGains.get(clip.trackId)!);

      if (clip.fadeIn && clip.fadeIn > 0) {
        clipGain.gain.setValueAtTime(0, schedStartOnOffline);
        clipGain.gain.linearRampToValueAtTime(1, schedStartOnOffline + clip.fadeIn);
      }
      if (clip.fadeOut && clip.fadeOut > 0) {
        const fadeOutStart = schedStartOnOffline + playDuration - clip.fadeOut;
        clipGain.gain.setValueAtTime(1, Math.max(schedStartOnOffline, fadeOutStart));
        clipGain.gain.linearRampToValueAtTime(0, schedStartOnOffline + playDuration);
      }

      src.start(schedStartOnOffline, offsetIntoSource, playDuration);
    }

    return await offlineCtx.startRendering();
  }

  /**
   * Bounces / merges selected clips (across any track) into a single unified AudioBuffer.
   */
  public async mergeClipsToBuffer(clips: ProjectClip[]): Promise<AudioBuffer> {
    if (clips.length === 0) {
      const dummyCtx = this.getAudioContext();
      return dummyCtx.createBuffer(2, 44100, 44100);
    }

    const minStartTime = Math.min(...clips.map((c) => c.startTime));
    const maxEndTime = Math.max(
      ...clips.map((c) => c.startTime + (c.sourceEnd - c.sourceStart))
    );
    const duration = Math.max(0.1, maxEndTime - minStartTime);

    const sampleRate = 44100;
    const totalSamples = Math.ceil(duration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

    for (const clip of clips) {
      const clipDur = clip.sourceEnd - clip.sourceStart;
      if (clipDur <= 0) continue;

      const src = offlineCtx.createBufferSource();
      src.buffer = clip.sourceBuffer;

      const schedTime = clip.startTime - minStartTime;
      src.connect(offlineCtx.destination);
      src.start(schedTime, clip.sourceStart, clipDur);
    }

    return await offlineCtx.startRendering();
  }

  /**
   * Master normalization: calculates project peak across active clips and returns suggested dB boost/cut.
   */
  public async calculateMasterNormalizationGain(project: MultiTrackProject): Promise<number> {
    const rendered = await this.renderProjectOffline(project);
    let maxPeak = 0;
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      const data = rendered.getChannelData(ch);
      for (let i = 0; i < data.length; i += 20) {
        const val = Math.abs(data[i]);
        if (val > maxPeak) maxPeak = val;
      }
    }

    if (maxPeak <= 0.0001) return 0;
    const targetPeak = 0.988; // -0.1 dB
    const ratio = targetPeak / maxPeak;
    const adjustDb = 20 * Math.log10(ratio);
    return adjustDb;
  }
}

export const multiTrackEngine = new MultiTrackEngine();
