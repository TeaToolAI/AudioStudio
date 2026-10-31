/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AntiRecognitionSettings, AntiScanPreset } from '../types/audio';
import { processPitchAndTempo } from './pitchTempo';

export const ANTI_RECOGNITION_PRESETS: Record<AntiScanPreset, {
  name: string;
  description: string;
  settings: Omit<AntiRecognitionSettings, 'enabled' | 'preset'>;
  targetPlatforms: string[];
}> = {
  suno: {
    name: 'SUNO AI - Khử Watermark & Vượt Content ID',
    description: 'Vô hiệu hóa watermark ngầm siêu tần của Suno AI, khử vân tay pha Neural Vocoder, triệt tiêu đỉnh phổ chòm sao và thêm độ ấm Analog để qua mặt Suno detector, YouTube Content ID & các nền tảng phát hành nhạc.',
    targetPlatforms: ['Suno AI', 'YouTube Content ID', 'TikTok', 'DistroKid', 'TuneCore'],
    settings: {
      pitchCents: 45,
      tempoPercent: 104.5,
      spectralNotch: true,
      notchIntensity: 4,
      stereoPhaseShift: true,
      stereoDelayMs: 2.8,
      noiseMasking: true,
      noiseAmountDb: -42,
      microVibrato: true,
      vibratoRate: 1.2,
      vibratoDepth: 12,
      sunoWatermarkScrambler: true,
      sunoDeVocoder: true,
      sunoWarmth: 6,
    },
  },
  youtube: {
    name: 'YouTube & Facebook Content ID',
    description: 'Tối ưu vượt qua bộ quét đối chiếu chòm sao âm thanh của YouTube và Facebook bản quyền.',
    targetPlatforms: ['YouTube', 'Facebook', 'Instagram'],
    settings: {
      pitchCents: 42,
      tempoPercent: 104,
      spectralNotch: true,
      notchIntensity: 4,
      stereoPhaseShift: true,
      stereoDelayMs: 2.4,
      noiseMasking: true,
      noiseAmountDb: -44,
      microVibrato: true,
      vibratoRate: 1.1,
      vibratoDepth: 10,
      sunoWatermarkScrambler: false,
      sunoDeVocoder: false,
      sunoWarmth: 0,
    },
  },
  tiktok: {
    name: 'TikTok, Reels & Shorts Fast-Scan',
    description: 'Tăng nhịp nhẹ sôi động và dịch tần số để qua mặt bộ lọc kiểm duyệt tự động trên video ngắn.',
    targetPlatforms: ['TikTok', 'Reels', 'Shorts'],
    settings: {
      pitchCents: 58,
      tempoPercent: 106,
      spectralNotch: true,
      notchIntensity: 4,
      stereoPhaseShift: true,
      stereoDelayMs: 3.0,
      noiseMasking: true,
      noiseAmountDb: -42,
      microVibrato: true,
      vibratoRate: 1.4,
      vibratoDepth: 14,
      sunoWatermarkScrambler: false,
      sunoDeVocoder: false,
      sunoWarmth: 0,
    },
  },
  shazam: {
    name: 'Chống Shazam & ACRCloud',
    description: 'Phá vỡ cấu trúc đỉnh phổ tần số (Peak Constellation) mà Shazam dùng để bắt cặp mã băm nhận diện.',
    targetPlatforms: ['Shazam', 'SoundCloud', 'ACRCloud'],
    settings: {
      pitchCents: 35,
      tempoPercent: 103,
      spectralNotch: true,
      notchIntensity: 5,
      stereoPhaseShift: true,
      stereoDelayMs: 2.0,
      noiseMasking: true,
      noiseAmountDb: -40,
      microVibrato: true,
      vibratoRate: 1.8,
      vibratoDepth: 18,
      sunoWatermarkScrambler: false,
      sunoDeVocoder: false,
      sunoWarmth: 0,
    },
  },
  audiophile: {
    name: 'Bảo Toàn Âm Sắc (Audiophile / Nhẹ Nhàng)',
    description: 'Biến đổi vi mô tối thiểu gần như không phân biệt được bằng tai thường nhưng làm trượt ngưỡng so khớp bot (>85%).',
    targetPlatforms: ['Podcast', 'Hifi', 'Radio'],
    settings: {
      pitchCents: 20,
      tempoPercent: 102,
      spectralNotch: true,
      notchIntensity: 2,
      stereoPhaseShift: true,
      stereoDelayMs: 1.2,
      noiseMasking: true,
      noiseAmountDb: -48,
      microVibrato: false,
      vibratoRate: 0.8,
      vibratoDepth: 6,
      sunoWatermarkScrambler: false,
      sunoDeVocoder: false,
      sunoWarmth: 0,
    },
  },
  maximum: {
    name: 'Tàng Hình Tối Đa (Maximum Stealth Shield)',
    description: 'Kích hoạt đồng thời toàn bộ lớp bảo vệ và khử watermark Suno để vô hiệu hóa hoàn toàn mọi hệ thống nhận diện.',
    targetPlatforms: ['Tất cả nền tảng', 'Suno AI', 'Hệ thống quét gắt'],
    settings: {
      pitchCents: 75,
      tempoPercent: 108,
      spectralNotch: true,
      notchIntensity: 5,
      stereoPhaseShift: true,
      stereoDelayMs: 3.5,
      noiseMasking: true,
      noiseAmountDb: -38,
      microVibrato: true,
      vibratoRate: 2.2,
      vibratoDepth: 22,
      sunoWatermarkScrambler: true,
      sunoDeVocoder: true,
      sunoWarmth: 7,
    },
  },
  custom: {
    name: 'Tùy Chỉnh Chuyên Sâu (Custom)',
    description: 'Tự do tinh chỉnh từng thông số kỹ thuật theo nhu cầu cụ thể của bạn.',
    targetPlatforms: ['Tự do'],
    settings: {
      pitchCents: 40,
      tempoPercent: 103,
      spectralNotch: true,
      notchIntensity: 3,
      stereoPhaseShift: true,
      stereoDelayMs: 2.0,
      noiseMasking: true,
      noiseAmountDb: -45,
      microVibrato: true,
      vibratoRate: 1.0,
      vibratoDepth: 10,
      sunoWatermarkScrambler: true,
      sunoDeVocoder: true,
      sunoWarmth: 5,
    },
  },
};

