/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SelectionRange } from '../types/audio';

/**
 * Creates an empty audio buffer filled with silence
 */
export function createSilentBuffer(
  audioCtx: BaseAudioContext,
  duration: number,
  channels: number = 2,
  sampleRate: number = 44100
): AudioBuffer {
  const safeDuration = Math.max(0.01, duration);
  const length = Math.floor(safeDuration * sampleRate);
  return audioCtx.createBuffer(channels, length, sampleRate);
}

/**
 * Deep copy of an AudioBuffer
 */
export function cloneAudioBuffer(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer
): AudioBuffer {
  const cloned = audioCtx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    cloned.getChannelData(ch).set(buffer.getChannelData(ch));
  }
  return cloned;
}

/**
 * Crop / Cut: Extract only the selected region
 */
export function cropAudioBuffer(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer,
  range: SelectionRange
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(range.start * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(range.end * sampleRate));
  const length = Math.max(1, endSample - startSample);

  const cropped = audioCtx.createBuffer(buffer.numberOfChannels, length, sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const dstData = cropped.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dstData[i] = srcData[startSample + i];
    }
  }

  return cropped;
}

/**
 * Delete selected region, joining the parts before and after
 */
export function deleteAudioSelection(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer,
  range: SelectionRange
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(range.start * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(range.end * sampleRate));

  const beforeLength = startSample;
  const afterLength = Math.max(0, buffer.length - endSample);
  const newLength = Math.max(1, beforeLength + afterLength);

  const result = audioCtx.createBuffer(buffer.numberOfChannels, newLength, sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);

    // Copy before region
    for (let i = 0; i < beforeLength; i++) {
      dst[i] = src[i];
    }
    // Copy after region
    for (let i = 0; i < afterLength; i++) {
      dst[beforeLength + i] = src[endSample + i];
    }
  }

  return result;
}

/**
 * Split AudioBuffer into two at cursor position
 */
export function splitAudioBuffer(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer,
  splitTime: number
): [AudioBuffer, AudioBuffer] {
  const sampleRate = buffer.sampleRate;
  const splitSample = Math.max(1, Math.min(buffer.length - 1, Math.floor(splitTime * sampleRate)));

  const part1 = audioCtx.createBuffer(buffer.numberOfChannels, splitSample, sampleRate);
  const part2 = audioCtx.createBuffer(buffer.numberOfChannels, buffer.length - splitSample, sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst1 = part1.getChannelData(ch);
    const dst2 = part2.getChannelData(ch);

    for (let i = 0; i < splitSample; i++) {
      dst1[i] = src[i];
    }
    for (let i = 0; i < buffer.length - splitSample; i++) {
      dst2[i] = src[splitSample + i];
    }
  }

  return [part1, part2];
}

/**
 * Insert silence of specified duration at insertionTime
 */
export function insertSilence(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer,
  insertionTime: number,
  silenceDuration: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const insertSample = Math.max(0, Math.min(buffer.length, Math.floor(insertionTime * sampleRate)));
  const silenceSamples = Math.floor(silenceDuration * sampleRate);
  const newLength = buffer.length + silenceSamples;

  const result = audioCtx.createBuffer(buffer.numberOfChannels, newLength, sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);

    // Before
    for (let i = 0; i < insertSample; i++) {
      dst[i] = src[i];
    }
    // Silence is already 0 by default in AudioBuffer
    // After
    for (let i = insertSample; i < buffer.length; i++) {
      dst[i + silenceSamples] = src[i];
    }
  }

  return result;
}

/**
 * Paste another AudioBuffer at specified time
 */
export function pasteAudioBuffer(
  audioCtx: BaseAudioContext,
  targetBuffer: AudioBuffer,
  insertBuffer: AudioBuffer,
  pasteTime: number
): AudioBuffer {
  const sampleRate = targetBuffer.sampleRate;
  const pasteSample = Math.max(0, Math.min(targetBuffer.length, Math.floor(pasteTime * sampleRate)));
  const newLength = targetBuffer.length + insertBuffer.length;

  const result = audioCtx.createBuffer(targetBuffer.numberOfChannels, newLength, sampleRate);

  for (let ch = 0; ch < targetBuffer.numberOfChannels; ch++) {
    const srcTarget = targetBuffer.getChannelData(ch);
    const srcInsert = insertBuffer.numberOfChannels > ch
      ? insertBuffer.getChannelData(ch)
      : insertBuffer.getChannelData(0);
    const dst = result.getChannelData(ch);

    // Part before
    for (let i = 0; i < pasteSample; i++) {
      dst[i] = srcTarget[i];
    }
    // Inserted part
    for (let i = 0; i < insertBuffer.length; i++) {
      dst[pasteSample + i] = srcInsert[i];
    }
    // Part after
    for (let i = pasteSample; i < targetBuffer.length; i++) {
      dst[insertBuffer.length + i] = srcTarget[i];
    }
  }

  return result;
}

/**
 * Reverse audio (entire buffer or within selection)
 */
