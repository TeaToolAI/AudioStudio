/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SelectionRange {
  start: number; // in seconds
  end: number;   // in seconds
}

export interface AudioClip {
  id: string;
  name: string;
  buffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

export interface TimelineClip {
  id: string;
  name: string;
  sourceBuffer: AudioBuffer; // Nguồn AudioBuffer gốc
  sourceStart: number;       // Thời điểm bắt đầu trong nguồn (giây)
  sourceEnd: number;         // Thời điểm kết thúc trong nguồn (giây)
  colorIndex: number;        // Chỉ số bảng màu để phân biệt trực quan
}

// =========================================================================
// MULTI-TRACK TIMELINE DATA MODEL
// =========================================================================

export interface ProjectClip {
  id: string;
  trackId: string;
  name: string;
  sourceBuffer: AudioBuffer; // Tham chiếu AudioBuffer nguồn (không sao chép)
  sourceStart: number;       // Thời điểm bắt đầu trong nguồn (giây)
  sourceEnd: number;         // Thời điểm kết thúc trong nguồn (giây)
  startTime: number;         // Vị trí đặt trên timeline project (giây, cho phép khoảng trống)
  colorIndex?: number;       // Màu riêng của clip (nếu không có thì theo track)
  fadeIn?: number;           // Thời gian fade in (giây)
  fadeOut?: number;          // Thời gian fade out (giây)
}

export interface AudioTrack {
  id: string;
  name: string;
  colorIndex: number;        // 0 to 7 (bảng màu track studio)
  volumeDb: number;          // -60 dB to +12 dB (mặc định 0 dB)
  pan: number;               // -100 (trái) đến +100 (phải), 0 là giữa
  mute: boolean;
  solo: boolean;
  locked: boolean;
  height: number;            // Chiều cao pixel của track (mặc định 96px, 64px - 220px)
}

export interface MultiTrackProject {
  tracks: AudioTrack[];
  clips: ProjectClip[];
}

export interface HistoryState {
  project: MultiTrackProject;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  name: string;
  description: string;
  timestamp: number;
  buffer?: AudioBuffer | null;
}

export interface EQBand {
  freq: number;
  gain: number; // -12 to +12 dB
  label: string;
}

export interface EffectSettings {
  // Gain & Fades
  gainDb: number;
  // Filters
  lowPassCutoff: number; // Hz (20 - 20000)
  highPassCutoff: number; // Hz (20 - 20000)
  // Noise Reduction
  noiseReductionAmount: number; // 0 - 100%
  noiseGateThreshold: number; // -60 to -10 dB
  // Delay / Echo
  delayEnabled: boolean;
  delayTime: number; // 0.05 to 1.0s
  delayFeedback: number; // 0 to 0.9
  delayMix: number; // 0 to 1
  // Reverb
  reverbEnabled: boolean;
  reverbDecay: number; // 0.5 to 5.0s
  reverbMix: number; // 0 to 1
  // Voice Changer
  voicePreset: 'none' | 'deep' | 'chipmunk' | 'robot' | 'radio' | 'telephone';
  // Distortion / Overdrive
  distortionEnabled: boolean;
  distortionDrive: number; // 0 to 100
  distortionTone: number;  // 0 to 100
  distortionLevel: number; // 0 to 100
  // Chorus
  chorusEnabled: boolean;
  chorusRate: number;  // Hz (0.2 to 8.0)
  chorusDepth: number; // % (0 to 100)
  chorusMix: number;   // % (0 to 100)
  // Dynamics Compressor
  compressorEnabled: boolean;
  compressorThreshold: number; // dB (-60 to 0)
  compressorRatio: number;     // 1 to 20 (:1)
  compressorAttack: number;    // seconds (0.001 to 0.5)
  compressorRelease: number;   // seconds (0.01 to 1.0)
  compressorKnee?: number;     // dB (0 to 40)
}

export interface PitchTempoSettings {
  semitones: number; // -12 to +12
  cents: number;     // -50 to +50
  tempo: number;     // 0.5 to 2.0 (1.0 = normal)
}

export interface ExportSettings {
  format: 'wav' | 'mp3';
  mp3Bitrate: 128 | 192 | 320;
  sampleRate: number;
  exportRange: 'all' | 'selection';
  exportMode: 'master' | 'stems'; // master mixdown hoặc xuất từng track riêng
  filename: string;
}

export type WaveformTemplate =
  | 'classic'      // Thanh Studio Kinh Điển
  | 'smooth'       // Đường Cong Mượt Mà
  | 'neon'         // Neon Cyberpunk
  | 'led'          // Đèn LED Ma Trận
  | 'stereo'       // Tách 2 Kênh Trái/Phải
  | 'oscilloscope';// Máy Hiện Sóng Huỳnh Quang

export interface WaveformRenderConfig {
  template: WaveformTemplate;
  colorScheme: 'cyan' | 'neon' | 'amber' | 'emerald' | 'crimson' | 'silver';
  showGrid: boolean;
  glowEffect: boolean;
  barWidth: number; // 1 to 4
  barGap: number;   // 0 to 2
  showSpectrogram: boolean;
  spectrogramOpacity: number; // 0.1 to 0.7
  spectrogramPalette: 'magma' | 'viridis' | 'cyan' | 'fire';
}

export type AntiScanPreset = 'suno' | 'youtube' | 'tiktok' | 'shazam' | 'audiophile' | 'maximum' | 'custom';

export interface AntiRecognitionSettings {
  enabled: boolean;
  preset: AntiScanPreset;
  pitchCents: number;       // -100 to +100 cents
  tempoPercent: number;     // 95% to 115%
  spectralNotch: boolean;   // Notch landmarks
  notchIntensity: number;   // 1 to 5
  stereoPhaseShift: boolean;// Stereo phase decorrelation
  stereoDelayMs: number;    // 0.5 to 5.0 ms
  noiseMasking: boolean;    // Psychoacoustic masking
  noiseAmountDb: number;    // -60 dB to -35 dB
  microVibrato: boolean;    // Dynamic micro-vibrato
  vibratoRate: number;      // 0.5 to 3.0 Hz
  vibratoDepth: number;     // 4 to 25 cents
  sunoWatermarkScrambler: boolean;
  sunoDeVocoder: boolean;
  sunoWarmth: number;       // 0 to 10
}