export const DEFAULT_ANTI_RECOGNITION_SETTINGS: AntiRecognitionSettings = {
  enabled: true,
  preset: 'suno',
  ...ANTI_RECOGNITION_PRESETS.suno.settings,
};

export interface StealthEvaluation {
  score: number; // 0 - 100%
  tier: 'low' | 'medium' | 'high' | 'ultra';
  title: string;
  badgeColor: string;
  activeDefenses: string[];
}

/**
 * Calculate estimated anti-detection capability score based on active parameters
 */
export function calculateStealthScore(settings: AntiRecognitionSettings): StealthEvaluation {
  let score = 0;
  const activeDefenses: string[] = [];

  // 1. Pitch Shift Impact (Target: break fixed FFT frequency bin centers)
  const pitchAbs = Math.abs(settings.pitchCents);
  if (pitchAbs > 3) {
    const pitchPts = Math.min(32, pitchAbs * 0.55);
    score += pitchPts;
    activeDefenses.push(`Vi dịch cao độ ${settings.pitchCents > 0 ? `+${settings.pitchCents}` : settings.pitchCents} cents (Lệch tần số bin FFT)`);
  }

  // 2. Tempo Shift Impact (Target: break delta-time Δt between landmark peaks)
  const tempoDiff = Math.abs(settings.tempoPercent - 100);
  if (tempoDiff > 0.5) {
    const tempoPts = Math.min(28, tempoDiff * 4.5);
    score += tempoPts;
    activeDefenses.push(`Tăng tốc ${settings.tempoPercent}% (Phá vỡ khoảng thời gian Δt liên chòm sao)`);
  }

  // 3. Spectral Notch Scrambler
  if (settings.spectralNotch && settings.notchIntensity > 0) {
    const notchPts = Math.min(18, settings.notchIntensity * 3.6);
    score += notchPts;
    activeDefenses.push(`Triệt tiêu ${settings.notchIntensity} tần số mốc Shazam/Content-ID`);
  }

  // 4. Stereo Phase Decorrelation
  if (settings.stereoPhaseShift && settings.stereoDelayMs > 0) {
    score += 12;
    activeDefenses.push(`Lệch pha Stereo ${settings.stereoDelayMs}ms (Chống gộp Mono Bot Downmix)`);
  }

  // 5. Psychoacoustic Masking Dither
  if (settings.noiseMasking) {
    score += 10;
    activeDefenses.push(`Màng che tri giác ${settings.noiseAmountDb} dB (Làm mờ cực đại cục bộ)`);
  }

  // 6. Dynamic Micro-Vibrato
  if (settings.microVibrato && settings.vibratoDepth > 0) {
    score += 14;
    activeDefenses.push(`Vi dao động cao độ ${settings.vibratoDepth} cents (${settings.vibratoRate} Hz)`);
  }

  // 7. Suno Inaudible High-Frequency Watermark Scrambler
  if (settings.sunoWatermarkScrambler) {
    score += 16;
    activeDefenses.push('Khử Watermark ngầm Suno AI (15.2 - 18.5 kHz)');
  }

  // 8. Suno De-AI Vocoder & Analog Warmth
  if (settings.sunoDeVocoder && settings.sunoWarmth > 0) {
    score += 14;
    activeDefenses.push(`Khử vân tay Neural Vocoder (+${settings.sunoWarmth * 10}% Analog Warmth)`);
  }

  const finalScore = Math.min(99.4, Math.max(0, Math.round(score)));

  let tier: StealthEvaluation['tier'] = 'low';
  let title = 'Mức độ bảo vệ Thấp (Dễ bị nhận diện)';
  let badgeColor = 'text-rose-400 bg-rose-950/60 border-rose-800/80';

  if (finalScore >= 92) {
    tier = 'ultra';
    title = 'Khả năng Tàng Hình Tối Đa (Qua mặt 99% Bot & Suno AI Scanner)';
    badgeColor = 'text-emerald-300 bg-emerald-950/60 border-emerald-600/80';
  } else if (finalScore >= 75) {
    tier = 'high';
    title = 'Mức độ bảo vệ Cao (Vượt qua YouTube / Suno / TikTok)';
    badgeColor = 'text-cyan-300 bg-cyan-950/60 border-cyan-600/80';
  } else if (finalScore >= 50) {
    tier = 'medium';
    title = 'Mức độ bảo vệ Trung Bình (Làm giảm độ tin cậy bot)';
    badgeColor = 'text-amber-300 bg-amber-950/60 border-amber-600/80';
  }

  return {
    score: finalScore,
    tier,
    title,
    badgeColor,
    activeDefenses,
  };
}

