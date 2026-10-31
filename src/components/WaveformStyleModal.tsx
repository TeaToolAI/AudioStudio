/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Palette,
  X,
  Sparkles,
  Sliders,
  Grid,
  AudioWaveform,
  Check,
  ShieldCheck,
  Zap,
  Activity,
} from 'lucide-react';
import { WaveformRenderConfig, WaveformTemplate } from '../types/audio';

interface WaveformStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WaveformRenderConfig;
  onChangeConfig: (newConfig: WaveformRenderConfig) => void;
}

interface TemplateOption {
  id: WaveformTemplate;
  name: string;
  tagline: string;
  badge: string;
  icon: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'classic',
    name: 'Studio Cổ Điển (Classic Bars)',
    tagline: 'Thanh đứng đối xứng qua trục 0dB, gradient mượt mà chuẩn phòng thu DAW.',
    badge: 'Tiêu chuẩn',
    icon: '📊',
  },
  {
    id: 'smooth',
    name: 'Đường Cong Mềm (Smooth Curve)',
    tagline: 'Đường sóng uốn lượn Bezier liên tục với đổ bóng mềm mại (như SoundCloud).',
    badge: 'Hiện đại',
    icon: '🌊',
  },
  {
    id: 'neon',
    name: 'Neon Cyberpunk / Laser',
    tagline: 'Sóng tím hồng rực rỡ phát quang (Bloom glow), lưới ma trận và tia laser đỉnh.',
    badge: 'Viễn tưởng',
    icon: '⚡',
  },
  {
    id: 'led',
    name: 'Đèn LED Ma Trận (VU Meter Dots)',
    tagline: 'Cột chấm tròn LED chuyển màu Xanh (êm) ➔ Vàng (ấm) ➔ Đỏ (đỉnh peak) như mixer.',
    badge: 'Analog Vintage',
    icon: '🟢',
  },
  {
    id: 'stereo',
    name: 'Tách 2 Kênh Stereo (L / R Split)',
    tagline: 'Vẽ độc lập kênh Trái (L - Cyan) và Phải (R - Orange) để kiểm soát độ rộng âm trường.',
    badge: 'Kỹ thuật Stereo',
    icon: '🎧',
  },
  {
    id: 'oscilloscope',
    name: 'Máy Hiện Sóng (CRT Oscilloscope)',
    tagline: 'Màn hình huỳnh quang Phosphor xanh lá cổ điển với lưới tọa độ phòng thí nghiệm.',
    badge: 'Hoài niệm Retro',
    icon: '📡',
  },
];

const COLOR_OPTIONS: { id: WaveformRenderConfig['colorScheme']; name: string; hex: string }[] = [
  { id: 'cyan', name: 'Cyan Studio', hex: '#06b6d4' },
  { id: 'neon', name: 'Hot Neon', hex: '#ec4899' },
  { id: 'amber', name: 'Sunset Amber', hex: '#f59e0b' },
  { id: 'emerald', name: 'Emerald Green', hex: '#10b981' },
  { id: 'crimson', name: 'Crimson Ruby', hex: '#e11d48' },
  { id: 'silver', name: 'Silver Metal', hex: '#94a3b8' },
];

