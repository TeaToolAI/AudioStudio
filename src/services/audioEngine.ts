/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SelectionRange } from '../types/audio';

export interface WaveformData {
  peaks: Float32Array; // Interleaved [min, max, min, max, ...]
  length: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private isPlaying: boolean = false;
  private startTime: number = 0;       // AudioContext.currentTime when started
  private pauseOffset: number = 0;     // Track position in seconds
  private loopSelection: boolean = false;
  private selectionRange: SelectionRange | null = null;
  private activeBuffer: AudioBuffer | null = null;

  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private onPlaybackEndCallbacks: Set<() => void> = new Set();
  private animFrameId: number | null = null;

  public getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode {
    const ctx = this.getAudioContext();
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
    }
    return this.analyser;
  }

  public getGainNode(): GainNode {
    const ctx = this.getAudioContext();
    if (!this.gainNode) {
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = 1.0;
      this.gainNode.connect(this.getAnalyser());
      this.getAnalyser().connect(ctx.destination);
    }
    return this.gainNode;
  }

  public async decodeAudioFile(file: File): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Downsamples AudioBuffer into min/max peak pairs for ultra-fast canvas rendering
   */
  public extractPeaks(buffer: AudioBuffer, numBuckets: number = 2000): Float32Array {
    const length = buffer.length;
    const channels = buffer.numberOfChannels;
    const bucketSize = Math.max(1, Math.floor(length / numBuckets));
    const peaks = new Float32Array(numBuckets * 2);

    // Sum or average across channels
    const chData0 = buffer.getChannelData(0);
    const chData1 = channels > 1 ? buffer.getChannelData(1) : chData0;

    for (let b = 0; b < numBuckets; b++) {
      const start = b * bucketSize;
      const end = Math.min(length, start + bucketSize);
      let min = 1.0;
      let max = -1.0;

      // Sample stride inside bucket for performance
      const stride = Math.max(1, Math.floor((end - start) / 50));
      for (let i = start; i < end; i += stride) {
        const val = (chData0[i] + chData1[i]) * 0.5;
        if (val < min) min = val;
        if (val > max) max = val;
      }

      if (min > max) {
        min = 0;
        max = 0;
      }

      peaks[b * 2] = min;
      peaks[b * 2 + 1] = max;
    }

    return peaks;
  }

  /**
   * Extract separate left and right channel peaks for Stereo Split template
   */
  public extractChannelPeaks(
    buffer: AudioBuffer,
    channel: number,
    numBuckets: number = 2000
  ): Float32Array {
    const chIdx = Math.min(channel, buffer.numberOfChannels - 1);
    const chData = buffer.getChannelData(chIdx);
    const length = buffer.length;
    const bucketSize = Math.max(1, Math.floor(length / numBuckets));
    const peaks = new Float32Array(numBuckets * 2);

    for (let b = 0; b < numBuckets; b++) {
      const start = b * bucketSize;
      const end = Math.min(length, start + bucketSize);
      let min = 1.0;
      let max = -1.0;

      const stride = Math.max(1, Math.floor((end - start) / 50));
      for (let i = start; i < end; i += stride) {
        const val = chData[i];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      if (min > max) {
        min = 0;
        max = 0;
      }

      peaks[b * 2] = min;
      peaks[b * 2 + 1] = max;
    }

    return peaks;
  }

  /**
   * Play audio buffer from a given offset
   */
  public play(
    buffer: AudioBuffer,
    offset: number = 0,
    loop: boolean = false,
    selection?: SelectionRange | null
  ): void {
    const ctx = this.getAudioContext();
    this.stop(); // Stop any current playback

    this.activeBuffer = buffer;
    this.loopSelection = loop;
    this.selectionRange = selection || null;

    let startOffset = Math.max(0, Math.min(buffer.duration, offset));
    // If looping selection and offset is outside selection, start at selection.start
    if (loop && selection) {
      if (startOffset < selection.start || startOffset >= selection.end) {
        startOffset = selection.start;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.getGainNode());

    if (loop && selection && selection.end > selection.start) {
      source.loop = true;
      source.loopStart = selection.start;
      source.loopEnd = selection.end;
    }

    this.currentSource = source;
    this.startTime = ctx.currentTime - startOffset;
    this.pauseOffset = startOffset;
    this.isPlaying = true;

    source.start(0, startOffset);

    source.onended = () => {
      // If stopped manually or loop is active, don't trigger end callback
      if (this.currentSource === source) {
        this.isPlaying = false;
        this.currentSource = null;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        this.onPlaybackEndCallbacks.forEach(cb => cb());
      }
    };

    this.startPlaybackTracking();
  }

  public pause(): void {
    if (!this.isPlaying || !this.currentSource) return;
    const ctx = this.getAudioContext();
    this.pauseOffset = ctx.currentTime - this.startTime;
    this.stopPlayback();
  }

  public stop(): void {
    this.pauseOffset = 0;
    this.stopPlayback();
  }

  private stopPlayback(): void {
    this.isPlaying = false;
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Ignored if already stopped
      }
      this.currentSource = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onPlaybackEndCallbacks.forEach(cb => cb());
  }

  public seek(buffer: AudioBuffer, targetTime: number): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.play(buffer, targetTime, this.loopSelection, this.selectionRange);
    } else {
      this.pauseOffset = Math.max(0, Math.min(buffer.duration, targetTime));
      this.onTimeUpdateCallbacks.forEach(cb => cb(this.pauseOffset));
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseOffset;
    const ctx = this.getAudioContext();
    let time = ctx.currentTime - this.startTime;

    // Handle selection loop wrap-around
    if (this.loopSelection && this.selectionRange && this.selectionRange.end > this.selectionRange.start) {
      const dur = this.selectionRange.end - this.selectionRange.start;
      if (time >= this.selectionRange.end) {
        const excess = (time - this.selectionRange.start) % dur;
        time = this.selectionRange.start + excess;
      }
    } else if (this.activeBuffer && time >= this.activeBuffer.duration) {
      time = this.activeBuffer.duration;
    }

    return Math.max(0, time);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public onTimeUpdate(cb: (time: number) => void): () => void {
    this.onTimeUpdateCallbacks.add(cb);
    return () => this.onTimeUpdateCallbacks.delete(cb);
  }

  public onPlaybackEnd(cb: () => void): () => void {
    this.onPlaybackEndCallbacks.add(cb);
    return () => this.onPlaybackEndCallbacks.delete(cb);
  }

  private startPlaybackTracking(): void {
    const loop = () => {
      if (this.isPlaying) {
        const currentTime = this.getCurrentTime();
        this.onTimeUpdateCallbacks.forEach(cb => cb(currentTime));
        this.animFrameId = requestAnimationFrame(loop);
      }
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Record from microphone and return decoded AudioBuffer
   */
  public async recordMicrophone(
    onProgress?: (seconds: number) => void
  ): Promise<{ stop: () => Promise<AudioBuffer> }> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    const startTime = Date.now();
    let timer: number | null = null;

    if (onProgress) {
      timer = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        onProgress(elapsed);
      }, 100);
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(100);

    return {
      stop: async (): Promise<AudioBuffer> => {
        if (timer) clearInterval(timer);
        return new Promise((resolve, reject) => {
          mediaRecorder.onstop = async () => {
            // Stop media stream tracks
            stream.getTracks().forEach(track => track.stop());

            try {
              const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
              const arrayBuffer = await audioBlob.arrayBuffer();
              const ctx = this.getAudioContext();
              const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
              resolve(decodedBuffer);
            } catch (err) {
              reject(err);
            }
          };
          mediaRecorder.stop();
        });
      }
    };
  }

  /**
   * Generates a pleasant high-quality demo audio buffer (synth melody + acoustic chord progression + drum pulse)
   * allows instant testing without having to search for an mp3 file
   */
  public createDemoTrack(): AudioBuffer {
    const ctx = this.getAudioContext();
    const duration = 12.0; // 12 seconds loopable
    const sampleRate = ctx.sampleRate;
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Chords progression: C maj7 -> Am7 -> F maj7 -> G7
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23], // G7
    ];

    const chordDuration = 3.0; // seconds per chord

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const chordIndex = Math.min(3, Math.floor(t / chordDuration));
      const chordNotes = chords[chordIndex];
      const timeInChord = t % chordDuration;

      // Warm Pad / Pluck synthesis
      let sampleL = 0;
      let sampleR = 0;

      chordNotes.forEach((freq, noteIdx) => {
        // Slight arpeggio & panning
        const noteEnv = Math.exp(-(timeInChord % 0.75) * 3);
        const padEnv = 0.5 + 0.5 * Math.sin((timeInChord / chordDuration) * Math.PI);
        const totalEnv = noteEnv * 0.4 + padEnv * 0.3;

        const osc = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t);
        const pan = (noteIdx / 3) * 0.6 - 0.3; // -0.3 to +0.3

        sampleL += osc * totalEnv * (0.5 - pan);
        sampleR += osc * totalEnv * (0.5 + pan);
      });

      // Bass note
      const bassFreq = chordNotes[0] / 2;
      const bassEnv = Math.exp(-(timeInChord % 1.5) * 2);
      const bassOsc = Math.sin(2 * Math.PI * bassFreq * t);
      sampleL += bassOsc * bassEnv * 0.35;
      sampleR += bassOsc * bassEnv * 0.35;

      // Soft beat percussion
      const beatTime = t % 0.75;
      if (beatTime < 0.15) {
        // Kick
        const kickEnv = Math.exp(-beatTime * 30);
        const kickPitch = 120 * Math.exp(-beatTime * 40) + 45;
        const kick = Math.sin(2 * Math.PI * kickPitch * beatTime) * kickEnv * 0.4;
        sampleL += kick;
        sampleR += kick;
      } else if (beatTime > 0.37 && beatTime < 0.5) {
        // Snare / Rim noise
        const snareTime = beatTime - 0.375;
        const snareEnv = Math.exp(-snareTime * 25);
        const noise = (Math.random() * 2 - 1) * snareEnv * 0.2;
        sampleL += noise;
        sampleR += noise;
      }

      left[i] = Math.max(-0.95, Math.min(0.95, sampleL * 0.28));
      right[i] = Math.max(-0.95, Math.min(0.95, sampleR * 0.28));
    }

    return buffer;
  }
}

export const audioEngine = new AudioEngine();
