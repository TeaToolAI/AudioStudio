/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Mp3Encoder } from '@breezystack/lamejs';
import { ExportSettings, SelectionRange } from '../types/audio';
import { cropAudioBuffer } from './audioOperations';

/**
 * Write a string into a DataView at an offset
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert AudioBuffer to 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(
  buffer: AudioBuffer,
  onProgress?: (percent: number) => void
): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataByteLength = numSamples * blockAlign;

  const bufferLength = 44 + dataByteLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // ChunkSize
  writeString(view, 8, 'WAVE');

  // fmt Sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // data Sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Interleave and convert Float32 to Int16
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  const reportStep = Math.max(1000, Math.floor(numSamples / 20));

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // Hard clamp between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    if (onProgress && i % reportStep === 0) {
      onProgress(Math.round((i / numSamples) * 100));
    }
  }

  if (onProgress) onProgress(100);
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Convert AudioBuffer to MP3 Blob using lamejs with chunking & progress
 */
export async function audioBufferToMp3Blob(
  buffer: AudioBuffer,
  bitrate: 128 | 192 | 320 = 192,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;

  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, bitrate);
  const mp3Data: Uint8Array[] = [];

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  const chunkSize = 1152; // LAME standard MP3 frame sample size
  const totalChunks = Math.ceil(numSamples / chunkSize);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * chunkSize;
    const end = Math.min(numSamples, start + chunkSize);
    const length = end - start;

    const leftChunk = new Int16Array(length);
    const rightChunk = new Int16Array(length);

    for (let i = 0; i < length; i++) {
      let l = Math.max(-1, Math.min(1, leftChannel[start + i]));
      let r = Math.max(-1, Math.min(1, rightChannel[start + i]));
      leftChunk[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;
      rightChunk[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
    }

    let mp3buf: Int8Array | Uint8Array;
    if (numChannels === 1) {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    if (onProgress && (chunkIdx % 10 === 0 || chunkIdx === totalChunks - 1)) {
      onProgress(Math.round(((chunkIdx + 1) / totalChunks) * 95));
      // Give browser event loop a breath so UI stays smooth
      if (chunkIdx % 100 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  // Flush remaining buffers
  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  if (onProgress) onProgress(100);
  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Export AudioBuffer based on user configuration (WAV / MP3)
 */
export async function exportAudio(
  audioCtx: BaseAudioContext,
  fullBuffer: AudioBuffer,
  settings: ExportSettings,
  selection?: SelectionRange,
  onProgress?: (percent: number) => void
): Promise<{ blob: Blob; filename: string }> {
  // Determine if exporting full audio or selection
  let targetBuffer = fullBuffer;
  if (settings.exportRange === 'selection' && selection) {
    targetBuffer = cropAudioBuffer(audioCtx, fullBuffer, selection);
  }

  let blob: Blob;
  const ext = settings.format === 'mp3' ? 'mp3' : 'wav';
  const cleanName = settings.filename.replace(/\.[^/.]+$/, '').trim() || 'audio-edited';
  const finalFilename = `${cleanName}.${ext}`;

  if (settings.format === 'mp3') {
    blob = await audioBufferToMp3Blob(targetBuffer, settings.mp3Bitrate, onProgress);
  } else {
    blob = audioBufferToWavBlob(targetBuffer, onProgress);
  }

  return { blob, filename: finalFilename };
}

/**
 * Trigger immediate browser download
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
