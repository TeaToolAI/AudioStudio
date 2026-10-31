/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChannelStats {
  peakLinear: number;
  peakDb: number;
  rmsLinear: number;
  rmsDb: number;
  dcOffset: number;
  clippingCount: number;
}

export interface AudioBufferStats {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  totalSamples: number;
  channels: ChannelStats[];
  maxPeakDb: number;
  avgRmsDb: number;
  crestFactorDb: number;
  headroomDb: number;
  isClipping: boolean;
  totalClippingCount: number;
  estimatedMemoryMb: number;
}

export function computeAudioStats(buffer: AudioBuffer): AudioBufferStats {
  const numChannels = buffer.numberOfChannels;
  const numSamples = buffer.length;
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  const channelStats: ChannelStats[] = [];
  let maxPeakLinear = 0;
  let totalSumSquares = 0;
  let totalClippingCount = 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    let chMax = 0;
    let chSumSquares = 0;
    let chSum = 0;
    let chClipping = 0;

    // Use stride for very large buffers (> 5 minutes) to ensure instantaneous calculation
    const stride = numSamples > 20000000 ? 2 : 1;
    let processedCount = 0;

    for (let i = 0; i < numSamples; i += stride) {
      const sample = data[i];
      const absSample = Math.abs(sample);

      if (absSample > chMax) {
        chMax = absSample;
      }

      chSumSquares += sample * sample;
      chSum += sample;
      processedCount++;

      if (absSample >= 0.9995) {
        chClipping++;
      }
    }

    if (chMax > maxPeakLinear) {
      maxPeakLinear = chMax;
    }

    totalSumSquares += chSumSquares / processedCount;
    totalClippingCount += chClipping;

    const chRmsLinear = Math.sqrt(chSumSquares / Math.max(1, processedCount));
    const chPeakDb = chMax > 1e-7 ? 20 * Math.log10(chMax) : -100;
    const chRmsDb = chRmsLinear > 1e-7 ? 20 * Math.log10(chRmsLinear) : -100;
    const chDcOffset = chSum / Math.max(1, processedCount);

    channelStats.push({
      peakLinear: chMax,
      peakDb: Number(chPeakDb.toFixed(2)),
      rmsLinear: chRmsLinear,
      rmsDb: Number(chRmsDb.toFixed(2)),
      dcOffset: Number(chDcOffset.toFixed(4)),
      clippingCount: chClipping,
    });
  }

  const combinedRmsLinear = Math.sqrt(totalSumSquares / Math.max(1, numChannels));
  const maxPeakDb = maxPeakLinear > 1e-7 ? 20 * Math.log10(maxPeakLinear) : -100;
  const avgRmsDb = combinedRmsLinear > 1e-7 ? 20 * Math.log10(combinedRmsLinear) : -100;
  const crestFactorDb = Math.max(0, maxPeakDb - avgRmsDb);
  const headroomDb = Math.max(0, -maxPeakDb);
  const isClipping = maxPeakDb >= -0.05 || totalClippingCount > 0;
  const estimatedMemoryMb = (numSamples * numChannels * 4) / (1024 * 1024); // 32-bit Float RAM size

  return {
    duration,
    sampleRate,
    numberOfChannels: numChannels,
    totalSamples: numSamples,
    channels: channelStats,
    maxPeakDb: Number(maxPeakDb.toFixed(2)),
    avgRmsDb: Number(avgRmsDb.toFixed(2)),
    crestFactorDb: Number(crestFactorDb.toFixed(2)),
    headroomDb: Number(headroomDb.toFixed(2)),
    isClipping,
    totalClippingCount,
    estimatedMemoryMb: Number(estimatedMemoryMb.toFixed(2)),
  };
}
