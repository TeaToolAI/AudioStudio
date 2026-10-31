/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EQBand, EffectSettings } from '../types/audio';

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
  default: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoost: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  trebleBoost: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  vocalClarity: [-2, -2, -1, 1, 3, 4, 3, 2, 1, 0],
  vocal: [-1, 0, 1, 2, 4, 4, 3, 2, 1, 0],
  rock: [4, 3, 2, 0, -1, 0, 2, 4, 4, 5],
  pop: [-1, 1, 3, 3, 2, -1, 1, 2, 3, 3],
  noiseReduction: [-4, -3, 0, 0, 0, 0, -1, -3, -6, -9],
};

export const DEFAULT_EFFECT_SETTINGS: EffectSettings = {
  gainDb: 0,
  lowPassCutoff: 20000,
  highPassCutoff: 20,
  noiseReductionAmount: 0,
  noiseGateThreshold: -42,
  delayEnabled: false,
  delayTime: 0.3,
  delayFeedback: 0.35,
  delayMix: 0.35,
  reverbEnabled: false,
  reverbDecay: 2.0, // seconds
  reverbMix: 30,    // % (0 - 100)
  voicePreset: 'none',
  distortionEnabled: false,
  distortionDrive: 35,
  distortionTone: 50,
  distortionLevel: 75,
  chorusEnabled: false,
  chorusRate: 1.5,
  chorusDepth: 60,
  chorusMix: 50,
  compressorEnabled: false,
  compressorThreshold: -24, // -60 to 0 dB
  compressorRatio: 4,       // 1 to 20 (:1)
  compressorAttack: 0.025,  // 25ms (0.001 to 0.5s)
  compressorRelease: 0.25,  // 250ms (0.01 to 1.0s)
  compressorKnee: 30,       // 0 to 40 dB
};

/**
 * Generate soft-clipping non-linear distortion transfer curve for WaveShaperNode
 * @param drive 0 to 100
 */
export function createDistortionCurve(drive: number = 35, n_samples: number = 44100): Float32Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(n_samples * 4);
  const curve = new Float32Array(buffer);
  const k = Math.max(0, Math.min(100, drive));
  // Gain factor from 1.0 (warm soft saturation) to 25.0 (fuzz overdrive)
  const gain = 1 + (k / 100) * 20;

  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1;
    // Hyperbolic tangent soft saturation with asymmetric vacuum-tube character
    const saturated = Math.tanh(x * gain + 0.08 * x * x);
    curve[i] = saturated;
  }
  return curve;
}

/**
 * Generate synthetic stereo reverb impulse response buffer with RT60 decay and air damping
 */
export function createReverbImpulse(
  ctx: BaseAudioContext,
  decayTime: number = 2.0,
  tailDuration?: number
): AudioBuffer {
  const duration = tailDuration ? Math.max(0.5, tailDuration) : Math.max(0.5, decayTime);
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * Math.max(0.2, duration));
  const impulse = ctx.createBuffer(2, length, sampleRate);

  // Standard RT60 decay constant: amplitude drops by 60 dB (0.001 linear factor) over decayTime
  const decayRate = 6.908 / Math.max(0.2, decayTime);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    // Slight channel decorrelation for stereo widening
    const chFactor = ch === 0 ? 1.0 : -0.92;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Exponential decay envelope adhering to RT60
      const env = Math.exp(-decayRate * t);
      // High-frequency air absorption damping over time
      const airDamp = Math.exp(-1.1 * (t / Math.max(0.5, decayTime)));
      // White noise with random reflections
      const noise = (Math.random() * 2 - 1) * 0.7 + (Math.random() * 2 - 1) * 0.3 * chFactor;
      channelData[i] = noise * env * airDamp;
    }
  }

  return impulse;
}

/**
 * Noise Gate & Hiss Reduction algorithm applied directly to PCM samples
 */
