/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  Square,
  Check,
  RotateCcw,
  Loader2,
  Zap,
  Radio,
  Headphones,
  EyeOff,
  Sliders,
  AudioWaveform,
  Waves,
  Sparkles,
  Info,
  Bot,
  Flame,
} from 'lucide-react';
import { AntiRecognitionSettings, AntiScanPreset } from '../../types/audio';
import {
  ANTI_RECOGNITION_PRESETS,
  DEFAULT_ANTI_RECOGNITION_SETTINGS,
  calculateStealthScore,
} from '../../services/antiRecognition';

interface AntiScanTabProps {
  hasBuffer: boolean;
  onPreview: (settings: AntiRecognitionSettings) => void;
  onStopPreview: () => void;
  isPreviewing: boolean;
  onApply: (settings: AntiRecognitionSettings) => Promise<void>;
  isProcessing: boolean;
}

export const AntiScanTab: React.FC<AntiScanTabProps> = ({
  hasBuffer,
  onPreview,
  onStopPreview,
  isPreviewing,
  onApply,
  isProcessing,
}) => {
  const [settings, setSettings] = useState<AntiRecognitionSettings>(DEFAULT_ANTI_RECOGNITION_SETTINGS);

  const evaluation = useMemo(() => calculateStealthScore(settings), [settings]);

  const updateSetting = <K extends keyof AntiRecognitionSettings>(
    key: K,
    value: AntiRecognitionSettings[K]
  ) => {
    const next = { ...settings, [key]: value, preset: 'custom' as AntiScanPreset };
    setSettings(next);
    if (isPreviewing) {
      onPreview(next);
    }
  };

  const handleSelectPreset = (presetKey: AntiScanPreset) => {
    const presetData = ANTI_RECOGNITION_PRESETS[presetKey];
    const next: AntiRecognitionSettings = {
      enabled: true,
      preset: presetKey,
      ...presetData.settings,
    };
    setSettings(next);
    if (isPreviewing) {
      onPreview(next);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_ANTI_RECOGNITION_SETTINGS);
    if (isPreviewing) onStopPreview();
  };

  return (
    <div className="flex flex-col gap-5 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Công Nghệ Chống Quét Nhận Diện Bài Hát & Content ID (Bao gồm SUNO AI)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Tích hợp bộ giải trừ Watermark ngầm siêu tần của SUNO AI, phá vỡ chòm sao dấu vân tay âm thanh (Landmark Peaks) và lưới thời gian FFT để vượt qua kiểm duyệt bản quyền tự động trên YouTube, SUNO AI, TikTok, Facebook và phân phối nhạc trực tuyến.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Mặc định</span>
        </button>
      </div>

      {/* Stealth Score Meter & Realtime Evaluation */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-inner">
            <span className="text-xl font-extrabold font-mono text-emerald-400">
              {evaluation.score}%
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Độ Tàng Hình Ước Tính:</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${evaluation.badgeColor}`}>
                {evaluation.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
              Hệ thống kết hợp các kỹ thuật vi dịch cao độ, khử watermark Suno, phá đỉnh phổ FFT, lệch pha Stereo và màng che tri giác để làm sai lệch hoàn toàn mã băm nhận diện.
            </p>
          </div>
        </div>

        {/* Active Defense Badges */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto md:max-w-md justify-start md:justify-end">
          {evaluation.activeDefenses.map((defense, idx) => (
            <span
              key={idx}
              className="text-[10px] font-medium px-2 py-1 rounded bg-slate-900/90 text-slate-300 border border-slate-800 flex items-center gap-1"
            >
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{defense}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Preset Cards Selection */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Chọn Chế Độ Bảo Vệ Định Sẵn (Presets)
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            {
              id: 'suno' as AntiScanPreset,
              title: 'SUNO AI Content ID',
              sub: 'Khử Watermark & Vết AI',
              icon: Bot,
              color: 'text-amber-300',
              activeBorder: 'border-amber-400 bg-amber-950/40',
              highlightBadge: 'Hot AI',
            },
            {
              id: 'youtube' as AntiScanPreset,
              title: 'YouTube & FB Content ID',
              sub: 'Khuyên dùng cho Video',
              icon: Zap,
              color: 'text-amber-400',
              activeBorder: 'border-amber-500 bg-amber-950/30',
            },
            {
              id: 'tiktok' as AntiScanPreset,
              title: 'TikTok & Reels / Shorts',
              sub: 'Tăng nhịp +6% sôi động',
              icon: Sparkles,
              color: 'text-rose-400',
              activeBorder: 'border-rose-500 bg-rose-950/30',
            },
            {
              id: 'shazam' as AntiScanPreset,
              title: 'Chống Shazam & ACRCloud',
              sub: 'Phá đỉnh chòm sao phổ',
              icon: Radio,
              color: 'text-cyan-400',
              activeBorder: 'border-cyan-500 bg-cyan-950/30',
            },
            {
              id: 'audiophile' as AntiScanPreset,
              title: 'Bảo Toàn Âm Sắc Tự Nhiên',
              sub: 'Gần như không đổi chất âm',
              icon: Headphones,
              color: 'text-emerald-400',
              activeBorder: 'border-emerald-500 bg-emerald-950/30',
            },
            {
              id: 'maximum' as AntiScanPreset,
              title: 'Tàng Hình Toàn Diện',
              sub: 'Bảo vệ mạnh nhất mọi bot',
              icon: EyeOff,
              color: 'text-purple-400',
              activeBorder: 'border-purple-500 bg-purple-950/30',
            },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = settings.preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPreset(item.id)}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? `${item.activeBorder} shadow-md ring-1 ring-amber-500/30`
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  {item.highlightBadge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {item.highlightBadge}
                    </span>
                  )}
                  {isSelected && !item.highlightBadge && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">{item.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detailed Defense Layer Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Layer 1: Pitch & Tempo Micro-Warping */}
        <div className="flex flex-col gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <AudioWaveform className="w-4 h-4 text-cyan-400" />
              Lớp 1: Vi Dịch Cao Độ & Tốc Độ (Micro-Warping)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Vi chỉnh cao độ (Pitch Shift):</span>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.pitchCents > 0 ? `+${settings.pitchCents}` : settings.pitchCents} cents ({Math.round(settings.pitchCents * 10) / 1000} nửa cung)
              </span>
            </div>
            <input
              type="range"
              min="-80"
              max="80"
              step="1"
              value={settings.pitchCents}
              onChange={(e) => updateSetting('pitchCents', parseInt(e.target.value) || 0)}
              className="accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>-80 cents</span>
              <span>0 (Nguyên bản)</span>
              <span>+40 (Chuẩn)</span>
              <span>+80 cents</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Vi chỉnh tốc độ (Tempo Shift):</span>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.tempoPercent}% ({(settings.tempoPercent / 100).toFixed(2)}x)
              </span>
            </div>
            <input
              type="range"
              min="96"
              max="112"
              step="0.5"
              value={settings.tempoPercent}
              onChange={(e) => updateSetting('tempoPercent', parseFloat(e.target.value) || 100)}
              className="accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>96% (Chậm nhẹ)</span>
              <span>100% (Gốc)</span>
              <span>104% (Tối ưu)</span>
              <span>112% (Nhanh)</span>
            </div>
          </div>
        </div>

        {/* Layer 2: Spectral Landmark Notch Scrambler */}
        <div className="flex flex-col gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.spectralNotch}
                onChange={(e) => updateSetting('spectralNotch', e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-amber-400" />
                Lớp 2: Bộ Phá Đỉnh Chòm Sao Phổ FFT
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.spectralNotch ? 'text-amber-400' : 'text-slate-400'}`}>
              {settings.spectralNotch ? `Bật (${settings.notchIntensity} dải notch)` : 'Tắt'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Số lượng dải mốc bị triệt tiêu (Landmark Notches):</span>
              <span className="font-mono text-amber-400 font-bold">{settings.notchIntensity} / 5 tần số</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              disabled={!settings.spectralNotch}
              value={settings.notchIntensity}
              onChange={(e) => updateSetting('notchIntensity', parseInt(e.target.value) || 1)}
              className="accent-amber-400 disabled:opacity-40 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 dải (1.18 kHz)</span>
              <span>3 dải</span>
              <span>5 dải (Toàn diện)</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-900/80 border border-slate-800/80 text-[10px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Đặt các bộ lọc notch siêu hẹp (Q=7.5) tại các vị trí tần số mà Shazam & Content ID thường dùng để bắt cặp mã băm nhận diện.
            </span>
          </div>
        </div>

        {/* Layer 3: Stereo Phase Decorrelation */}
        <div className="flex flex-col gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.stereoPhaseShift}
                onChange={(e) => updateSetting('stereoPhaseShift', e.target.checked)}
                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-purple-400" />
                Lớp 3: Lệch Pha Stereo (Chống Gộp Mono)
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.stereoPhaseShift ? 'text-purple-400' : 'text-slate-400'}`}>
              {settings.stereoPhaseShift ? `${settings.stereoDelayMs} ms` : 'Tắt'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Độ lệch pha kênh phải (Haas Delay):</span>
              <span className="font-mono text-purple-400 font-bold">{settings.stereoDelayMs} ms</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              disabled={!settings.stereoPhaseShift}
              value={settings.stereoDelayMs}
              onChange={(e) => updateSetting('stereoDelayMs', parseFloat(e.target.value) || 2.0)}
              className="accent-purple-400 disabled:opacity-40 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0.5 ms (Tinh tế)</span>
              <span>2.4 ms (Lý tưởng)</span>
              <span>5.0 ms (Stereo rộng)</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-900/80 border border-slate-800/80 text-[10px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>
              Bot quét nhận diện thường gộp stereo về mono (L+R). Hiệu ứng lệch pha tạo ra triệt tiêu sóng tri giác khi bot quét gộp kênh.
            </span>
          </div>
        </div>

        {/* Layer 4: Psychoacoustic Masking & Micro-Vibrato */}
        <div className="flex flex-col gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.noiseMasking}
                onChange={(e) => updateSetting('noiseMasking', e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Lớp 4: Màng Che Tri Giác Dither
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.noiseMasking ? 'text-emerald-400' : 'text-slate-400'}`}>
              {settings.noiseMasking ? `${settings.noiseAmountDb} dB` : 'Tắt'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Cường độ màng che tri giác (Inaudible Dither):</span>
              <span className="font-mono text-emerald-400 font-bold">{settings.noiseAmountDb} dB</span>
            </div>
            <input
              type="range"
              min="-60"
              max="-35"
              step="1"
              disabled={!settings.noiseMasking}
              value={settings.noiseAmountDb}
              onChange={(e) => updateSetting('noiseAmountDb', parseInt(e.target.value) || -44)}
              className="accent-emerald-400 disabled:opacity-40 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>-60 dB (Siêu nhỏ)</span>
              <span>-44 dB (Khuyên dùng)</span>
              <span>-35 dB</span>
            </div>
          </div>

          {/* Micro-Vibrato Toggle & Slider */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.microVibrato}
                  onChange={(e) => updateSetting('microVibrato', e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-slate-300">
                  Lớp 5: Vi Dao Động Cao Độ Động (Micro-Vibrato)
                </span>
              </label>
              <span className={`text-xs font-mono ${settings.microVibrato ? 'text-rose-400' : 'text-slate-400'}`}>
                {settings.microVibrato ? `${settings.vibratoDepth} cents @ ${settings.vibratoRate}Hz` : 'Tắt'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">Độ sâu: {settings.vibratoDepth} cents</span>
                <input
                  type="range"
                  min="4"
                  max="25"
                  step="1"
                  disabled={!settings.microVibrato}
                  value={settings.vibratoDepth}
                  onChange={(e) => updateSetting('vibratoDepth', parseInt(e.target.value) || 10)}
                  className="accent-rose-400 disabled:opacity-40 cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">Tần số: {settings.vibratoRate} Hz</span>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  disabled={!settings.microVibrato}
                  value={settings.vibratoRate}
                  onChange={(e) => updateSetting('vibratoRate', parseFloat(e.target.value) || 1.0)}
                  className="accent-rose-400 disabled:opacity-40 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated SUNO AI Content ID & Watermark Shield Layer */}
      <div className="flex flex-col gap-3.5 p-4 bg-gradient-to-br from-amber-950/30 via-slate-950/70 to-slate-950 border border-amber-500/40 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-200 uppercase tracking-wide flex items-center gap-1.5">
                Lớp Chuyên Biệt SUNO AI: Khử Watermark & Vượt Quét Content ID
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  Bản quyền AI
                </span>
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Vô hiệu hóa watermark ngầm siêu âm và biến đổi cấu trúc pha của mô hình khuếch tán Suno để đăng tải YouTube, TikTok, Facebook và phân phối DistroKid/TuneCore an toàn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectPreset('suno')}
              className="text-[11px] font-semibold px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Nạp cấu hình Suno chuẩn</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sub-feature 1: Watermark Scrambler */}
          <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.sunoWatermarkScrambler}
                  onChange={(e) => updateSetting('sunoWatermarkScrambler', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold text-amber-300">
                  Khử Watermark Ngầm Siêu Tần (15.2 - 18.5 kHz)
                </span>
              </label>
              <span className={`text-[11px] font-mono font-bold ${settings.sunoWatermarkScrambler ? 'text-amber-400' : 'text-slate-400'}`}>
                {settings.sunoWatermarkScrambler ? 'Đang kích hoạt' : 'Đã tắt'}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Suno AI nhúng watermark vô hình dạng phase spread-spectrum ở dải tần số 15 kHz–18.5 kHz. Bộ lọc notch hẹp Q=8.5 triệt tiêu các dải sóng mang này mà không làm ảnh hưởng đến độ trong trẻo của cymbal, hi-hat hay giọng hát.
            </p>
          </div>

          {/* Sub-feature 2: De-AI Vocoder & Analog Warmth */}
          <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.sunoDeVocoder}
                  onChange={(e) => updateSetting('sunoDeVocoder', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold text-amber-300">
                  Khử Vân Tay Neural Vocoder & Phá Vỡ Tính Phẳng AI
                </span>
              </label>
              <span className={`text-[11px] font-mono font-bold ${settings.sunoDeVocoder ? 'text-amber-400' : 'text-slate-400'}`}>
                {settings.sunoDeVocoder ? `Bật (${settings.sunoWarmth}/10)` : 'Đã tắt'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Độ ấm hài âm Analog (Analog Tape Warmth):</span>
                <span className="font-mono text-amber-400 font-bold">Mức {settings.sunoWarmth} / 10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                disabled={!settings.sunoDeVocoder}
                value={settings.sunoWarmth}
                onChange={(e) => updateSetting('sunoWarmth', parseInt(e.target.value) || 0)}
                className="accent-amber-400 disabled:opacity-40 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 (Không bão hòa)</span>
                <span>5 (Chuẩn Studio)</span>
                <span>10 (Ấm dày analog)</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Bơm các hài âm chẵn/lẻ tự nhiên (Analog Saturation) và lọc giảm sự chói gắt số ở dải 3.6 kHz giúp xóa bỏ dấu vết toán học của bộ vocoder tổng hợp AI, khiến bài hát mang âm hưởng thu âm acoustic chân thực.
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer: Preview & Apply */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Bản quyền âm thanh đã xử lý có thể tải về dạng MP3 hoặc WAV và tự tin đăng tải lên các nền tảng mạng xã hội.
          </span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={isPreviewing ? onStopPreview : () => onPreview(settings)}
            disabled={!hasBuffer || isProcessing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isPreviewing
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-700 hover:border-emerald-500 text-slate-200 hover:text-emerald-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isPreviewing ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>Dừng nghe thử</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Nghe thử chống quét</span>
              </>
            )}
          </button>

          <button
            onClick={() => onApply(settings)}
            disabled={!hasBuffer || isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý thuật toán bảo vệ...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Áp dụng chống quét nhận diện</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
