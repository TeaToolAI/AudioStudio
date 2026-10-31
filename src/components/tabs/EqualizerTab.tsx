/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, RotateCcw, Play, Square, Check, Loader2 } from 'lucide-react';
import { EQBand } from '../../types/audio';
import { EQ_FREQUENCIES, EQ_PRESETS } from '../../services/audioEffects';

interface EqualizerTabProps {
  hasBuffer: boolean;
  onPreviewEQ: (bands: EQBand[]) => void;
  onStopPreview: () => void;
  isPreviewing: boolean;
  onApplyEQ: (bands: EQBand[]) => Promise<void>;
  isProcessing: boolean;
}

export const EqualizerTab: React.FC<EqualizerTabProps> = ({
  hasBuffer,
  onPreviewEQ,
  onStopPreview,
  isPreviewing,
  onApplyEQ,
  isProcessing,
}) => {
  const [bands, setBands] = useState<EQBand[]>(() =>
    EQ_FREQUENCIES.map((freq) => ({
      freq,
      gain: 0,
      label: freq >= 1000 ? `${freq / 1000}k` : `${freq}`,
    }))
  );

  const [activePreset, setActivePreset] = useState<string>('default');

  const handleBandGainChange = (index: number, newGain: number) => {
    setActivePreset('custom');
    const updated = [...bands];
    updated[index] = { ...updated[index], gain: newGain };
    setBands(updated);
  };

  const applyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    const gains = EQ_PRESETS[presetKey] || EQ_PRESETS.default;
    const updated = bands.map((band, idx) => ({
      ...band,
      gain: gains[idx] !== undefined ? gains[idx] : 0,
    }));
    setBands(updated);
    if (isPreviewing) {
      onPreviewEQ(updated);
    }
  };

  const handleReset = () => {
    applyPreset('default');
  };

  const hasModifications = bands.some((b) => Math.abs(b.gain) > 0.1);

  return (
    <div className="flex flex-col gap-5 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {/* Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Bộ Cân Bằng Âm Sắc (10-Band Equalizer)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Cắt giảm hoặc tăng cường chi tiết các dải tần từ âm trầm sâu (31Hz) đến âm bổng cao (16kHz).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 px-2">Preset:</span>
            <select
              value={activePreset}
              onChange={(e) => applyPreset(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-cyan-300 rounded px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              <option value="default">Mặc định (Flat)</option>
              <option value="bassBoost">Bass Boost (Tăng trầm)</option>
              <option value="trebleBoost">Treble Boost (Tăng bổng)</option>
              <option value="vocalClarity">Giọng nói rõ (Vocal Clarity)</option>
              <option value="vocal">Vocal (Ca hát)</option>
              <option value="rock">Rock</option>
              <option value="pop">Pop</option>
              <option value="noiseReduction">Giảm ồn nhẹ (De-noise EQ)</option>
              <option value="custom" disabled>Tùy chỉnh cá nhân</option>
            </select>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
            title="Đưa tất cả cần gạt về 0 dB"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Về 0</span>
          </button>
        </div>
      </div>

      {/* 10 Vertical EQ Sliders */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-4 bg-slate-950/70 rounded-xl border border-slate-800 overflow-x-auto">
        {bands.map((band, idx) => (
          <div key={band.freq} className="flex flex-col items-center gap-2 min-w-[42px]">
            {/* Gain Indicator */}
            <span
              className={`text-[11px] font-mono font-bold ${
                band.gain > 0
                  ? 'text-cyan-400'
                  : band.gain < 0
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {band.gain > 0 ? `+${band.gain}` : band.gain}
            </span>

            {/* Slider track container */}
            <div className="relative flex items-center justify-center h-40 py-2">
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={band.gain}
                onChange={(e) => handleBandGainChange(idx, parseFloat(e.target.value))}
                className="w-36 h-2 appearance-none bg-slate-800 rounded-lg cursor-pointer accent-cyan-400 -rotate-90 origin-center"
              />
            </div>

            {/* Frequency Label */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-slate-200">{band.label}</span>
              <span className="text-[10px] text-slate-400">Hz</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Controls: Preview & Apply */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-xs text-slate-400">
          💡 Dải 31-125Hz điều khiển âm bass, 250-1kHz điều khiển độ dày âm thanh, 2k-16kHz điều khiển độ trong và hơi thở.
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={isPreviewing ? onStopPreview : () => onPreviewEQ(bands)}
            disabled={!hasBuffer || isProcessing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
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
                <span>Nghe thử EQ</span>
              </>
            )}
          </button>

          <button
            onClick={() => onApplyEQ(bands)}
            disabled={!hasBuffer || isProcessing || !hasModifications}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý EQ...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Áp dụng vào âm thanh</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