export function applyNoiseReductionAlgorithm(
  inputBuffer: AudioBuffer,
  ctx: BaseAudioContext,
  reductionAmount: number, // 0 to 100
  gateThresholdDb: number   // e.g. -45 dB
): AudioBuffer {
  if (reductionAmount <= 0) return inputBuffer;

  const numChannels = inputBuffer.numberOfChannels;
  const length = inputBuffer.length;
  const outputBuffer = ctx.createBuffer(numChannels, length, inputBuffer.sampleRate);
  
  // Convert threshold from dB to linear amplitude
  const thresholdLinear = Math.pow(10, gateThresholdDb / 20);
  const reductionRatio = (reductionAmount / 100) * 0.85; // Max 85% attenuation to keep natural sound

  // Smoothing envelope parameters
  const attackCoeff = 0.95;
  const releaseCoeff = 0.998;

  for (let ch = 0; ch < numChannels; ch++) {
    const input = inputBuffer.getChannelData(ch);
    const output = outputBuffer.getChannelData(ch);
    let envelope = 0;

    for (let i = 0; i < length; i++) {
      const absSample = Math.abs(input[i]);

      // Envelope follower
      if (absSample > envelope) {
        envelope = attackCoeff * envelope + (1 - attackCoeff) * absSample;
      } else {
        envelope = releaseCoeff * envelope + (1 - releaseCoeff) * absSample;
      }

      // Gain reduction if signal is below threshold
      let gain = 1.0;
      if (envelope < thresholdLinear) {
        const factor = Math.max(0, envelope / thresholdLinear);
        // Soft knee attenuation
        gain = 1.0 - reductionRatio * (1.0 - factor * factor);
      }

      output[i] = input[i] * gain;
    }
  }

  return outputBuffer;
}

/**
 * Apply Voice Changer effect (Robot, Radio, Telephone, etc.)
 */
export function applyVoicePreset(
  offlineCtx: OfflineAudioContext,
  sourceNode: AudioNode,
  preset: EffectSettings['voicePreset'],
  destNode: AudioNode
): void {
  if (preset === 'none') {
    sourceNode.connect(destNode);
    return;
  }

  if (preset === 'radio' || preset === 'telephone') {
    // Bandpass telephone effect
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = preset === 'telephone' ? 400 : 350;
    hp.Q.value = 1.5;

    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = preset === 'telephone' ? 3200 : 3800;
    lp.Q.value = 1.5;

    // Subtle distortion wave shaper
    const shaper = offlineCtx.createWaveShaper();
    const curve = new Float32Array(new ArrayBuffer(256 * 4));
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      // Soft saturation
      curve[i] = Math.tanh(x * 1.8);
    }
    shaper.curve = curve;

    sourceNode.connect(hp);
    hp.connect(lp);
    lp.connect(shaper);
    shaper.connect(destNode);
    return;
  }

  if (preset === 'robot') {
    // Ring modulator simulation via Biquad notch + comb resonance
    const peak1 = offlineCtx.createBiquadFilter();
    peak1.type = 'peaking';
    peak1.frequency.value = 120;
    peak1.gain.value = 15;
    peak1.Q.value = 8;

    const peak2 = offlineCtx.createBiquadFilter();
    peak2.type = 'peaking';
    peak2.frequency.value = 440;
    peak2.gain.value = 12;
    peak2.Q.value = 6;

    const peak3 = offlineCtx.createBiquadFilter();
    peak3.type = 'peaking';
    peak3.frequency.value = 880;
    peak3.gain.value = 10;
    peak3.Q.value = 6;

    sourceNode.connect(peak1);
    peak1.connect(peak2);
    peak2.connect(peak3);
    peak3.connect(destNode);
    return;
  }

  if (preset === 'deep') {
    // Heavy bass emphasis & low pass
    const lowShelf = offlineCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 200;
    lowShelf.gain.value = 9;

    const highShelf = offlineCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 3000;
    highShelf.gain.value = -6;

    sourceNode.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(destNode);
    return;
  }

  if (preset === 'chipmunk') {
    // Treble boost & bass cut
    const highPass = offlineCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 500;

    const highShelf = offlineCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 4000;
    highShelf.gain.value = 8;

    sourceNode.connect(highPass);
    highPass.connect(highShelf);
    highShelf.connect(destNode);
    return;
  }

  sourceNode.connect(destNode);
}

/**
 * Render AudioBuffer through full effects chain (EQ, filters, noise reduction, delay, reverb, voice)
 */
