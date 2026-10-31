/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  BarChart3,
  X,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';
import { computeAudioStats, AudioBufferStats } from '../services/audioStats';

interface AudioStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  buffer: AudioBuffer | null;
  filename: string;
  onNormalize?: () => void;
}

export const AudioStatsModal: React.FC<AudioStatsModalProps> = ({
  isOpen,
  onClose,
  buffer,
  filename,
  onNormalize,
}) => {
  const stats: AudioBufferStats | null = useMemo(() => {
    if (!buffer) return null;
    return computeAudioStats(buffer);
  }, [buffer]);

  if (!isOpen || !buffer || !stats) return null;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  // Convert dB to percentage for meter visualization (-60dB to 0dB)
  const dbToPercent = (db: number) => {
    if (db <= -60) return 0;
    if (db >= 0) return 100;
    return Math.round(((db + 60) / 60) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
                <span>Thống Kê Âm Thanh Toàn Diện</span>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/60 uppercase">
                  RMS & Peak
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                Tệp: {filename}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
          {/* Status Alert Banner */}
          {stats.isClipping ? (
            <div className="flex items-start gap-3 p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-rose-200">
                  Phát hiện vỡ tiếng (Clipping Detected - {stats.totalClippingCount.toLocaleString()} mẫu)
                </span>
                <span className="text-rose-300 leading-relaxed">
                  Âm thanh có các mẫu vượt chạm ngưỡng 0.0 dBFS có thể gây hiện tượng rè hạt khó chịu trên loa. Bạn nên thực hiện Chuẩn hoá về -0.1 dB.
                </span>
              </div>
            </div>
          ) : stats.maxPeakDb < -6.0 ? (
            <div className="flex items-start gap-3 p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs">
              <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-amber-200">
                  Âm lượng còn dư nhiều khoảng trống (Headroom: +{stats.headroomDb} dB)
                </span>
                <span className="text-amber-300 leading-relaxed">
                  Mức đỉnh cao nhất chỉ đạt {stats.maxPeakDb} dBFS. Bạn có thể Chuẩn hoá hoặc tăng Gain để âm thanh rõ ràng và to hơn.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>
                <strong>Mức âm lượng tối ưu:</strong> Đỉnh âm đạt {stats.maxPeakDb} dBFS, không bị xén ngọn (No Clipping), hoàn toàn đạt chuẩn cho streaming và xuất bản.
              </span>
            </div>
          )}

          {/* 4 Primary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Peak */}
            <div className="flex flex-col gap-1 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium">Đỉnh (Peak Level)</span>
              <span
                className={`text-xl font-mono font-bold ${
                  stats.isClipping
                    ? 'text-rose-400'
                    : stats.maxPeakDb > -1.0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {stats.maxPeakDb} <span className="text-xs font-normal">dBFS</span>
              </span>
              <span className="text-[10px] text-slate-400">
                Khoảng trống: +{stats.headroomDb} dB
              </span>
            </div>

            {/* RMS */}
            <div className="flex flex-col gap-1 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium">Năng lượng RMS</span>
              <span className="text-xl font-mono font-bold text-cyan-400">
                {stats.avgRmsDb} <span className="text-xs font-normal">dBFS</span>
              </span>
              <span className="text-[10px] text-slate-400">
                Công suất âm trung bình
              </span>
            </div>

            {/* Crest Factor */}
            <div className="flex flex-col gap-1 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium">Crest Factor</span>
              <span className="text-xl font-mono font-bold text-purple-400">
                {stats.crestFactorDb} <span className="text-xs font-normal">dB</span>
              </span>
              <span className="text-[10px] text-slate-400">
                Độ tương phản động
              </span>
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium">Thời lượng tổng</span>
              <span className="text-xl font-mono font-bold text-slate-200">
                {formatTime(stats.duration)}
              </span>
              <span className="text-[10px] text-slate-400">
                {stats.totalSamples.toLocaleString()} mẫu
              </span>
            </div>
          </div>

          {/* Channel Level Meters (Left / Right) */}
          <div className="flex flex-col gap-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              Chi Tiết Từng Kênh Âm Thanh:
            </span>

            <div className="flex flex-col gap-3">
              {stats.channels.map((ch, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 font-mono">
                      {stats.numberOfChannels === 1 ? 'Kênh Mono' : idx === 0 ? 'Kênh Trái (L)' : 'Kênh Phải (R)'}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>
                        Peak: <strong className={ch.peakDb >= -0.1 ? 'text-rose-400' : 'text-slate-200'}>{ch.peakDb} dB</strong>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span>
                        RMS: <strong className="text-cyan-400">{ch.rmsDb} dB</strong>
                      </span>
                    </div>
                  </div>

                  {/* Visual Peak / RMS Meter Bar */}
                  <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex items-center">
                    {/* RMS Bar (solid color) */}
                    <div
                      className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                      style={{ width: `${dbToPercent(ch.rmsDb)}%` }}
                    />
                    {/* Peak Marker Line */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-rose-400 shadow-sm"
                      style={{ left: `calc(${dbToPercent(ch.peakDb)}% - 2px)` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                    <span>-60 dBFS</span>
                    <span>-24 dB</span>
                    <span>-12 dB</span>
                    <span>-6 dB</span>
                    <span>0 dBFS</span>
                  </div>

                  {/* DC Offset & Clipping details */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                    <span>Độ lệch DC (DC Offset): {ch.dcOffset}</span>
                    <span>Số mẫu bị xén (Clipping): {ch.clippingCount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Hardware Specs Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-0.5">
              <span className="text-slate-400 text-[11px]">Tần số lấy mẫu:</span>
              <span className="font-mono text-slate-200 font-semibold">{stats.sampleRate.toLocaleString()} Hz</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-0.5">
              <span className="text-slate-400 text-[11px]">Cấu hình kênh:</span>
              <span className="font-mono text-slate-200 font-semibold">{stats.numberOfChannels === 1 ? '1 (Mono)' : '2 (Stereo)'}</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-0.5">
              <span className="text-slate-400 text-[11px]">Độ sâu mẫu:</span>
              <span className="font-mono text-slate-200 font-semibold">32-bit Float</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-0.5">
              <span className="text-slate-400 text-[11px]">Bộ nhớ RAM:</span>
              <span className="font-mono text-slate-200 font-semibold">~{stats.estimatedMemoryMb} MB</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950/80 border-t border-slate-800">
          <div>
            {onNormalize && (
              <button
                onClick={() => {
                  onNormalize();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-slate-700 hover:border-amber-400/50 transition-colors cursor-pointer"
                title="Tối ưu đỉnh âm lượng lên -0.1 dBFS"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Chuẩn hoá nhanh (-0.1 dB)</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl transition-colors cursor-pointer"
          >
            Đóng bảng thống kê
          </button>
        </div>
      </div>
    </div>
  );
};
