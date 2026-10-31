/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Music2, Gauge, Play, Square, Check, RotateCcw, Loader2 } from 'lucide-react';
import { PitchTempoSettings } from '../../types/audio';

interface PitchTempoTabProps {
  hasBuffer: boolean;
  onPreview: (settings: PitchTempoSettings) => void;
  onStopPreview: () => void;
  isPreviewing: boolean;
  onApply: (settings: PitchTempoSettings) => Promise<void>;
  isProcessing: boolean;
}

export const PitchTempoTab: React.FC<PitchTempoTabProps> = ({
  hasBuffer,
  onPreview,
  onStopPreview,
  isPreviewing,
  onApply,
  isProcessing,
}) => {
  const [semitones, setSemitones] = useState<number>(0);
  const [cents, setCents] = useState<number>(0);
  const [tempo, setTempo] = useState<number>(1.0);

  const handleReset = () => {
    setSemitones(0);
    setCents(0);
    setTempo(1.0);
    if (isPreviewing) onStopPreview();
  };

  const handleApply = async () => {
    await onApply({ semitones, cents, tempo });
  };

  const currentSettings: PitchTempoSettings = { semitones, cents, tempo };

  return (
    <div className="flex flex-col gap-5 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Music2 className="w-4 h-4 text-cyan-400" />
            Điều chỉnh Cao độ (Pitch) & Tốc độ (Tempo)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Thuật toán WSOLA độc lập: đổi cao độ giữ nguyên tốc độ, và đổi tốc độ giữ nguyên cao độ.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cao độ (Pitch) Section */}
        <div className="flex flex-col gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Music2 className="w-4 h-4 text-cyan-400" />
              Cao độ (Pitch Shift)
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="-12"
                max="12"
                value={semitones}
                onChange={(e) => setSemitones(parseInt(e.target.value) || 0)}
                className="w-14 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono font-bold text-cyan-400"
              />
              <span className="text-xs text-slate-400">nửa cung</span>
            </div>
          </div>

          {/* Semitones Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Trầm hơn (-12)</span>
              <span className="text-cyan-400 font-mono font-semibold">
                {semitones > 0 ? `+${semitones}` : semitones} semitone
              </span>
              <span>Cao hơn (+12)</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={semitones}
              onChange={(e) => setSemitones(parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Cents Fine Tuning */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-900">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Chỉnh tinh (Cents)</span>
              <span className="text-cyan-400 font-mono">
                {cents > 0 ? `+${cents}` : cents} cents
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              value={cents}
              onChange={(e) => setCents(parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Quick Pitch Presets */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 mr-1">Gợi ý:</span>
            <button
              onClick={() => { setSemitones(-4); setCents(0); }}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Trầm (-4)
            </button>
            <button
              onClick={() => { setSemitones(0); setCents(0); }}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Chuẩn (0)
            </button>
            <button
              onClick={() => { setSemitones(4); setCents(0); }}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Cao (+4)
            </button>
            <button
              onClick={() => { setSemitones(12); setCents(0); }}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Octave (+12)
            </button>
          </div>
        </div>

        {/* Tốc độ (Tempo) Section */}
        <div className="flex flex-col gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-amber-400" />
              Tốc độ phát (Tempo / Speed)
            </span>
            <span className="text-sm font-mono font-bold text-amber-400 bg-amber-950/50 border border-amber-900/60 px-2.5 py-0.5 rounded">
              {tempo.toFixed(2)}x
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Chậm (0.5x)</span>
              <span>Bình thường (1.0x)</span>
              <span>Nhanh (2.0x)</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={tempo}
              onChange={(e) => setTempo(parseFloat(e.target.value))}
              className="accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Quick Tempo Presets */}
          <div className="flex items-center gap-1.5 pt-2">
            <span className="text-[11px] text-slate-400 mr-1">Tốc độ:</span>
            <button
              onClick={() => setTempo(0.75)}
              className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              0.75x
            </button>
            <button
              onClick={() => setTempo(1.0)}
              className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              1.0x
            </button>
            <button
              onClick={() => setTempo(1.25)}
              className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              1.25x
            </button>
            <button
              onClick={() => setTempo(1.5)}
              className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              1.5x
            </button>
          </div>

          <div className="p-2.5 bg-slate-900/80 rounded-lg text-xs text-slate-400 border border-slate-800 mt-auto">
            💡 Tốc độ thay đổi mà không làm thay đổi tông giọng (không bị giọng vịt đực khi chậm hoặc giọng sóc chuột khi nhanh).
          </div>
        </div>
      </div>

      {/* Action Buttons: Preview & Apply */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800">
        <button
          onClick={isPreviewing ? onStopPreview : () => onPreview(currentSettings)}
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
              <span>Nghe thử (Preview)</span>
            </>
          )}
        </button>

        <button
          onClick={handleApply}
          disabled={!hasBuffer || isProcessing || (semitones === 0 && cents === 0 && tempo === 1.0)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tính toán WSOLA...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Áp dụng vào bản ghi</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