export async function renderEffects(
  inputBuffer: AudioBuffer,
  eqBands: EQBand[],
  settings: EffectSettings
): Promise<AudioBuffer> {
  let workingBuffer = inputBuffer;

  // Step 1: Apply Noise Reduction algorithm if requested
  if (settings.noiseReductionAmount > 0) {
    const tempCtx = new AudioContext();
    workingBuffer = applyNoiseReductionAlgorithm(
      workingBuffer,
      tempCtx,
      settings.noiseReductionAmount,
      settings.noiseGateThreshold
    );
    await tempCtx.close();
  }

  // Calculate rendering duration (add tail for reverb / echo / chorus if enabled)
  let extraDuration = 0;
  if (settings.delayEnabled) extraDuration += settings.delayTime * 3;
  if (settings.reverbEnabled) extraDuration += Math.max(0.5, settings.reverbDecay) + 0.5;
  if (settings.chorusEnabled) extraDuration += 0.2;

  const sampleRate = workingBuffer.sampleRate;
  const totalSamples = Math.ceil((workingBuffer.duration + extraDuration) * sampleRate);
  const outputChannels = settings.chorusEnabled
    ? Math.max(2, workingBuffer.numberOfChannels)
    : workingBuffer.numberOfChannels;

  const offlineCtx = new OfflineAudioContext(
    outputChannels,
    Math.max(1, totalSamples),
    sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = workingBuffer;

  // Main gain node (volume dB)
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = Math.pow(10, settings.gainDb / 20);

  // Equalizer nodes chain
  let lastNode: AudioNode = source;

  eqBands.forEach((band, index) => {
    if (Math.abs(band.gain) > 0.05) {
      const filter = offlineCtx.createBiquadFilter();
      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === eqBands.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.4;
      }
      filter.frequency.value = band.freq;
      filter.gain.value = band.gain;
      lastNode.connect(filter);
      lastNode = filter;
    }
  });

  // Low-pass filter (Cutoff < 20000)
  if (settings.lowPassCutoff < 19500) {
    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = settings.lowPassCutoff;
    lp.Q.value = 0.707;
    lastNode.connect(lp);
    lastNode = lp;
  }

  // High-pass filter (Cutoff > 20)
  if (settings.highPassCutoff > 25) {
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = settings.highPassCutoff;
    hp.Q.value = 0.707;
    lastNode.connect(hp);
    lastNode = hp;
  }

  // Connect through Dynamics Compressor if enabled (Threshold, Ratio, Attack, Release)
  if (settings.compressorEnabled) {
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(settings.compressorThreshold, 0);
    compressor.knee.setValueAtTime(settings.compressorKnee ?? 30, 0);
    compressor.ratio.setValueAtTime(settings.compressorRatio, 0);
    compressor.attack.setValueAtTime(settings.compressorAttack, 0);
    compressor.release.setValueAtTime(settings.compressorRelease, 0);

    lastNode.connect(compressor);
    lastNode = compressor;
  }

  // Connect through Voice Preset
  const voiceNode = offlineCtx.createGain();
  applyVoicePreset(offlineCtx, lastNode, settings.voicePreset, voiceNode);
  lastNode = voiceNode;

  // Connect through Distortion / Overdrive if enabled
  if (settings.distortionEnabled) {
    const waveShaper = offlineCtx.createWaveShaper();
    waveShaper.curve = createDistortionCurve(settings.distortionDrive);
    waveShaper.oversample = '4x';

    // Tone filter (Low-pass)
    const toneFilter = offlineCtx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    const toneCutoff = 1200 * Math.pow(13.5, Math.max(0, Math.min(100, settings.distortionTone)) / 100);
    toneFilter.frequency.value = toneCutoff;
    toneFilter.Q.value = 0.707;

    // Level compensation gain
    const levelGain = offlineCtx.createGain();
    levelGain.gain.value = (Math.max(0, Math.min(100, settings.distortionLevel)) / 100) * 1.2;

    lastNode.connect(waveShaper);
    waveShaper.connect(toneFilter);
    toneFilter.connect(levelGain);
    lastNode = levelGain;
  }

  // Connect through Chorus (Stereo Spatial Delay Modulation)
  if (settings.chorusEnabled && settings.chorusMix > 1) {
    const mix = Math.max(0, Math.min(100, settings.chorusMix)) / 100;
    const rate = Math.max(0.1, Math.min(10, settings.chorusRate));
    // Depth in seconds: 0.5ms to 5.5ms
    const depthSec = 0.0005 + (Math.max(0, Math.min(100, settings.chorusDepth)) / 100) * 0.005;
    const baseDelay = 0.022; // 22 ms base delay

    const chorusDry = offlineCtx.createGain();
    chorusDry.gain.value = 1.0;

    const chorusWet = offlineCtx.createGain();
    chorusWet.gain.value = mix * 0.92;

    const chorusMerge = offlineCtx.createGain();

    // Create stereo delay lines for rich spatial chorus
    const delayL = offlineCtx.createDelay(0.1);
    delayL.delayTime.value = baseDelay;

    const delayR = offlineCtx.createDelay(0.1);
    delayR.delayTime.value = baseDelay;

    // LFO oscillator
    const lfo = offlineCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rate;

    // Left channel modulation (sine phase)
    const lfoGainL = offlineCtx.createGain();
    lfoGainL.gain.value = depthSec;
    lfo.connect(lfoGainL);
    lfoGainL.connect(delayL.delayTime);

    // Right channel modulation (inverted phase for wide stereo imaging)
    const lfoGainR = offlineCtx.createGain();
    lfoGainR.gain.value = -depthSec;
    lfo.connect(lfoGainR);
    lfoGainR.connect(delayR.delayTime);

    lfo.start(0);
    lfo.stop(workingBuffer.duration + extraDuration);

    // Connect input into delay lines
    lastNode.connect(delayL);
    lastNode.connect(delayR);

    // Stereo merger for wide chorus
    const stereoMerger = offlineCtx.createChannelMerger(2);
    delayL.connect(stereoMerger, 0, 0);
    delayR.connect(stereoMerger, 0, 1);

    // Combine Dry and Wet
    lastNode.connect(chorusDry);
    chorusDry.connect(chorusMerge);

    stereoMerger.connect(chorusWet);
    chorusWet.connect(chorusMerge);

    lastNode = chorusMerge;
  }

  // Setup Delay / Echo
  let dryWetNode: AudioNode = lastNode;
  if (settings.delayEnabled && settings.delayMix > 0.01) {
    const delayNode = offlineCtx.createDelay(5.0);
    delayNode.delayTime.value = settings.delayTime;

    const feedbackGain = offlineCtx.createGain();
    feedbackGain.gain.value = Math.min(0.85, settings.delayFeedback);

    const delayWet = offlineCtx.createGain();
    delayWet.gain.value = settings.delayMix;

    const delayDry = offlineCtx.createGain();
    delayDry.gain.value = 1.0;

    const delayMerge = offlineCtx.createGain();

    lastNode.connect(delayDry);
    delayDry.connect(delayMerge);

    lastNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(delayMerge);

    dryWetNode = delayMerge;
  }

  // Setup Reverb (Decay Time & Wet/Dry Mix)
  if (settings.reverbEnabled) {
    const rawMix = settings.reverbMix;
    const mix = rawMix > 1 ? rawMix / 100 : rawMix;
    if (mix > 0.01) {
      const decayTime = Math.max(0.2, settings.reverbDecay);
      const convolver = offlineCtx.createConvolver();
      convolver.buffer = createReverbImpulse(offlineCtx, decayTime, decayTime + 0.5);

      const reverbWet = offlineCtx.createGain();
      reverbWet.gain.value = mix * 0.85;

      const reverbDry = offlineCtx.createGain();
      reverbDry.gain.value = Math.max(0.15, 1.0 - mix * 0.55);

      const reverbMerge = offlineCtx.createGain();

      dryWetNode.connect(reverbDry);
      reverbDry.connect(reverbMerge);

      dryWetNode.connect(convolver);
      convolver.connect(reverbWet);
      reverbWet.connect(reverbMerge);

      dryWetNode = reverbMerge;
    }
  }

  dryWetNode.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered;
}