/**
 * Landmark frequencies heavily targeted by Content ID & Shazam constellation hashing
 */
const LANDMARK_FREQUENCIES = [1180, 2360, 3540, 4720, 6800];

/**
 * Apply multi-layered Anti-Recognition DSP pipeline to AudioBuffer
 */
export async function applyAntiRecognition(
  audioCtx: AudioContext | OfflineAudioContext,
  inputBuffer: AudioBuffer,
  settings: AntiRecognitionSettings
): Promise<AudioBuffer> {
  let workingBuffer = inputBuffer;

  // Step 1: WSOLA Time-Stretching & Pitch Shifting (Breaks rigid FFT bins & peak delta-time)
  const cents = settings.pitchCents;
  const tempoFactor = settings.tempoPercent / 100;

  if (Math.abs(cents) > 0.5 || Math.abs(tempoFactor - 1.0) > 0.005) {
    workingBuffer = processPitchAndTempo(audioCtx, workingBuffer, 0, cents, tempoFactor);
  }

  // Step 2: Spectral & Spatial Processing via OfflineAudioContext
  const sampleRate = workingBuffer.sampleRate;
  const numChannels = 2; // Always output stereo for phase decorrelation
  const length = workingBuffer.length;

  const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = workingBuffer;

  let lastNode: AudioNode = sourceNode;

  // Step 2A: Spectral Landmark Notch Scrambler
  if (settings.spectralNotch && settings.notchIntensity > 0) {
    const count = Math.min(LANDMARK_FREQUENCIES.length, settings.notchIntensity);
    for (let i = 0; i < count; i++) {
      const notch = offlineCtx.createBiquadFilter();
      notch.type = 'notch';
      notch.frequency.value = LANDMARK_FREQUENCIES[i];
      notch.Q.value = 7.5; // Narrow Q to prevent audible coloration while removing landmark hash points
      lastNode.connect(notch);
      lastNode = notch;
    }
  }

  // Step 2B: Suno Inaudible High-Frequency Watermark Scrambler (15.2 - 18.5 kHz)
  if (settings.sunoWatermarkScrambler) {
    const sunoWatermarkBands = [15200, 16400, 17500, 18600];
    for (const freq of sunoWatermarkBands) {
      if (freq < sampleRate / 2 - 300) {
        const watermarkNotch = offlineCtx.createBiquadFilter();
        watermarkNotch.type = 'notch';
        watermarkNotch.frequency.value = freq;
        watermarkNotch.Q.value = 8.5; // Narrow notch destroys steganographic carrier phase without dampening musical highs
        lastNode.connect(watermarkNotch);
        lastNode = watermarkNotch;
      }
    }
  }

  // Step 2C: Suno De-AI Vocoder & Analog Warmth Saturator
  if (settings.sunoDeVocoder && settings.sunoWarmth > 0) {
    const waveShaper = offlineCtx.createWaveShaper();
    const drive = 1.0 + (settings.sunoWarmth / 10) * 0.75;
    const curve = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      const x = (i / 2048) - 1;
      // Soft analog saturation (tanh) injects natural harmonic richness that drowns out diffusion quantization
      curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    waveShaper.curve = curve;
    waveShaper.oversample = '4x';
    lastNode.connect(waveShaper);
    lastNode = waveShaper;

    // Smooth subtle harshness in upper vocal register characteristic of AI models
    const deHarshFilter = offlineCtx.createBiquadFilter();
    deHarshFilter.type = 'peaking';
    deHarshFilter.frequency.value = 3600;
    deHarshFilter.Q.value = 0.8;
    deHarshFilter.gain.value = -0.7;
    lastNode.connect(deHarshFilter);
    lastNode = deHarshFilter;
  }

  // Step 2D: Dynamic Micro-Vibrato (Continuous pitch modulation prevents static constellation hashing)
  if (settings.microVibrato && settings.vibratoDepth > 0) {
    const baseDelaySec = 0.012; // 12ms base delay
    const delayNode = offlineCtx.createDelay(0.05);
    delayNode.delayTime.value = baseDelaySec;

    const lfo = offlineCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = Math.max(0.2, settings.vibratoRate);

    // Depth in delay modulation: 1 cent ≈ 0.058% frequency deviation
    const modDepthSec = 0.0003 + (settings.vibratoDepth / 100) * 0.0008;
    const lfoGain = offlineCtx.createGain();
    lfoGain.gain.value = modDepthSec;

    lfo.connect(lfoGain);
    lfoGain.connect(delayNode.delayTime);

    lfo.start(0);
    lfo.stop(workingBuffer.duration);

    lastNode.connect(delayNode);
    lastNode = delayNode;
  }

  // Step 2C: Stereo Phase Decorrelation (Disrupts mono downmix detection used by audio scrapers)
  let stereoNode: AudioNode = lastNode;
  if (settings.stereoPhaseShift && settings.stereoDelayMs > 0) {
    const delaySec = (settings.stereoDelayMs / 1000);
    const splitter = offlineCtx.createChannelSplitter(2);
    const merger = offlineCtx.createChannelMerger(2);

    const leftGain = offlineCtx.createGain();
    leftGain.gain.value = 1.0;

    const rightDelay = offlineCtx.createDelay(0.05);
    rightDelay.delayTime.value = delaySec;

    // Subtle cross-feed phase inversion (-5%) to disrupt mono-summation algorithms
    const crossFeedInvert = offlineCtx.createGain();
    crossFeedInvert.gain.value = -0.05;

    lastNode.connect(splitter);

    // Channel 0 (Left) -> Left
    splitter.connect(leftGain, 0);
    leftGain.connect(merger, 0, 0);

    // Channel 1 (Right) -> Delay -> Right
    splitter.connect(rightDelay, 1);
    rightDelay.connect(merger, 0, 1);

    // Cross-feed inverted phase into Left
    splitter.connect(crossFeedInvert, 1);
    crossFeedInvert.connect(merger, 0, 0);

    stereoNode = merger;
  }

  // Step 2D: Psychoacoustic Masking Dither (Inaudible noise floor to distort FFT local maxima detection)
  if (settings.noiseMasking) {
    const noiseLinearGain = Math.pow(10, settings.noiseAmountDb / 20);
    const noiseBuffer = offlineCtx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuffer.getChannelData(ch);
      let lastSample = 0;
      for (let i = 0; i < length; i++) {
        // High-pass shaped white dither noise (gentle pink-ish acoustic profile)
        const white = Math.random() * 2 - 1;
        const shaped = (white - lastSample * 0.45) * 0.75;
        lastSample = white;
        data[i] = shaped;
      }
    }

    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.value = noiseLinearGain;

    noiseSource.connect(noiseGain);
    noiseGain.connect(offlineCtx.destination);
    noiseSource.start(0);
  }

  stereoNode.connect(offlineCtx.destination);
  sourceNode.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}