export function reverseAudio(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer,
  range?: SelectionRange
): AudioBuffer {
  const result = cloneAudioBuffer(audioCtx, buffer);
  const sampleRate = buffer.sampleRate;

  const startSample = range ? Math.max(0, Math.floor(range.start * sampleRate)) : 0;
  const endSample = range ? Math.min(buffer.length, Math.floor(range.end * sampleRate)) : buffer.length;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    let left = startSample;
    let right = endSample - 1;
    while (left < right) {
      const temp = data[left];
      data[left] = data[right];
      data[right] = temp;
      left++;
      right--;
    }
  }

  return result;
}

/**
 * Normalize audio peak amplitude to 0 dBFS (-0.1 dB for headroom)
 */
export function normalizeAudio(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer
): AudioBuffer {
  let maxPeak = 0;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i]);
      if (val > maxPeak) maxPeak = val;
    }
  }

  if (maxPeak <= 0.00001) return buffer; // Silence

  const targetPeak = 0.988; // -0.1 dB
  const multiplier = targetPeak / maxPeak;

  const result = audioCtx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) {
      dst[i] = src[i] * multiplier;
    }
  }

  return result;
}

/**
 * Apply Fade In to audio (entire buffer or selection)
 */
export function applyFadeIn(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer,
  durationSec: number,
  range?: SelectionRange
): AudioBuffer {
  const result = cloneAudioBuffer(audioCtx, buffer);
  const sampleRate = buffer.sampleRate;

  const startSample = range ? Math.max(0, Math.floor(range.start * sampleRate)) : 0;
  const maxEnd = range ? Math.floor(range.end * sampleRate) : buffer.length;
  const fadeSamples = Math.min(maxEnd - startSample, Math.floor(durationSec * sampleRate));

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < fadeSamples; i++) {
      // Linear or S-curve fade
      const factor = (i / fadeSamples);
      data[startSample + i] *= factor;
    }
  }

  return result;
}

/**
 * Apply Fade Out to audio (entire buffer or selection)
 */
export function applyFadeOut(
  audioCtx: BaseAudioContext,
  buffer: AudioBuffer,
  durationSec: number,
  range?: SelectionRange
): AudioBuffer {
  const result = cloneAudioBuffer(audioCtx, buffer);
  const sampleRate = buffer.sampleRate;

  const endSample = range ? Math.min(buffer.length, Math.floor(range.end * sampleRate)) : buffer.length;
  const minStart = range ? Math.floor(range.start * sampleRate) : 0;
  const fadeSamples = Math.min(endSample - minStart, Math.floor(durationSec * sampleRate));
  const startFade = endSample - fadeSamples;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < fadeSamples; i++) {
      const factor = 1 - (i / fadeSamples);
      data[startFade + i] *= factor;
    }
  }

  return result;
}

/**
 * Concatenate multiple clips with crossfade (0 to 5 seconds)
 */
export function concatenateClipsWithCrossfade(
  audioCtx: BaseAudioContext,
  clips: AudioBuffer[],
  crossfadeSec: number = 0
): AudioBuffer {
  if (clips.length === 0) {
    return createSilentBuffer(audioCtx, 1.0);
  }
  if (clips.length === 1) {
    return cloneAudioBuffer(audioCtx, clips[0]);
  }

  const sampleRate = clips[0].sampleRate;
  const numChannels = Math.max(...clips.map(c => c.numberOfChannels));

  // Compute total samples accounting for crossfade overlaps
  let totalSamples = clips[0].length;
  for (let i = 1; i < clips.length; i++) {
    const maxCross = Math.min(
      Math.floor(crossfadeSec * sampleRate),
      Math.floor(clips[i - 1].length * 0.45),
      Math.floor(clips[i].length * 0.45)
    );
    totalSamples += (clips[i].length - maxCross);
  }

  const merged = audioCtx.createBuffer(numChannels, Math.max(1, totalSamples), sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const dst = merged.getChannelData(ch);
    let writePos = 0;

    for (let clipIdx = 0; clipIdx < clips.length; clipIdx++) {
      const clip = clips[clipIdx];
      const src = clip.numberOfChannels > ch ? clip.getChannelData(ch) : clip.getChannelData(0);

      if (clipIdx === 0) {
        // First clip copy fully
        for (let i = 0; i < clip.length; i++) {
          dst[writePos + i] = src[i];
        }
        writePos += clip.length;
      } else {
        const prevClip = clips[clipIdx - 1];
        const crossSamples = Math.min(
          Math.floor(crossfadeSec * sampleRate),
          Math.floor(prevClip.length * 0.45),
          Math.floor(clip.length * 0.45)
        );

        const overlapStart = writePos - crossSamples;

        // Perform crossfade in overlap region
        for (let i = 0; i < crossSamples; i++) {
          const fadeOutFactor = 0.5 * (1 + Math.cos((Math.PI * i) / crossSamples)); // equal power approx
          const fadeInFactor = 0.5 * (1 - Math.cos((Math.PI * i) / crossSamples));

          const existingSample = dst[overlapStart + i];
          const newSample = src[i];
          dst[overlapStart + i] = existingSample * fadeOutFactor + newSample * fadeInFactor;
        }

        // Copy remaining non-overlapping part of current clip
        for (let i = crossSamples; i < clip.length; i++) {
          dst[overlapStart + i] = src[i];
        }

        writePos = overlapStart + clip.length;
      }
    }
  }

  return merged;
}