export const WaveformStyleModal: React.FC<WaveformStyleModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-base">
              Mẫu Sóng & Lớp Phủ Phổ Spectrogram
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          {/* Reassurance Banner */}
          <div className="flex items-center gap-3 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>
              <strong>Cam kết nguyên bản:</strong> Tính năng này chỉ thay đổi cách vẽ hình học và lớp phủ thị giác trên màn hình; âm thanh gốc và chất lượng xử lý/xuất file được giữ nguyên 100%.
            </span>
          </div>

          {/* Spectrogram Overlay Section */}
          <div className="flex flex-col gap-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5 cursor-pointer">
                <Activity className="w-4 h-4 text-purple-400" />
                Lớp Phủ Phổ Tần Số (Spectrogram 2D Overlay)
              </label>

              {/* Master Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-semibold text-slate-300">
                  {config.showSpectrogram ? 'Đang bật' : 'Tắt'}
                </span>
                <input
                  type="checkbox"
                  checked={config.showSpectrogram}
                  onChange={(e) => onChangeConfig({ ...config, showSpectrogram: e.target.checked })}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
              </label>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Phủ biểu đồ nhiệt tần số 2D (20Hz - 20kHz) bên dưới dạng sóng. Hiển thị dạng mờ nhẹ để quan sát chính xác các nốt nhạc, hài âm và tạp âm mà vẫn giữ trọn vẹn độ rõ nét của sóng âm thanh.
            </p>

            {config.showSpectrogram && (
              <div className="flex flex-col gap-3.5 pt-2 border-t border-slate-800">
                {/* Opacity Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span>Độ mờ lớp phủ (Opacity):</span>
                      <span className="text-[11px] text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800/60 font-mono font-bold">
                        {Math.round((config.spectrogramOpacity || 0.35) * 100)}%
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {(config.spectrogramOpacity || 0.35) <= 0.35 ? 'Mờ vừa (Sóng rất rõ)' : 'Đậm hơn'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.65"
                    step="0.05"
                    value={config.spectrogramOpacity || 0.35}
                    onChange={(e) => onChangeConfig({ ...config, spectrogramOpacity: parseFloat(e.target.value) })}
                    className="accent-purple-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>10% (Rất mờ)</span>
                    <span className="text-purple-400 font-semibold">35% (Khuyên dùng - Tối ưu)</span>
                    <span>65% (Rõ phổ)</span>
                  </div>
                </div>

                {/* Spectrogram Palette */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">Bảng màu nhiệt phổ (Heatmap Palettes):</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'magma' as const, name: 'Magma Heat', desc: 'Vàng cam tím' },
                      { id: 'viridis' as const, name: 'Viridis', desc: 'Lục vàng lam' },
                      { id: 'cyan' as const, name: 'Cyber Cyan', desc: 'Xanh băng kỹ thuật' },
                      { id: 'fire' as const, name: 'Fire Flame', desc: 'Đỏ cam lửa' },
                    ].map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => onChangeConfig({ ...config, spectrogramPalette: pal.id })}
                        className={`flex flex-col items-start p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          (config.spectrogramPalette || 'magma') === pal.id
                            ? 'bg-purple-950/70 border-purple-400 text-purple-200 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-200">{pal.name}</span>
                        <span className="text-[10px] text-slate-400">{pal.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6 Templates Selection */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <AudioWaveform className="w-4 h-4 text-cyan-400" />
              Chọn Mẫu Vẽ Sóng Âm (Templates):
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((tmpl) => {
                const isSelected = config.template === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => onChangeConfig({ ...config, template: tmpl.id })}
                    className={`relative flex flex-col gap-1.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{tmpl.icon}</span>
                        <span className="text-xs font-bold text-slate-100">{tmpl.name}</span>
                      </div>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                          {tmpl.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed pr-2">
                      {tmpl.tagline}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color Palettes Selection */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Bảng Màu Sóng Âm (Waveform Color Schemes):
            </label>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {COLOR_OPTIONS.map((color) => {
                const isSelected = config.colorScheme === color.id;
                return (
                  <button
                    key={color.id}
                    onClick={() => onChangeConfig({ ...config, colorScheme: color.id })}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-500 shadow-sm'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full shadow-inner border border-white/20"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-[11px] text-slate-300 font-medium">
                      {color.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles & Fine Adjustment */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Chi Tiết Đường Lưới & Độ Dày:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Glow Bloom Toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-xs text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Phát quang (Glow Bloom)
                </span>
                <input
                  type="checkbox"
                  checked={config.glowEffect}
                  onChange={(e) => onChangeConfig({ ...config, glowEffect: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </label>

              {/* Grid Lines Toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-xs text-slate-200 flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-cyan-400" />
                  Lưới dB kỹ thuật (Grid)
                </span>
                <input
                  type="checkbox"
                  checked={config.showGrid}
                  onChange={(e) => onChangeConfig({ ...config, showGrid: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </label>

              {/* Bar Width Slider */}
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Độ dày thanh sóng:</span>
                  <span className="font-mono text-cyan-400 font-bold">{config.barWidth} px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={config.barWidth}
                  onChange={(e) => onChangeConfig({ ...config, barWidth: parseInt(e.target.value) || 1 })}
                  className="accent-cyan-400 cursor-pointer mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950/80 border-t border-slate-800">
          <button
            onClick={() => {
              onChangeConfig({
                template: 'classic',
                colorScheme: 'cyan',
                showGrid: false,
                glowEffect: false,
                barWidth: 1,
                barGap: 0,
                showSpectrogram: false,
                spectrogramOpacity: 0.35,
                spectrogramPalette: 'magma',
              });
            }}
            className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
          >
            Khôi phục mặc định
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl transition-colors cursor-pointer"
          >
            Hoàn tất & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
