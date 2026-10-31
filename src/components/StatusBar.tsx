/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { SelectionRange } from '../types/audio';
import { CheckCircle, Info, BarChart3, AlertTriangle } from 'lucide-react';
import { computeAudioStats } from '../services/audioStats';

interface StatusBarProps {
  buffer: AudioBuffer | null;
  currentTime: number;
  selection: SelectionRange | null;
  activeFilename: string;
  statusMessage: string;
  onOpenStatsModal?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  buffer,
  currentTime,
  selection,
  activeFilename,
  statusMessage,
  onOpenStatsModal,
}) => {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  // Quick stats computation (memoized)
  const quickStats = useMemo(() => {
    if (!buffer) return null;
    return computeAudioStats(buffer);
  }, [buffer]);

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-400">
      {/* Left: Active file and status message */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 text-slate-300 truncate max-w-xs sm:max-w-md">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{activeFilename || 'Chưa mở tệp'}</span>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60 truncate">
            <CheckCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Right: Technical audio parameters & Quick Stats */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-400">
        {buffer && quickStats ? (
          <>
            {/* Quick Peak indicator */}
            <div className="flex items-center gap-1">
              <span>Đỉnh (Peak): </span>
              <span
                className={`font-semibold ${
                  quickStats.isClipping
                    ? 'text-rose-400 font-bold flex items-center gap-0.5'
                    : quickStats.maxPeakDb > -1.0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {quickStats.isClipping && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                {quickStats.maxPeakDb} dB
              </span>
            </div>

            {/* Quick RMS indicator */}
            <div className="flex items-center gap-1 hidden md:flex">
              <span>RMS: </span>
              <span className="text-cyan-400 font-semibold">{quickStats.avgRmsDb} dB</span>
            </div>

            <div>
              <span>Tần số: </span>
              <span className="text-slate-200">{buffer.sampleRate.toLocaleString()} Hz</span>
            </div>

            <div className="hidden sm:inline">
              <span>Kênh: </span>
              <span className="text-slate-200">{buffer.numberOfChannels === 1 ? 'Mono' : 'Stereo'}</span>
            </div>

            <div>
              <span>Thời lượng: </span>
              <span className="text-cyan-400 font-semibold">{formatTime(buffer.duration)}</span>
            </div>

            {/* Button to open Full Audio Statistics Modal */}
            {onOpenStatsModal && (
              <button
                onClick={onOpenStatsModal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white border border-slate-700/80 hover:border-cyan-500/60 transition-all cursor-pointer font-sans text-[11px] font-medium shadow-sm active:scale-95"
                title="Mở bảng thống kê chi tiết RMS, Peak dBFS, Dynamic Range và phát hiện vỡ tiếng"
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Thống kê Âm thanh</span>
              </button>
            )}
          </>
        ) : (
          <span>Web Audio API · Sẵn sàng xử lý offline</span>
        )}
      </div>
    </footer>
  );
};
