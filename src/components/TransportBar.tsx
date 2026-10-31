/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Headphones,
  AlertTriangle,
  Maximize2,
} from 'lucide-react';
import { multiTrackEngine, VUMeterData } from '../services/multiTrackEngine';

interface TransportBarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  loopSelection: boolean;
  onToggleLoop: () => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  hasSelection: boolean;
  disabled: boolean;
  onNormalizeMaster?: () => void;
  isSoloClipActive?: boolean;
  onToggleSoloClip?: () => void;
  hasSelectedClip?: boolean;
  onFitToView?: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  loopSelection,
  onToggleLoop,
  zoom,
  onZoomChange,
  hasSelection,
  disabled,
  onNormalizeMaster,
  isSoloClipActive = false,
  onToggleSoloClip,
  hasSelectedClip = false,
  onFitToView,
}) => {
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [meter, setMeter] = useState<VUMeterData>({
    leftPeak: 0,
    rightPeak: 0,
    leftDb: -60,
    rightDb: -60,
    isClipping: false,
  });

  useEffect(() => {
    const unsub = multiTrackEngine.onMeterUpdate((data) => {
      setMeter(data);
    });
    return () => unsub();
  }, []);

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    setIsMuted(newVal === 0);
    multiTrackEngine.setMasterGainValue(newVal);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      handleVolumeChange(volume || 0.8);
    } else {
      setIsMuted(true);
      multiTrackEngine.setMasterGainValue(0);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
      {/* Primary Transport Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onPlayPause}
          disabled={disabled}
          title={isPlaying ? 'Tạm dừng (Space)' : 'Phát từ con trỏ (Space)'}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-md ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/25'
          } disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Tạm dừng</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Phát đa track</span>
            </>
          )}
        </button>

        <button
          onClick={onStop}
          disabled={disabled}
          title="Dừng hẳn và về đầu"
          className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        {/* Solo Clip Button */}
        {onToggleSoloClip && (
          <button
            onClick={onToggleSoloClip}
            disabled={disabled || !hasSelectedClip}
            title={
              hasSelectedClip
                ? 'Nghe riêng clip đang chọn (bỏ qua các track khác)'
                : 'Hãy chọn một clip để nghe riêng'
            }
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isSoloClipActive
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Solo Clip</span>
          </button>
        )}

        {/* Loop Selection Button */}
        <button
          onClick={onToggleLoop}
          disabled={disabled || !hasSelection}
          title={hasSelection ? 'Lặp lại vùng chọn' : 'Kéo chọn một vùng trên timeline để lặp'}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            loopSelection && hasSelection
              ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Lặp vùng chọn</span>
        </button>

        {/* Master Normalize Button */}
        {onNormalizeMaster && (
          <button
            onClick={onNormalizeMaster}
            disabled={disabled}
            title="Tự động cân bằng mức đỉnh tổng Master về -0.1 dB không vỡ tiếng"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-400/50 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Chuẩn hoá Master</span>
          </button>
        )}
      </div>

      {/* Master Output VU Meter & Clipping Warning */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg">
        {/* Clipping LED indicator */}
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all ${
            meter.isClipping
              ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse'
              : 'bg-slate-800 text-slate-500'
          }`}
          title={meter.isClipping ? 'CẢNH BÁO: Tín hiệu bị vỡ tiếng (Vượt 0 dBFS)' : 'Mức bình thường'}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>CLIP</span>
        </div>

        {/* Stereo L/R Meters */}
        <div className="flex flex-col gap-1 w-28">
          {/* L Channel */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-slate-400 w-2.5">L</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  meter.leftDb > -1 ? 'bg-rose-500' : meter.leftDb > -6 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (meter.leftDb + 60) * 1.66))}%` }}
              />
            </div>
          </div>
          {/* R Channel */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-slate-400 w-2.5">R</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  meter.rightDb > -1 ? 'bg-rose-500' : meter.rightDb > -6 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (meter.rightDb + 60) * 1.66))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Monitor Volume Slider */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <button
            onClick={toggleMute}
            className="text-slate-400 hover:text-slate-200 cursor-pointer"
            title={isMuted ? 'Bật âm' : 'Tắt tiếng'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.02"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 accent-cyan-500 cursor-pointer"
            title="Âm lượng Master Out"
          />
        </div>
      </div>

      {/* Zoom & Fit Controls */}
      <div className="flex items-center gap-1.5">
        {onFitToView && (
          <button
            onClick={onFitToView}
            title="Vừa khung nhìn (tính toán lại mức zoom để vừa toàn bộ project)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors cursor-pointer mr-1"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Vừa khung</span>
          </button>
        )}

        <button
          onClick={() => onZoomChange(Math.max(0.15, Number((zoom / 1.25).toFixed(2))))}
          disabled={zoom <= 0.2}
          title="Thu nhỏ (-)"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono font-medium text-slate-300 px-2 min-w-10 text-center">
          {zoom >= 1 ? `${zoom.toFixed(1)}x` : `${zoom.toFixed(2)}x`}
        </span>

        <button
          onClick={() => onZoomChange(Math.min(15, Number((zoom * 1.25).toFixed(2))))}
          disabled={zoom >= 15}
          title="Phóng to (+)"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {zoom !== 1 && (
          <button
            onClick={() => onZoomChange(1)}
            title="Đặt lại mức thu phóng (1x)"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs cursor-pointer ml-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">1x</span>
          </button>
        )}
      </div>
    </div>
  );
};
