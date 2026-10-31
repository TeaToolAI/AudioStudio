/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  Radio,
  AudioWaveform,
  VolumeX,
  Play,
  Square,
  Check,
  RotateCcw,
  Sparkles,
  Bot,
  Loader2,
  Flame,
  Waves,
  SlidersHorizontal,
} from 'lucide-react';
import { EffectSettings } from '../../types/audio';
import { DEFAULT_EFFECT_SETTINGS } from '../../services/audioEffects';

interface EffectsTabProps {
  hasBuffer: boolean;
  onPreviewEffects: (settings: EffectSettings) => void;
  onStopPreview: () => void;
  isPreviewing: boolean;
  onApplyEffects: (settings: EffectSettings) => Promise<void>;
  isProcessing: boolean;
}

export const EffectsTab: React.FC<EffectsTabProps> = ({
  hasBuffer,
  onPreviewEffects,
  onStopPreview,
  isPreviewing,
  onApplyEffects,
  isProcessing,
}) => {
  const [settings, setSettings] = useState<EffectSettings>(DEFAULT_EFFECT_SETTINGS);

  const updateSetting = <K extends keyof EffectSettings>(key: K, value: EffectSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (isPreviewing) {
      onPreviewEffects(next);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_EFFECT_SETTINGS);
    if (isPreviewing) onStopPreview();
  };

  const hasModifications =
    settings.noiseReductionAmount > 0 ||
    settings.highPassCutoff > 25 ||
    settings.lowPassCutoff < 19500 ||
    settings.delayEnabled ||
    settings.reverbEnabled ||
    settings.distortionEnabled ||
    settings.chorusEnabled ||
    settings.compressorEnabled ||
    settings.voicePreset !== 'none';

  return (
    <div className="flex flex-col gap-5 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Bộ Lọc Nhiễu & Hiệu Ứng Âm Thanh Chuyên Nghiệp
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Lọc tạp âm phòng, khử tiếng xì rè mic, thêm độ vang Reverb, tiếng vọng Echo và biến đổi giọng nói.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Đặt lại</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Section 1: Noise Reduction & Noise Gate */}
        <div className="flex flex-col gap-3.5 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Bộ Lọc Nhiễu (De-Noise & Gate)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              {settings.noiseReductionAmount}%
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Mức lọc tạp âm (Noise Reduction)</span>
              <span>{settings.noiseReductionAmount > 0 ? 'Đang bật' : 'Tắt'}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.noiseReductionAmount}
              onChange={(e) => updateSetting('noiseReductionAmount', parseInt(e.target.value))}
              className="accent-emerald-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Ngưỡng cắt ồn (Noise Gate Threshold)</span>
              <span className="text-emerald-400 font-mono">{settings.noiseGateThreshold} dB</span>
            </div>
            <input
              type="range"
              min="-60"
              max="-20"
              step="1"
              value={settings.noiseGateThreshold}
              onChange={(e) => updateSetting('noiseGateThreshold', parseInt(e.target.value))}
              className="accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Quick presets for noise */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 mr-1">Chế độ:</span>
            <button
              onClick={() => {
                updateSetting('noiseReductionAmount', 30);
                updateSetting('noiseGateThreshold', -48);
              }}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Phòng yên tĩnh
            </button>
            <button
              onClick={() => {
                updateSetting('noiseReductionAmount', 60);
                updateSetting('noiseGateThreshold', -40);
              }}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Khử tiếng quạt
            </button>
            <button
              onClick={() => {
                updateSetting('noiseReductionAmount', 85);
                updateSetting('noiseGateThreshold', -32);
              }}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Môi trường ồn
            </button>
          </div>
        </div>

        {/* Section 2: Low-Pass & High-Pass Cutoff Filters */}
        <div className="flex flex-col gap-3.5 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <AudioWaveform className="w-4 h-4 text-cyan-400" />
            Bộ Lọc Tần Số Cắt (Pass Filters)
          </span>

          {/* High Pass */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>High-pass (Cắt âm ù rền dưới đáy)</span>
              <span className="text-cyan-400 font-mono">{settings.highPassCutoff} Hz</span>
            </div>
            <input
              type="range"
              min="20"
              max="500"
              step="10"
              value={settings.highPassCutoff}
              onChange={(e) => updateSetting('highPassCutoff', parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>20 Hz (Tắt)</span>
              <span>80 Hz (Khử rung gió mic)</span>
              <span>500 Hz</span>
            </div>
          </div>

          {/* Low Pass */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Low-pass (Cắt âm chói cao tần)</span>
              <span className="text-cyan-400 font-mono">
                {settings.lowPassCutoff >= 19500 ? 'Tắt' : `${settings.lowPassCutoff} Hz`}
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max="20000"
              step="500"
              value={settings.lowPassCutoff}
              onChange={(e) => updateSetting('lowPassCutoff', parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 kHz (Ấm / Ngột)</span>
              <span>8 kHz (Cắt rít)</span>
              <span>20 kHz (Tắt)</span>
            </div>
          </div>
        </div>

        {/* Section 3: Dynamics Compressor (Threshold, Ratio, Attack, Release) */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.compressorEnabled}
                onChange={(e) => updateSetting('compressorEnabled', e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                Bộ Nén Dải Động (Dynamics Compressor)
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.compressorEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
              {settings.compressorEnabled
                ? `Đang bật (Ngưỡng: ${settings.compressorThreshold} dB | Tỉ lệ: ${settings.compressorRatio}:1)`
                : 'Tắt'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Threshold Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-emerald-300">Ngưỡng (Threshold):</span>
                <span className="font-mono text-emerald-400 font-bold">{settings.compressorThreshold} dB</span>
              </div>
              <input
                type="range"
                min="-60"
                max="0"
                step="1"
                disabled={!settings.compressorEnabled}
                value={settings.compressorThreshold}
                onChange={(e) => updateSetting('compressorThreshold', parseInt(e.target.value) || 0)}
                className="accent-emerald-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Mức âm lượng bắt đầu kích hoạt nén tín hiệu
              </span>
            </div>

            {/* Ratio Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-emerald-300">Tỉ lệ (Ratio):</span>
                <span className="font-mono text-emerald-400 font-bold">{settings.compressorRatio}:1</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                disabled={!settings.compressorEnabled}
                value={settings.compressorRatio}
                onChange={(e) => updateSetting('compressorRatio', parseFloat(e.target.value) || 1)}
                className="accent-emerald-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Mức độ giảm biên độ tín hiệu khi vượt ngưỡng
              </span>
            </div>

            {/* Attack Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-emerald-300">Kích hoạt (Attack):</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {Math.round(settings.compressorAttack * 1000)} ms
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="500"
                step="1"
                disabled={!settings.compressorEnabled}
                value={Math.round(settings.compressorAttack * 1000)}
                onChange={(e) =>
                  updateSetting('compressorAttack', (parseInt(e.target.value) || 25) / 1000)
                }
                className="accent-emerald-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Thời gian phản ứng giảm âm (1ms nhanh ➔ 500ms êm)
              </span>
            </div>

            {/* Release Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-emerald-300">Phục hồi (Release):</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {Math.round(settings.compressorRelease * 1000)} ms
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                disabled={!settings.compressorEnabled}
                value={Math.round(settings.compressorRelease * 1000)}
                onChange={(e) =>
                  updateSetting('compressorRelease', (parseInt(e.target.value) || 250) / 1000)
                }
                className="accent-emerald-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Thời gian đưa âm lượng trở về bình thường
              </span>
            </div>
          </div>

          {/* Quick Presets for Compressor */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-400 mr-1">Preset nén:</span>
            {[
              { label: 'Làm đều giọng (Vocal Level)', threshold: -22, ratio: 3, attack: 0.02, release: 0.22 },
              { label: 'Trống lực & Chắc (Punchy Drums)', threshold: -16, ratio: 5, attack: 0.035, release: 0.1 },
              { label: 'Gắn kết Master (Master Glue)', threshold: -12, ratio: 2, attack: 0.03, release: 0.3 },
              { label: 'Phát thanh Podcast (Broadcast)', threshold: -24, ratio: 4, attack: 0.015, release: 0.18 },
              { label: 'Nén chặt mạnh (Heavy Squeeze)', threshold: -32, ratio: 10, attack: 0.005, release: 0.08 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const next: EffectSettings = {
                    ...settings,
                    compressorEnabled: true,
                    compressorThreshold: p.threshold,
                    compressorRatio: p.ratio,
                    compressorAttack: p.attack,
                    compressorRelease: p.release,
                  };
                  setSettings(next);
                  if (isPreviewing) onPreviewEffects(next);
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 border border-slate-700/80 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Reverb (Decay Time & Wet/Dry Mix) */}
        <div className="flex flex-col gap-3.5 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.reverbEnabled}
                onChange={(e) => updateSetting('reverbEnabled', e.target.checked)}
                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Vang Không Gian (Reverb)
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.reverbEnabled ? 'text-purple-400' : 'text-slate-400'}`}>
              {settings.reverbEnabled
                ? `${settings.reverbDecay.toFixed(1)}s | Mix ${Math.round(settings.reverbMix > 1 ? settings.reverbMix : settings.reverbMix * 100)}%`
                : 'Tắt'}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {/* Decay Time */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span className="font-medium">Thời gian phân rã (Decay Time):</span>
                <span className="font-mono text-purple-400 font-bold">{settings.reverbDecay.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="7.0"
                step="0.1"
                disabled={!settings.reverbEnabled}
                value={settings.reverbDecay}
                onChange={(e) => updateSetting('reverbDecay', parseFloat(e.target.value) || 2.0)}
                className="accent-purple-400 disabled:opacity-40 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0.5s (Phòng nhỏ)</span>
                <span>2.0s (Hội trường)</span>
                <span>7.0s (Vô tận)</span>
              </div>
            </div>

            {/* Wet / Dry Mix */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span className="font-medium">Mức hòa trộn (Wet/Dry Mix):</span>
                <span className="font-mono text-purple-400 font-bold">
                  {Math.round(settings.reverbMix > 1 ? settings.reverbMix : settings.reverbMix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!settings.reverbEnabled}
                value={Math.round(settings.reverbMix > 1 ? settings.reverbMix : settings.reverbMix * 100)}
                onChange={(e) => updateSetting('reverbMix', parseInt(e.target.value) || 0)}
                className="accent-purple-400 disabled:opacity-40 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0% (Thuần mộc / Dry)</span>
                <span>50% (Cân bằng)</span>
                <span>100% (Thuần vang / Wet)</span>
              </div>
            </div>

            {/* Presets for Reverb */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 mr-1">Không gian:</span>
              {[
                { label: 'Phòng thu (Room)', decay: 0.8, mix: 18 },
                { label: 'Khán phòng (Hall)', decay: 2.2, mix: 32 },
                { label: 'Nhà thờ (Cathedral)', decay: 4.5, mix: 48 },
                { label: 'Ambient vũ trụ', decay: 6.5, mix: 65 },
                { label: 'Ấm nhẹ (Subtle)', decay: 1.2, mix: 15 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    const next: EffectSettings = {
                      ...settings,
                      reverbEnabled: true,
                      reverbDecay: p.decay,
                      reverbMix: p.mix,
                    };
                    setSettings(next);
                    if (isPreviewing) onPreviewEffects(next);
                  }}
                  className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-purple-300 border border-slate-700/70 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 5: Delay & Echo */}
        <div className="flex flex-col gap-3.5 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.delayEnabled}
                onChange={(e) => updateSetting('delayEnabled', e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-amber-400" />
                Echo / Delay (Vọng lại)
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.delayEnabled ? 'text-amber-400' : 'text-slate-400'}`}>
              {settings.delayEnabled ? 'Đang bật' : 'Tắt'}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Thời gian trễ (Time):</span>
              <span className="text-amber-400 font-mono font-bold">{settings.delayTime}s</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              disabled={!settings.delayEnabled}
              value={settings.delayTime}
              onChange={(e) => updateSetting('delayTime', parseFloat(e.target.value))}
              className="accent-amber-400 disabled:opacity-40 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Lặp lại (Feedback):</span>
              <span className="text-amber-400 font-mono font-bold">{Math.round(settings.delayFeedback * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.85"
              step="0.05"
              disabled={!settings.delayEnabled}
              value={settings.delayFeedback}
              onChange={(e) => updateSetting('delayFeedback', parseFloat(e.target.value))}
              className="accent-amber-400 disabled:opacity-40 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Mức hòa trộn (Mix):</span>
              <span className="text-amber-400 font-mono font-bold">{Math.round(settings.delayMix * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              disabled={!settings.delayEnabled}
              value={settings.delayMix}
              onChange={(e) => updateSetting('delayMix', parseFloat(e.target.value))}
              className="accent-amber-400 disabled:opacity-40 cursor-pointer"
            />
          </div>
        </div>

        {/* Section 6: Voice Changer Presets */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-cyan-400" />
              Biến Đổi Giọng Nói (Voice Changer Presets)
            </span>
            <span className="text-xs font-mono text-cyan-400">
              {settings.voicePreset === 'none' ? 'Bình thường' : `Đang bật: ${settings.voicePreset}`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
            {[
              { id: 'none', label: 'Bình thường' },
              { id: 'deep', label: 'Trầm nam' },
              { id: 'chipmunk', label: 'Sóc chuột' },
              { id: 'robot', label: 'Robot' },
              { id: 'radio', label: 'Đài Radio' },
              { id: 'telephone', label: 'Điện thoại' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => updateSetting('voicePreset', item.id as EffectSettings['voicePreset'])}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-center ${
                  settings.voicePreset === item.id
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 5: Distortion & Overdrive (Drive, Tone, Level) */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.distortionEnabled}
                onChange={(e) => updateSetting('distortionEnabled', e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-400" />
                Méo Tiếng & Bão Hoà (Distortion / Overdrive)
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.distortionEnabled ? 'text-orange-400' : 'text-slate-400'}`}>
              {settings.distortionEnabled ? `Đang bật (Drive: ${settings.distortionDrive}%)` : 'Tắt'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Drive Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-orange-300">Độ méo (Drive):</span>
                <span className="font-mono text-orange-400 font-bold">{settings.distortionDrive}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!settings.distortionEnabled}
                value={settings.distortionDrive}
                onChange={(e) => updateSetting('distortionDrive', parseInt(e.target.value) || 0)}
                className="accent-orange-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Tăng độ bão hoà mô phỏng bóng đèn chân không (Tube Saturation)
              </span>
            </div>

            {/* Tone Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-orange-300">Âm sắc (Tone):</span>
                <span className="font-mono text-orange-400 font-bold">
                  {settings.distortionTone}% ({settings.distortionTone < 35 ? 'Trầm ấm' : settings.distortionTone > 65 ? 'Đanh sáng' : 'Cân bằng'})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!settings.distortionEnabled}
                value={settings.distortionTone}
                onChange={(e) => updateSetting('distortionTone', parseInt(e.target.value) || 0)}
                className="accent-orange-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Lọc tần số sau méo tiếng: 0% trầm ấm ➔ 100% đanh gắt sắc bén
              </span>
            </div>

            {/* Level Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-orange-300">Âm lượng ra (Level):</span>
                <span className="font-mono text-orange-400 font-bold">{settings.distortionLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!settings.distortionEnabled}
                value={settings.distortionLevel}
                onChange={(e) => updateSetting('distortionLevel', parseInt(e.target.value) || 0)}
                className="accent-orange-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Bù trừ âm lượng đầu ra sau khi khuếch đại méo tiếng
              </span>
            </div>
          </div>

          {/* Quick Presets for Distortion */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-400 mr-1">Preset gợi ý:</span>
            {[
              { label: 'Ấm đèn (Warm Tube)', drive: 20, tone: 40, level: 85 },
              { label: 'Overdrive nhẹ (Crunch)', drive: 45, tone: 50, level: 80 },
              { label: 'Fuzz cổ điển (Vintage Fuzz)', drive: 75, tone: 35, level: 65 },
              { label: 'Heavy Metal (Distortion mạnh)', drive: 95, tone: 80, level: 60 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const next: EffectSettings = {
                    ...settings,
                    distortionEnabled: true,
                    distortionDrive: p.drive,
                    distortionTone: p.tone,
                    distortionLevel: p.level,
                  };
                  setSettings(next);
                  if (isPreviewing) onPreviewEffects(next);
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-orange-300 border border-slate-700/80 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 6: Chorus / Spatial Widening (Depth, Rate, Mix) */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.chorusEnabled}
                onChange={(e) => updateSetting('chorusEnabled', e.target.checked)}
                className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-violet-400" />
                Điệp Ca & Mở Rộng Không Gian (Chorus / Stereo Widening)
              </span>
            </label>
            <span className={`text-xs font-mono font-medium ${settings.chorusEnabled ? 'text-violet-400' : 'text-slate-400'}`}>
              {settings.chorusEnabled
                ? `Đang bật (${settings.chorusRate} Hz | Độ sâu ${settings.chorusDepth}% | Mix ${settings.chorusMix}%)`
                : 'Tắt'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Depth Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-violet-300">Độ sâu (Depth):</span>
                <span className="font-mono text-violet-400 font-bold">{settings.chorusDepth}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!settings.chorusEnabled}
                value={settings.chorusDepth}
                onChange={(e) => updateSetting('chorusDepth', parseInt(e.target.value) || 0)}
                className="accent-violet-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Biên độ giãn nở thời gian trễ, giúp âm thanh trở nên dày dặn và ngân vang
              </span>
            </div>

            {/* Rate Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-violet-300">Tốc độ (Rate):</span>
                <span className="font-mono text-violet-400 font-bold">{settings.chorusRate.toFixed(1)} Hz</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="8.0"
                step="0.1"
                disabled={!settings.chorusEnabled}
                value={settings.chorusRate}
                onChange={(e) => updateSetting('chorusRate', parseFloat(e.target.value) || 1.5)}
                className="accent-violet-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Tần số điều chế LFO: 0.2 Hz bồng bềnh chậm rãi ➔ 8.0 Hz rung shimmer dồn dập
              </span>
            </div>

            {/* Mix Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-violet-300">Mức hòa trộn (Mix):</span>
                <span className="font-mono text-violet-400 font-bold">{settings.chorusMix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!settings.chorusEnabled}
                value={settings.chorusMix}
                onChange={(e) => updateSetting('chorusMix', parseInt(e.target.value) || 0)}
                className="accent-violet-400 disabled:opacity-40 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Cân bằng giữa âm thanh mộc ban đầu và lớp âm thanh điệp ca stereo mở rộng
              </span>
            </div>
          </div>

          {/* Quick Presets for Chorus */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-400 mr-1">Preset gợi ý:</span>
            {[
              { label: 'Dày tự nhiên (Natural Thick)', depth: 60, rate: 1.5, mix: 50 },
              { label: 'Dịu nhẹ (Subtle Shimmer)', depth: 35, rate: 0.8, mix: 35 },
              { label: 'Cổ điển 80s (80s Lush)', depth: 75, rate: 2.2, mix: 65 },
              { label: 'Stereo Siêu Rộng (Wide Stereo)', depth: 90, rate: 1.2, mix: 75 },
              { label: 'Rung nhanh (Fast Vibrato)', depth: 45, rate: 5.5, mix: 60 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const next: EffectSettings = {
                    ...settings,
                    chorusEnabled: true,
                    chorusDepth: p.depth,
                    chorusRate: p.rate,
                    chorusMix: p.mix,
                  };
                  setSettings(next);
                  if (isPreviewing) onPreviewEffects(next);
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-violet-300 border border-slate-700/80 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800">
        <button
          onClick={isPreviewing ? onStopPreview : () => onPreviewEffects(settings)}
          disabled={!hasBuffer || isProcessing}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isPreviewing
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-slate-800 border-slate-700 hover:border-cyan-500 text-slate-200 hover:text-cyan-300'
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
              <span>Nghe thử hiệu ứng</span>
            </>
          )}
        </button>

        <button
          onClick={() => onApplyEffects(settings)}
          disabled={!hasBuffer || isProcessing || !hasModifications}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang áp dụng hiệu ứng...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Áp dụng hiệu ứng</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
