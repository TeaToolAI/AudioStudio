/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Palette, Sparkles, Activity, Layers, CheckSquare } from 'lucide-react';
import { SelectionRange, WaveformRenderConfig, TimelineClip } from '../types/audio';
import { audioEngine } from '../services/audioEngine';
import { renderWaveformCanvas } from '../services/waveformRenderer';
import { generateSpectrogramCanvas } from '../services/spectrogramService';
import {
  getTimelinePlacements,
  getTimelineTotalDuration,
  getClipTheme,
  extractClipPeaks,
} from '../services/timelineService';

interface WaveformViewerProps {
  buffer: AudioBuffer | null;
  timelineClips?: TimelineClip[];
  selectedClipIds?: string[];
  onClipClick?: (clipId: string, isCtrl: boolean, isShift: boolean) => void;
  currentTime: number;
  selection: SelectionRange | null;
  onSelectionChange: (range: SelectionRange | null) => void;
  onSeek: (time: number) => void;
  zoom: number; // 1 to 20
  onZoomChange: (newZoom: number) => void;
  renderConfig: WaveformRenderConfig;
  onOpenStyleModal: () => void;
  onToggleSpectrogram?: () => void;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({
  buffer,
  timelineClips = [],
  selectedClipIds = [],
  onClipClick,
  currentTime,
  selection,
  onSelectionChange,
  onSeek,
  zoom,
  onZoomChange,
  renderConfig,
  onOpenStyleModal,
  onToggleSpectrogram,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);

  const [dragMode, setDragMode] = useState<'create' | 'move' | 'handle-left' | 'handle-right' | null>(null);
  const [dragStartPos, setDragStartPos] = useState<number>(0);
  const [mouseDownCoord, setMouseDownCoord] = useState<{ x: number; y: number } | null>(null);
  const [initialRange, setInitialRange] = useState<SelectionRange | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Cached downsampled peaks for individual clips
  const clipPeaksCacheRef = useRef<Map<string, { peaks: Float32Array; version: string }>>(new Map());

  // Cached composite peaks fallback
  const peaksRef = useRef<Float32Array | null>(null);
  const leftPeaksRef = useRef<Float32Array | null>(null);
  const rightPeaksRef = useRef<Float32Array | null>(null);

  // Computed Spectrogram Heatmap Canvas Cache
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Calculate total duration across timeline clips (or single buffer fallback)
  const totalDuration = useMemo(() => {
    if (timelineClips && timelineClips.length > 0) {
      return getTimelineTotalDuration(timelineClips);
    }
    return buffer ? buffer.duration : 0;
  }, [timelineClips, buffer]);

  // Placements for multi-clip timeline
  const clipPlacements = useMemo(() => {
    if (timelineClips && timelineClips.length > 0) {
      return getTimelinePlacements(timelineClips);
    }
    return [];
  }, [timelineClips]);

  // Extract / cache peaks when buffer changes
  useEffect(() => {
    if (buffer) {
      peaksRef.current = audioEngine.extractPeaks(buffer, 4000);
      leftPeaksRef.current = audioEngine.extractChannelPeaks(buffer, 0, 4000);
      rightPeaksRef.current = audioEngine.extractChannelPeaks(
        buffer,
        buffer.numberOfChannels > 1 ? 1 : 0,
        4000
      );
    } else {
      peaksRef.current = null;
      leftPeaksRef.current = null;
      rightPeaksRef.current = null;
    }
  }, [buffer]);

  // Generate or re-generate Spectrogram when buffer or palette changes
  useEffect(() => {
    if (buffer && renderConfig.showSpectrogram) {
      try {
        spectrogramCanvasRef.current = generateSpectrogramCanvas(
          buffer,
          renderConfig.spectrogramPalette || 'magma'
        );
      } catch (err) {
        console.error('Spectrogram generation error:', err);
        spectrogramCanvasRef.current = null;
      }
    } else {
      spectrogramCanvasRef.current = null;
    }
  }, [buffer, renderConfig.showSpectrogram, renderConfig.spectrogramPalette]);

  // Convert pixel X on canvas to timeline audio timestamp
  const pixelToTime = useCallback(
    (pixelX: number, totalWidth: number): number => {
      if (totalDuration <= 0) return 0;
      const ratio = Math.max(0, Math.min(1, pixelX / totalWidth));
      return ratio * totalDuration;
    },
    [totalDuration]
  );

  // Convert timeline audio timestamp to pixel X
  const timeToPixel = useCallback(
    (time: number, totalWidth: number): number => {
      if (totalDuration <= 0) return 0;
      return (time / totalDuration) * totalWidth;
    },
    [totalDuration]
  );

  // Draw Time Ruler Canvas
  useEffect(() => {
    const rulerCanvas = rulerCanvasRef.current;
    const container = containerRef.current;
    if (!rulerCanvas || !container || totalDuration <= 0) return;

    const ctx = rulerCanvas.getContext('2d');
    if (!ctx) return;

    const baseWidth = container.clientWidth;
    const totalWidth = Math.max(baseWidth, baseWidth * zoom);
    const height = 24;

    rulerCanvas.width = totalWidth;
    rulerCanvas.height = height;

    ctx.clearRect(0, 0, totalWidth, height);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, totalWidth, height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(totalWidth, height - 1);
    ctx.stroke();

    const pxPerSec = totalWidth / totalDuration;
    let stepSec = 1;
    if (pxPerSec > 200) stepSec = 0.2;
    else if (pxPerSec > 80) stepSec = 0.5;
    else if (pxPerSec > 30) stepSec = 1;
    else if (pxPerSec > 10) stepSec = 5;
    else stepSec = 10;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let t = 0; t <= totalDuration; t += stepSec) {
      const x = (t / totalDuration) * totalWidth;
      const isMajor = Math.round(t / stepSec) % (stepSec < 1 ? 5 : 2) === 0;

      ctx.strokeStyle = isMajor ? '#64748b' : '#334155';
      ctx.beginPath();
      ctx.moveTo(x, height - (isMajor ? 12 : 6));
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMajor) {
        const mins = Math.floor(t / 60);
        const secs = (t % 60).toFixed(stepSec < 1 ? 1 : 0);
        const label = `${mins}:${secs.padStart(stepSec < 1 ? 4 : 2, '0')}`;
        ctx.fillText(label, x, 11);
      }
    }
  }, [totalDuration, zoom]);

  // Draw Main Waveform Canvas: Multi-Clip Timeline Blocks & Details
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || totalDuration <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseWidth = container.clientWidth;
    const totalWidth = Math.max(baseWidth, baseWidth * zoom);
    const height = 230;

    canvas.width = totalWidth;
    canvas.height = height;

    const centerY = height / 2;
    const halfWaveHeight = centerY - 20;

    // Background fill
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, totalWidth, height);

    // Draw Spectrogram Overlay if enabled
    if (renderConfig.showSpectrogram && spectrogramCanvasRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.08, Math.min(0.75, renderConfig.spectrogramOpacity || 0.35));
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(spectrogramCanvasRef.current, 0, 0, totalWidth, height);
      ctx.restore();
    }

    // Grid lines
    if (renderConfig.showGrid) {
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      ctx.beginPath();
      for (let x = 0; x < totalWidth; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(totalWidth, y);
      }
      ctx.stroke();
    }

    // Center baseline
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(totalWidth, centerY);
    ctx.stroke();

    const selectedSet = new Set(selectedClipIds);

    // --- CASE A: RENDER TIMELINE CLIPS AS DISTINCT SEQUENTIAL BLOCKS ---
    if (clipPlacements.length > 0) {
      clipPlacements.forEach((placement) => {
        const { clip, index, timelineStart, timelineEnd, duration } = placement;
        const xStart = (timelineStart / totalDuration) * totalWidth;
        const xEnd = (timelineEnd / totalDuration) * totalWidth;
        const clipPixelWidth = Math.max(2, xEnd - xStart);
        const isSelected = selectedSet.has(clip.id);
        const theme = getClipTheme(clip.colorIndex ?? index);

        // Clip block background
        ctx.save();
        ctx.fillStyle = isSelected ? theme.selectedBg : theme.bg;
        ctx.fillRect(xStart, 0, clipPixelWidth, height);

        // Clip border & glowing highlight when selected
        if (isSelected) {
          ctx.strokeStyle = theme.selectedBorder;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = theme.selectedGlow;
          ctx.shadowBlur = 10;
          ctx.strokeRect(xStart + 1, 1, clipPixelWidth - 2, height - 2);
        } else {
          ctx.strokeStyle = theme.border;
          ctx.lineWidth = 1;
          ctx.strokeRect(xStart, 0, clipPixelWidth, height);
        }
        ctx.restore();

        // High contrast divider line between clips
        ctx.fillStyle = isSelected ? theme.selectedBorder : '#334155';
        ctx.fillRect(xStart, 0, 2, height);
        ctx.fillRect(xEnd - 2, 0, 2, height);

        // Get or extract clip peaks
        const cacheKey = `${clip.id}_${clip.sourceStart}_${clip.sourceEnd}`;
        let clipPeaks = clipPeaksCacheRef.current.get(cacheKey)?.peaks;
        if (!clipPeaks) {
          const numBuckets = Math.max(60, Math.floor(clipPixelWidth * 1.5));
          clipPeaks = extractClipPeaks(
            clip.sourceBuffer,
            clip.sourceStart,
            clip.sourceEnd,
            numBuckets
          );
          clipPeaksCacheRef.current.set(cacheKey, { peaks: clipPeaks, version: cacheKey });
        }

        // Render waveform inside clip boundaries
        ctx.save();
        ctx.beginPath();
        ctx.rect(xStart + 1, 24, clipPixelWidth - 2, height - 25);
        ctx.clip();

        const numClipBuckets = clipPeaks.length / 2;
        const barWidth = Math.max(1, renderConfig.barWidth || 1);
        const barGap = Math.max(0, renderConfig.barGap || 0);
        const step = Math.max(1, barWidth + barGap);

        const waveColor = isSelected ? theme.waveSelectedColor : theme.waveColor;
        ctx.fillStyle = waveColor;
        ctx.strokeStyle = waveColor;

        if (renderConfig.template === 'smooth') {
          // Smooth curve inside clip
          ctx.beginPath();
          ctx.moveTo(xStart, centerY);
          for (let px = xStart; px < xEnd; px += step * 2) {
            const ratio = (px - xStart) / clipPixelWidth;
            const bIdx = Math.floor(ratio * numClipBuckets);
            const maxVal = clipPeaks[bIdx * 2 + 1] || 0;
            ctx.lineTo(px, centerY - maxVal * halfWaveHeight);
          }
          for (let px = xEnd; px >= xStart; px -= step * 2) {
            const ratio = (px - xStart) / clipPixelWidth;
            const bIdx = Math.floor(ratio * numClipBuckets);
            const minVal = clipPeaks[bIdx * 2] || 0;
            ctx.lineTo(px, centerY - minVal * halfWaveHeight);
          }
          ctx.closePath();
          ctx.globalAlpha = 0.45;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Classic bars
          for (let px = xStart; px < xEnd; px += step) {
            const ratio = (px - xStart) / clipPixelWidth;
            const bIdx = Math.floor(ratio * numClipBuckets);
            const minVal = clipPeaks[bIdx * 2] || 0;
            const maxVal = clipPeaks[bIdx * 2 + 1] || 0;

            const yTop = centerY - maxVal * halfWaveHeight;
            const yBottom = centerY - minVal * halfWaveHeight;
            const barH = Math.max(2, yBottom - yTop);

            ctx.fillRect(px, yTop, barWidth, barH);
          }
        }
        ctx.restore();

        // Render Clip Header Pill / Name Tag at top
        ctx.save();
        const headerH = 20;
        const pillW = Math.min(clipPixelWidth - 4, Math.max(48, clipPixelWidth));
        if (pillW > 28) {
          ctx.fillStyle = isSelected ? theme.tagBg : 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = isSelected ? theme.selectedBorder : theme.border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(xStart + 3, 3, pillW - 6, headerH - 3, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isSelected ? '#ffffff' : theme.tagText;
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';

          const label = pillW > 90
            ? `${index + 1}. ${clip.name} (${duration.toFixed(1)}s)`
            : pillW > 45
            ? `${index + 1}. ${clip.name.slice(0, 6)}..`
            : `${index + 1}`;

          ctx.fillText(label, xStart + 8, 15);

          if (isSelected && pillW > 140) {
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('✓ CHỌN', xStart + pillW - 55, 15);
          }
        }
        ctx.restore();
      });
    } else if (peaksRef.current) {
      // Fallback single buffer rendering
      renderWaveformCanvas(
        ctx,
        peaksRef.current,
        leftPeaksRef.current,
        rightPeaksRef.current,
        totalWidth,
        height,
        renderConfig,
        spectrogramCanvasRef.current
      );
    }

    // Draw Selection Overlay
    if (selection && selection.end > selection.start) {
      const selStartX = timeToPixel(selection.start, totalWidth);
      const selEndX = timeToPixel(selection.end, totalWidth);
      const selWidth = Math.max(2, selEndX - selStartX);

      // Translucent cyan fill
      ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
      ctx.fillRect(selStartX, 0, selWidth, height);

      // Border lines
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(selStartX, 0, selWidth, height);

      // Handles on left & right
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(selStartX - 3, 0, 6, height);
      ctx.fillRect(selEndX - 3, 0, 6, height);
    }

    // Draw Playhead Cursor
    const playheadX = timeToPixel(currentTime, totalWidth);
    ctx.strokeStyle = '#f43f5e'; // Vibrant rose red
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead head icon
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 10);
    ctx.closePath();
    ctx.fill();

  }, [
    totalDuration,
    clipPlacements,
    selectedClipIds,
    currentTime,
    selection,
    zoom,
    timeToPixel,
    renderConfig,
  ]);

  // Handle Mouse Interactions (Click to select clip, Ctrl+click, Shift+click, Drag selection)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalDuration <= 0 || !containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left + container.scrollLeft;
    const totalWidth = Math.max(container.clientWidth, container.clientWidth * zoom);
    const clickTime = pixelToTime(clickX, totalWidth);

    setMouseDownCoord({ x: clickX, y: e.clientY });

    // Check if clicked near selection handles
    if (selection && selection.end > selection.start) {
      const selStartX = timeToPixel(selection.start, totalWidth);
      const selEndX = timeToPixel(selection.end, totalWidth);

      if (Math.abs(clickX - selStartX) <= 8) {
        setDragMode('handle-left');
        setDragStartPos(clickTime);
        setInitialRange({ ...selection });
        return;
      }
      if (Math.abs(clickX - selEndX) <= 8) {
        setDragMode('handle-right');
        setDragStartPos(clickTime);
        setInitialRange({ ...selection });
        return;
      }
      if (clickX > selStartX && clickX < selEndX) {
        setDragMode('move');
        setDragStartPos(clickTime);
        setInitialRange({ ...selection });
        return;
      }
    }

    // Default: initialize potential drag or seek
    setDragStartPos(clickTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalDuration <= 0 || !containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const currentX = e.clientX - rect.left + container.scrollLeft;
    const totalWidth = Math.max(container.clientWidth, container.clientWidth * zoom);
    const currentTimeAtMouse = pixelToTime(currentX, totalWidth);
    setHoverTime(currentTimeAtMouse);

    if (!mouseDownCoord) return;

    const deltaX = Math.abs(currentX - mouseDownCoord.x);

    // If dragged more than 5 pixels, enter 'create' drag mode
    if (!dragMode && deltaX > 5) {
      setDragMode('create');
    }

    if (dragMode === 'create') {
      const start = Math.max(0, Math.min(dragStartPos, currentTimeAtMouse));
      const end = Math.min(totalDuration, Math.max(dragStartPos, currentTimeAtMouse));
      onSelectionChange({ start, end });
    } else if (dragMode === 'handle-left' && initialRange) {
      const newStart = Math.max(0, Math.min(initialRange.end - 0.05, currentTimeAtMouse));
      onSelectionChange({ start: newStart, end: initialRange.end });
    } else if (dragMode === 'handle-right' && initialRange) {
      const newEnd = Math.min(totalDuration, Math.max(initialRange.start + 0.05, currentTimeAtMouse));
      onSelectionChange({ start: initialRange.start, end: newEnd });
    } else if (dragMode === 'move' && initialRange) {
      const delta = currentTimeAtMouse - dragStartPos;
      const duration = initialRange.end - initialRange.start;
      let newStart = initialRange.start + delta;
      let newEnd = initialRange.end + delta;

      if (newStart < 0) {
        newStart = 0;
        newEnd = duration;
      } else if (newEnd > totalDuration) {
        newEnd = totalDuration;
        newStart = totalDuration - duration;
      }
      onSelectionChange({ start: newStart, end: newEnd });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseDownCoord || totalDuration <= 0 || !containerRef.current) {
      setDragMode(null);
      setMouseDownCoord(null);
      setInitialRange(null);
      return;
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const currentX = e.clientX - rect.left + container.scrollLeft;
    const deltaX = Math.abs(currentX - mouseDownCoord.x);

    // If mouse was barely moved (clean click, NOT a drag selection)
    if (deltaX <= 5 && !dragMode) {
      const totalWidth = Math.max(container.clientWidth, container.clientWidth * zoom);
      const clickTime = pixelToTime(currentX, totalWidth);

      // Seek to clicked position
      onSeek(clickTime);

      // If user clicked inside a clip, handle clip selection (Single, Ctrl+click, Shift+click)
      const clickedPlacement = clipPlacements.find(
        (p) => clickTime >= p.timelineStart && clickTime <= p.timelineEnd
      );

      if (clickedPlacement && onClipClick) {
        onClipClick(
          clickedPlacement.clip.id,
          e.ctrlKey || e.metaKey,
          e.shiftKey
        );
      }

      // Clear dragged time selection
      onSelectionChange(null);
    } else if (dragMode === 'create' && selection) {
      // Discard tiny selection
      if (Math.abs(selection.end - selection.start) < 0.05) {
        onSelectionChange(null);
      }
    }

    setDragMode(null);
    setMouseDownCoord(null);
    setInitialRange(null);
  };

  // Double click selects whole timeline or clicked clip
  const handleDoubleClick = () => {
    if (totalDuration > 0) {
      onSelectionChange({ start: 0, end: totalDuration });
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const newZoom = Math.max(1, Math.min(15, zoom + delta));
      onZoomChange(Number(newZoom.toFixed(1)));
    }
  };

  const formatTime = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  const getTemplateDisplayName = (t: WaveformRenderConfig['template']) => {
    switch (t) {
      case 'classic': return 'Studio Cổ Điển';
      case 'smooth': return 'Đường Cong Mềm';
      case 'neon': return 'Neon Cyberpunk';
      case 'led': return 'LED VU Meter';
      case 'stereo': return 'Stereo Tách L/R';
      case 'oscilloscope': return 'Oscilloscope CRT';
      default: return 'Studio Cổ Điển';
    }
  };

  return (
    <div className="relative flex flex-col w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl select-none">
      {/* Top Info Bar inside Waveform */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Thời gian:</span>
            <span className="text-cyan-400 font-semibold">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span>{totalDuration > 0 ? formatTime(totalDuration) : '0:00.00'}</span>
          </div>

          {/* Timeline Multi-Clip Indicator */}
          {clipPlacements.length > 0 && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-700 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Timeline:</span>
              <span className="text-cyan-300 font-semibold">{clipPlacements.length} clip</span>
              {selectedClipIds.length > 0 && (
                <span className="flex items-center gap-1 ml-1 text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded text-[11px]">
                  <CheckSquare className="w-3 h-3" />
                  Đang chọn: {selectedClipIds.length}
                </span>
              )}
            </div>
          )}

          {selection && selection.end > selection.start && (
            <div className="flex items-center gap-2 pl-3 border-l border-slate-700 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
              <span className="text-slate-300">Vùng chọn:</span>
              <span>{formatTime(selection.start)} - {formatTime(selection.end)}</span>
              <span className="text-xs bg-emerald-800/60 text-emerald-200 px-1.5 py-0.2 rounded font-mono">
                Δ {(selection.end - selection.start).toFixed(2)}s
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectionChange(null);
                }}
                className="text-slate-400 hover:text-rose-400 font-bold ml-1 cursor-pointer"
                title="Bỏ chọn vùng"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Spectrogram Quick Toggle Button */}
          {onToggleSpectrogram && (
            <button
              onClick={onToggleSpectrogram}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-sans font-medium transition-all cursor-pointer shadow-sm ${
                renderConfig.showSpectrogram
                  ? 'bg-purple-950/70 border-purple-500/80 text-purple-300 shadow-purple-900/30'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Phủ phổ tần số Spectrogram 2D dạng mờ lên dạng sóng"
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Phổ Spectrogram:</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                  renderConfig.showSpectrogram
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40'
                    : 'bg-slate-700/60 text-slate-400'
                }`}
              >
                {renderConfig.showSpectrogram ? `Bật (${Math.round((renderConfig.spectrogramOpacity || 0.35) * 100)}%)` : 'Tắt'}
              </span>
            </button>
          )}

          {/* Waveform Template Button */}
          <button
            onClick={onOpenStyleModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-sans font-medium transition-all cursor-pointer shadow-sm"
            title="Đổi mẫu vẽ sóng nhạc & tuỳ chỉnh lớp phủ phổ Spectrogram"
          >
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mẫu: <strong>{getTemplateDisplayName(renderConfig.template)}</strong></span>
            <Sparkles className="w-3 h-3 text-amber-400 ml-0.5" />
          </button>

          {hoverTime !== null && (
            <span className="text-slate-400 hidden sm:inline">
              Con trỏ: <span className="text-slate-200">{formatTime(hoverTime)}</span>
            </span>
          )}

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded text-slate-300">
            <span>Thu phóng:</span>
            <span className="text-cyan-300 font-semibold">{zoom}x</span>
          </div>
        </div>
      </div>

      {/* Scrollable Waveform & Ruler Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => {
          handleMouseUp(e);
          setHoverTime(null);
        }}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="relative w-full overflow-x-auto overflow-y-hidden cursor-crosshair custom-scrollbar"
        style={{ minHeight: '254px' }}
      >
        {totalDuration <= 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
            <svg className="w-12 h-12 text-slate-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-sm font-medium">Chưa có âm thanh nào trên Timeline</p>
            <p className="text-xs text-slate-400">Kéo thả file vào đây, chọn mở file hoặc nhấn nút Nhạc mẫu Demo</p>
          </div>
        ) : (
          <div className="relative">
            <canvas ref={rulerCanvasRef} className="block" />
            <canvas ref={canvasRef} className="block" />
          </div>
        )}
      </div>

      {/* Timeline Shortcut Hints Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>💡 <strong>Nhấp clip:</strong> Chọn</span>
          <span><strong>Ctrl+Nhấp:</strong> Chọn nhiều</span>
          <span><strong>Shift+Nhấp:</strong> Chọn dải</span>
          <span><strong>Kéo chuột:</strong> Tạo vùng chọn</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span><strong>S:</strong> Tách đôi</span>
          <span><strong>Del:</strong> Xoá</span>
          <span><strong>Ctrl+Z:</strong> Hoàn tác</span>
        </div>
      </div>
    </div>
  );
};
