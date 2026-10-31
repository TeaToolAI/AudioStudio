/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WSOLA (Waveform Similarity Overlap-Add) Time-Stretching & Pitch-Shifting Engine
 * Runs completely in client-side TypeScript without any external dependencies.
 */

// Generate a Hann (Hanning) window
function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

/**
 * Linear interpolation resampling for changing pitch/speed
 */
export function resampleAudioBuffer(
  audioCtx: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  ratio: number
): AudioBuffer {
  if (Math.abs(ratio - 1.0) < 0.001) return buffer;

  const numChannels = buffer.numberOfChannels;
  const oldLength = buffer.length;
  const newLength = Math.max(1, Math.round(oldLength / ratio));
  const newBuffer = audioCtx.createBuffer(numChannels, newLength, buffer.sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = newBuffer.getChannelData(ch);

    for (let i = 0; i < newLength; i++) {
      const srcPos = i * ratio;
      const index = Math.floor(srcPos);
      const frac = srcPos - index;

      if (index + 1 < oldLength) {
        output[i] = input[index] * (1 - frac) + input[index + 1] * frac;
      } else if (index < oldLength) {
        output[i] = input[index];
      } else {
        output[i] = 0;
      }
    }
  }

  return newBuffer;
}

/**
 * Time-stretch audio channel using WSOLA
 * @param input Float32Array of samples
 * @param tempoFactor Speed multiplier: 0.5 = half speed (slow), 2.0 = double speed (fast)
 */
export function wsolaTimeStretchChannel(
  input: Float32Array,
  tempoFactor: number
): Float32Array {
  if (Math.abs(tempoFactor - 1.0) < 0.01) {
    return new Float32Array(input);
  }

  const windowSize = 2048;
  const halfWindow = windowSize >> 1;
  const synthHop = halfWindow; // Hs
  const searchRange = 256; // Delta search around nominal analysis hop
  const window = createHannWindow(windowSize);

  const inputLength = input.length;
  const outputLength = Math.max(1, Math.round(inputLength / tempoFactor));
  const output = new Float32Array(outputLength + windowSize);
  const normalization = new Float32Array(outputLength + windowSize);

  let synthPos = 0;
  let prevInputPos = 0;

  while (synthPos < outputLength) {
    const nominalAnalysisPos = Math.round(synthPos * tempoFactor);

    // Find best match in search range around nominalAnalysisPos to align waveforms
    let bestOffset = 0;
    if (synthPos > 0) {
      let maxCorr = -Infinity;
      const minOffset = -searchRange;
      const maxOffset = searchRange;

      for (let offset = minOffset; offset <= maxOffset; offset += 4) { // stride 4 for speed
        const testPos = nominalAnalysisPos + offset;
        if (testPos < 0 || testPos + windowSize >= inputLength) continue;

        let corr = 0;
        // Compute cross correlation with previous window
        const sampleStep = 8;
        for (let i = 0; i < windowSize; i += sampleStep) {
          const sample1 = input[prevInputPos + i] || 0;
          const sample2 = input[testPos + i] || 0;
          corr += sample1 * sample2;
        }

        if (corr > maxCorr) {
          maxCorr = corr;
          bestOffset = offset;
        }
      }
    }

    const naturalAnalysisPos = Math.max(
      0,
      Math.min(inputLength - windowSize, nominalAnalysisPos + bestOffset)
    );

    // Overlap-Add windowed segment
    for (let i = 0; i < windowSize; i++) {
      const outIdx = synthPos + i;
      if (outIdx < output.length) {
        const win = window[i];
        output[outIdx] += (input[naturalAnalysisPos + i] || 0) * win;
        normalization[outIdx] += win;
      }
    }

    prevInputPos = naturalAnalysisPos;
    synthPos += synthHop;
  }

  // Normalize by window overlaps to avoid amplitude fluctuations
  const trimmedOutput = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const norm = normalization[i];
    trimmedOutput[i] = norm > 0.0001 ? output[i] / norm : output[i];
  }

  return trimmedOutput;
}

/**
 * Change tempo of AudioBuffer without altering pitch
 */
export function changeTempo(
  audioCtx: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  tempoFactor: number
): AudioBuffer {
  if (Math.abs(tempoFactor - 1.0) < 0.01) {
    return buffer;
  }

  const numChannels = buffer.numberOfChannels;
  const processedChannels: Float32Array[] = [];

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    const stretched = wsolaTimeStretchChannel(channelData, tempoFactor);
    processedChannels.push(stretched);
  }

  const outputLength = processedChannels[0].length;
  const newBuffer = audioCtx.createBuffer(numChannels, outputLength, buffer.sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    newBuffer.getChannelData(ch).set(processedChannels[ch]);
  }

  return newBuffer;
}

/**
 * Change pitch of AudioBuffer without altering tempo
 * @param semitones Number of semitones (-12 to +12)
 * @param cents Fine tuning (-50 to +50 cents)
 */
export function changePitch(
  audioCtx: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  semitones: number,
  cents: number = 0
): AudioBuffer {
  const totalSemitones = semitones + cents / 100;
  if (Math.abs(totalSemitones) < 0.01) {
    return buffer;
  }

  // Pitch ratio: 2^(semitones / 12)
  // E.g. +12 semitones = 2.0 (octave up), -12 semitones = 0.5 (octave down)
  const pitchRatio = Math.pow(2, totalSemitones / 12);

  // Step 1: Resample by pitchRatio.
  // This changes frequency by pitchRatio and speeds up/slows down by pitchRatio.
  const resampled = resampleAudioBuffer(audioCtx, buffer, pitchRatio);

  // Step 2: Time-stretch by 1 / pitchRatio.
  // This restores original duration while keeping shifted pitch frequencies!
  const finalTempoFactor = 1 / pitchRatio;
  return changeTempo(audioCtx, resampled, finalTempoFactor);
}

/**
 * Combined Pitch and Tempo processing
 */
export function processPitchAndTempo(
  audioCtx: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  semitones: number,
  cents: number,
  tempo: number
): AudioBuffer {
  let currentBuffer = buffer;
  if (Math.abs(semitones) > 0.01 || Math.abs(cents) > 0.01) {
    currentBuffer = changePitch(audioCtx, currentBuffer, semitones, cents);
  }
  if (Math.abs(tempo - 1.0) > 0.01) {
    currentBuffer = changeTempo(audioCtx, currentBuffer, tempo);
  }
  return currentBuffer;
}
