/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Volume2,
  Trash2,
  Lock,
  Unlock,
  Plus,
  Magnet,
  Layers,
  Sparkles,
  GripVertical,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import {
  MultiTrackProject,
  ProjectClip,
  AudioTrack,
  SelectionRange,
  WaveformRenderConfig,
} from '../types/audio';
import { extractClipPeaks } from '../services/timelineService';

export const TRACK_PALETTES = [
  { name: 'Emerald', border: '#10b981', selectedBorder: '#34d399', bg: 'rgba(16, 185, 129, 0.14)', selectedBg: 'rgba(16, 185, 129, 0.32)', tag: '#059669', wave: '#34d399' },
  { name: 'Purple', border: '#a855f7', selectedBorder: '#c084fc', bg: 'rgba(168, 85, 247, 0.14)', selectedBg: 'rgba(168, 85, 247, 0.32)', tag: '#7e22ce', wave: '#c084fc' },
  { name: 'Amber', border: '#f59e0b', selectedBorder: '#fbbf24', bg: 'rgba(245, 158, 11, 0.14)', selectedBg: 'rgba(245, 158, 11, 0.32)', tag: '#b45309', wave: '#fbbf24' },
  { name: 'Cyan', border: '#06b6d4', selectedBorder: '#38bdf8', bg: 'rgba(6, 182, 212, 0.14)', selectedBg: 'rgba(6, 182, 212, 0.32)', tag: '#0e7490', wave: '#38bdf8' },
  { name: 'Rose', border: '#f43f5e', selectedBorder: '#fb7185', bg: 'rgba(244, 63, 94, 0.14)', selectedBg: 'rgba(244, 63, 94, 0.32)', tag: '#be123c', wave: '#fb7185' },
  { name: 'Blue', border: '#3b82f6', selectedBorder: '#60a5fa', bg: 'rgba(59, 130, 246, 0.14)', selectedBg: 'rgba(59, 130, 246, 0.32)', tag: '#1d4ed8', wave: '#60a5fa' },
  { name: 'Teal', border: '#14b8a6', selectedBorder: '#2dd4bf', bg: 'rgba(20, 184, 166, 0.14)', selectedBg: 'rgba(20, 184, 166, 0.32)', tag: '#0f766e', wave: '#2dd4bf' },
  { name: 'Indigo', border: '#6366f1', selectedBorder: '#818cf8', bg: 'rgba(99, 102, 241, 0.14)', selectedBg: 'rgba(99, 102, 241, 0.32)', tag: '#4338ca', wave: '#818cf8' },
];

/**
 * Base scale: 30 pixels per second.
 * Scale is decoupled completely from project duration and viewport size.
 * pxPerSecond = BASE_PX_PER_SEC * zoom.
 */
export const BASE_PX_PER_SEC = 30;
export const MAX_TIMELINE_DURATION = 7200; // 2 hours cap in seconds

interface MultiTrackTimelineProps {
  project: MultiTrackProject;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  currentTime: number;
  selection: SelectionRange | null;
  zoom: number; // e.g. 0.2 to 15
  isSnapEnabled: boolean;
  onToggleSnap: () => void;
  onSeek: (time: number) => void;
  onSelectionChange: (range: SelectionRange | null) => void;
  onSelectTrack: (trackId: string) => void;
  onSelectClip: (clipId: string, isCtrl: boolean, isShift: boolean) => void;
  onUpdateTrack: (trackId: string, updates: Partial<AudioTrack>) => void;
  onAddTrack: () => void;
  onDeleteTrack: (trackId: string) => void;
  onUpdateClip: (clipId: string, updates: Partial<ProjectClip>) => void;
  onMoveClips: (clipIds: string[], deltaTime: number, targetTrackId?: string) => void;
  onDropFilesOnTrack: (files: File[] | FileList, trackId: string, atTime: number) => void;
  onDropFilesNewTrack: (files: File[] | FileList, atTime: number) => void;
  renderConfig: WaveformRenderConfig;
  onZoomChange?: (newZoom: number) => void;
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  project,
  selectedClipIds,
  selectedTrackId,
  currentTime,
  selection,
  zoom,
  isSnapEnabled,
  onToggleSnap,
  onSeek,
  onSelectionChange,
  onSelectTrack,
  onSelectClip,
  onUpdateTrack,
  onAddTrack,
  onDeleteTrack,
  onUpdateClip,
  onMoveClips,
  onDropFilesOnTrack,
  onDropFilesNewTrack,
  renderConfig,
  onZoomChange,
}) => {
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Strict linear pixel scaling
  const pxPerSecond = useMemo(() => {
    return Math.max(2, BASE_PX_PER_SEC * (zoom || 1));
  }, [zoom]);

  // Project overall duration based on clips (frozen during active drag to prevent resizing jumps)
  const committedMaxClipEnd = useMemo(() => {
    let maxEnd = 0;
    for (const clip of project.clips) {
      const end = clip.startTime + (clip.sourceEnd - clip.sourceStart);
      if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
  }, [project.clips]);

  // Dragging state
  const [dragMode, setDragMode] = useState<
    'move' | 'trim-left' | 'trim-right' | 'scrub-playhead' | 'select-range' | null
  >(null);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);

  // Live offsets during drag (kept locally so project state & undo history are not flooded during movement)
  const [liveDragDeltaTime, setLiveDragDeltaTime] = useState<number>(0);
  const [liveTargetTrackId, setLiveTargetTrackId] = useState<string | null>(null);
  const [liveTrimLeft, setLiveTrimLeft] = useState<{ startTime: number; sourceStart: number } | null>(null);
  const [liveTrimRight, setLiveTrimRight] = useState<{ sourceEnd: number } | null>(null);

  // Snapshot refs to avoid stale closures in window listeners
  const dragSnapshotRef = useRef<{
    mode: 'move' | 'trim-left' | 'trim-right' | 'scrub-playhead' | 'select-range' | null;
    clipId: string | null;
    initialClientX: number;
    initialScrollLeft: number;
    initialPxPerSec: number;
    initialStartTime: number;
    initialSourceStart: number;
    initialSourceEnd: number;
    clipDuration: number;
    targetTrackId: string | null;
    selectedClipIds: string[];
    rangeStartTime: number;
    frozenProjectDuration: number;
  }>({
    mode: null,
    clipId: null,
    initialClientX: 0,
    initialScrollLeft: 0,
    initialPxPerSec: pxPerSecond,
    initialStartTime: 0,
    initialSourceStart: 0,
    initialSourceEnd: 0,
    clipDuration: 0,
    targetTrackId: null,
    selectedClipIds: [],
    rangeStartTime: 0,
    frozenProjectDuration: 60,
  });

  // Track height resizing
  const [resizingTrackId, setResizingTrackId] = useState<string | null>(null);
  const [initialTrackHeight, setInitialTrackHeight] = useState<number>(96);
  const [resizeStartY, setResizeStartY] = useState<number>(0);

  // Inline editing track name
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState<string>('');

  // Hover time for cursor
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Cached clip peaks mapping
  const clipPeaksCacheRef = useRef<Map<string, Float32Array>>(new Map());

  // Auto-scroll animation ref
  const autoScrollRef = useRef<{
    active: boolean;
    speed: number;
    lastClientX: number;
    lastClientY: number;
  }>({
    active: false,
    speed: 0,
    lastClientX: 0,
    lastClientY: 0,
  });
  const autoScrollAnimIdRef = useRef<number | null>(null);

  // 2. Timeline content duration & width calculation:
  // (max(end of all clips, 60s) + 30s buffer) * pxPerSecond
  // During active drag, frozen to snapshot to avoid any shrinking or expansion loops
  const totalDuration = useMemo(() => {
    if (dragMode && dragSnapshotRef.current.mode) {
      // During drag, check if preview extends beyond frozen snapshot
      let previewMaxEnd = committedMaxClipEnd;
      if (dragMode === 'move' && draggingClipId) {
        previewMaxEnd = Math.max(previewMaxEnd, dragSnapshotRef.current.initialStartTime + liveDragDeltaTime + dragSnapshotRef.current.clipDuration);
      }
      const rawDur = Math.max(previewMaxEnd, dragSnapshotRef.current.frozenProjectDuration, 60) + 30;
      return Math.min(MAX_TIMELINE_DURATION, rawDur);
    }
    const rawDur = Math.max(committedMaxClipEnd, 60) + 30;
    return Math.min(MAX_TIMELINE_DURATION, rawDur);
  }, [committedMaxClipEnd, dragMode, draggingClipId, liveDragDeltaTime]);

  const timelineContentWidth = useMemo(() => {
    return totalDuration * pxPerSecond;
  }, [totalDuration, pxPerSecond]);

  // Coordinate conversions:
  // Strictly linear, NEVER computed from viewport width or totalDuration ratio
  const timeToPixel = useCallback(
    (time: number): number => {
      return time * pxPerSecond;
    },
    [pxPerSecond]
  );

  const pixelToTime = useCallback(
    (pixelX: number): number => {
      return Math.max(0, pixelX / pxPerSecond);
    },
    [pxPerSecond]
  );

  // Snap calculation (snaps to playhead, clip boundaries, and ruler marks)
  const getSnapTarget = useCallback(
    (candidateTime: number, currentClipId?: string | null): number => {
      if (!isSnapEnabled) return candidateTime;

      // 10px snap threshold converted to time
      const snapThresholdSec = 10 / pxPerSecond;
      const targets: number[] = [currentTime];

      // Add all clip boundaries (excluding the clip currently being moved)
      for (const clip of project.clips) {
        if (currentClipId && clip.id === currentClipId) continue;
        targets.push(clip.startTime);
        targets.push(clip.startTime + (clip.sourceEnd - clip.sourceStart));
      }

      // Add major ruler tick targets
      const STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
      let stepSec = STEPS.find((s) => s * pxPerSecond >= 80) || 5;
      const nearestGrid = Math.round(candidateTime / stepSec) * stepSec;
      targets.push(nearestGrid);

      let closest = candidateTime;
      let minDiff = snapThresholdSec;

      for (const target of targets) {
        const diff = Math.abs(candidateTime - target);
        if (diff < minDiff) {
          minDiff = diff;
          closest = target;
        }
      }

      return closest;
    },
    [isSnapEnabled, pxPerSecond, currentTime, project.clips]
  );

  // Time format utility
  const formatTime = useCallback((sec: number): string => {
    const isOverHour = sec >= 3600;
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = (sec % 60).toFixed(2);
    if (isOverHour) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
    }
    return `${mins}:${secs.padStart(5, '0')}`;
  }, []);

  const formatRulerLabel = useCallback((tSec: number, totalDur: number, stepSec: number): string => {
    const isOverHour = totalDur >= 3600 || tSec >= 3600;
    const h = Math.floor(tSec / 3600);
    const m = Math.floor((tSec % 3600) / 60);
    const s = Math.floor(tSec % 60);
    const ms = Math.floor((tSec % 1) * 10);

    if (isOverHour) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    if (stepSec < 1) {
      return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // 3. Draw Shared Top Time Ruler
  // Labels are spaced at least 80px apart; ruler canvas width matches content width so it scrolls synchronously
  useEffect(() => {
    const rulerCanvas = rulerCanvasRef.current;
    const container = scrollContainerRef.current;
    if (!rulerCanvas || !container || totalDuration <= 0) return;

    const ctx = rulerCanvas.getContext('2d');
    if (!ctx) return;

    const containerWidth = container.clientWidth || 800;
    const totalWidth = Math.max(containerWidth, timelineContentWidth);
    const height = 28;

    // Canvas width capped at safe GPU limit
    const canvasWidth = Math.min(32768, Math.ceil(totalWidth));
    rulerCanvas.width = canvasWidth;
    rulerCanvas.height = height;

    // Background
    ctx.clearRect(0, 0, canvasWidth, height);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvasWidth, height);

    // Bottom border line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(canvasWidth, height - 0.5);
    ctx.stroke();

    // Select label step such that adjacent labels are at least 80px apart
    const STEPS = [
      0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30,
      60, 120, 300, 600, 900, 1800, 3600
    ];
    let stepSec = STEPS.find((s) => s * pxPerSecond >= 80);
    if (!stepSec) {
      stepSec = Math.ceil(80 / pxPerSecond / 60) * 60;
    }

    // Minor ticks division
    let subDiv = 5;
    if (stepSec === 2) subDiv = 4;
    else if (stepSec === 15) subDiv = 3;
    else if (stepSec === 30 || stepSec === 60) subDiv = 6;
    else if (stepSec === 120) subDiv = 4;
    else if (stepSec === 300) subDiv = 5;
    else if (stepSec >= 600) subDiv = 10;
    const minorStepSec = stepSec / subDiv;

    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxTime = Math.min(totalDuration, canvasWidth / pxPerSecond);

    // Minor ticks
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 0; t <= maxTime; t += minorStepSec) {
      const x = Math.round(t * pxPerSecond) + 0.5;
      ctx.moveTo(x, height - 6);
      ctx.lineTo(x, height - 1);
    }
    ctx.stroke();

    // Major ticks
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 0; t <= maxTime; t += stepSec) {
      const x = Math.round(t * pxPerSecond) + 0.5;
      ctx.moveTo(x, height - 12);
      ctx.lineTo(x, height - 1);
    }
    ctx.stroke();

    // Text labels
    ctx.fillStyle = '#94a3b8';
    for (let t = 0; t <= maxTime; t += stepSec) {
      const x = t * pxPerSecond;
      if (x < 15 && t === 0) {
        ctx.textAlign = 'left';
        ctx.fillText(formatRulerLabel(t, totalDuration, stepSec), 4, 11);
        ctx.textAlign = 'center';
      } else if (x > canvasWidth - 25) {
        ctx.textAlign = 'right';
        ctx.fillText(formatRulerLabel(t, totalDuration, stepSec), canvasWidth - 4, 11);
        ctx.textAlign = 'center';
      } else {
        ctx.fillText(formatRulerLabel(t, totalDuration, stepSec), x, 11);
      }
    }
  }, [totalDuration, pxPerSecond, timelineContentWidth, formatRulerLabel]);

  // 4. Auto-scroll mechanism when dragging near viewport edges
  const stopAutoScroll = useCallback(() => {
    autoScrollRef.current.active = false;
    autoScrollRef.current.speed = 0;
    if (autoScrollAnimIdRef.current !== null) {
      cancelAnimationFrame(autoScrollAnimIdRef.current);
      autoScrollAnimIdRef.current = null;
    }
  }, []);

  const updateDragMove = useCallback(
    (clientX: number, clientY: number) => {
      const snap = dragSnapshotRef.current;
      const container = scrollContainerRef.current;
      if (!snap.mode || !container) return;

      const deltaPixelX =
        clientX - snap.initialClientX + (container.scrollLeft - snap.initialScrollLeft);
      const deltaSeconds = deltaPixelX / snap.initialPxPerSec;

      // 1. Moving Clip
      if (snap.mode === 'move' && snap.clipId) {
        let targetStart = Math.max(0, snap.initialStartTime + deltaSeconds);
        const maxStart = MAX_TIMELINE_DURATION - snap.clipDuration;
        targetStart = Math.min(maxStart, targetStart);

        // Snap target
        targetStart = getSnapTarget(targetStart, snap.clipId);
        const snappedDelta = targetStart - snap.initialStartTime;

        // Check vertical lane for target track
        let targetTrackId = snap.targetTrackId;
        const trackRows = container.querySelectorAll('[data-track-id]');
        trackRows.forEach((row) => {
          const rowRect = row.getBoundingClientRect();
          if (clientY >= rowRect.top && clientY <= rowRect.bottom) {
            const tId = row.getAttribute('data-track-id');
            if (tId) targetTrackId = tId;
          }
        });

        setLiveDragDeltaTime(snappedDelta);
        setLiveTargetTrackId(targetTrackId);
      }
      // 2. Trimming Left Edge
      else if (snap.mode === 'trim-left' && snap.clipId) {
        let newStartTime = snap.initialStartTime + deltaSeconds;
        newStartTime = Math.max(0, getSnapTarget(newStartTime, snap.clipId));

        const actualDelta = newStartTime - snap.initialStartTime;
        const newSourceStart = snap.initialSourceStart + actualDelta;

        if (newSourceStart >= 0 && newSourceStart < snap.initialSourceEnd - 0.05) {
          setLiveTrimLeft({
            startTime: newStartTime,
            sourceStart: newSourceStart,
          });
        }
      }
      // 3. Trimming Right Edge
      else if (snap.mode === 'trim-right' && snap.clipId) {
        const originalDuration = snap.initialSourceEnd - snap.initialSourceStart;
        let newTimelineEnd = snap.initialStartTime + originalDuration + deltaSeconds;
        newTimelineEnd = getSnapTarget(newTimelineEnd, snap.clipId);

        const newDuration = Math.max(0.05, newTimelineEnd - snap.initialStartTime);
        const targetClip = project.clips.find((c) => c.id === snap.clipId);
        const maxBufferDuration = targetClip ? targetClip.sourceBuffer.duration : 7200;
        const newSourceEnd = Math.min(maxBufferDuration, snap.initialSourceStart + newDuration);

        if (newSourceEnd > snap.initialSourceStart + 0.05) {
          setLiveTrimRight({ sourceEnd: newSourceEnd });
        }
      }
      // 4. Scrubbing Playhead
      else if (snap.mode === 'scrub-playhead') {
        const containerRect = container.getBoundingClientRect();
        const contentX = clientX - containerRect.left + container.scrollLeft;
        const scrubTime = Math.max(0, Math.min(totalDuration, contentX / pxPerSecond));
        onSeek(scrubTime);
      }
      // 5. Selecting Timeline Range
      else if (snap.mode === 'select-range') {
        const containerRect = container.getBoundingClientRect();
        const contentX = clientX - containerRect.left + container.scrollLeft;
        const currentTimeAtMouse = Math.max(0, contentX / pxPerSecond);
        const start = Math.min(snap.rangeStartTime, currentTimeAtMouse);
        const end = Math.max(snap.rangeStartTime, currentTimeAtMouse);
        onSelectionChange({ start, end });
      }
    },
    [getSnapTarget, onSeek, onSelectionChange, project.clips, pxPerSecond, totalDuration]
  );

  const startAutoScroll = useCallback(
    (speed: number) => {
      autoScrollRef.current.speed = speed;
      if (autoScrollRef.current.active) return;
      autoScrollRef.current.active = true;

      const loop = () => {
        const container = scrollContainerRef.current;
        if (!container || !autoScrollRef.current.active || autoScrollRef.current.speed === 0) {
          autoScrollRef.current.active = false;
          autoScrollAnimIdRef.current = null;
          return;
        }

        container.scrollLeft += autoScrollRef.current.speed;
        updateDragMove(autoScrollRef.current.lastClientX, autoScrollRef.current.lastClientY);
        autoScrollAnimIdRef.current = requestAnimationFrame(loop);
      };

      autoScrollAnimIdRef.current = requestAnimationFrame(loop);
    },
    [updateDragMove]
  );

  // Global window listeners for drag & auto-scroll
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      const snap = dragSnapshotRef.current;

      // Track height resizing
      if (resizingTrackId) {
        const deltaY = e.clientY - resizeStartY;
        const newHeight = Math.max(64, Math.min(220, initialTrackHeight + deltaY));
        onUpdateTrack(resizingTrackId, { height: newHeight });
        return;
      }

      if (!snap.mode) return;

      autoScrollRef.current.lastClientX = e.clientX;
      autoScrollRef.current.lastClientY = e.clientY;

      const container = scrollContainerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const EDGE_MARGIN = 40;
        let speed = 0;

        if (e.clientX < containerRect.left + EDGE_MARGIN) {
          const factor = (containerRect.left + EDGE_MARGIN - e.clientX) / EDGE_MARGIN;
          speed = -Math.min(24, Math.max(4, factor * 20));
        } else if (e.clientX > containerRect.right - EDGE_MARGIN) {
          const factor = (e.clientX - (containerRect.right - EDGE_MARGIN)) / EDGE_MARGIN;
          speed = Math.min(24, Math.max(4, factor * 20));
        }

        if (speed !== 0) {
          startAutoScroll(speed);
        } else {
          stopAutoScroll();
        }
      }

      updateDragMove(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      stopAutoScroll();

      const snap = dragSnapshotRef.current;

      // Commit Move ONCE to undo history on mouseUp
      if (snap.mode === 'move' && snap.clipId) {
        const clipsToMove = snap.selectedClipIds.length > 0 ? snap.selectedClipIds : [snap.clipId];
        if (liveDragDeltaTime !== 0 || (liveTargetTrackId && liveTargetTrackId !== snap.targetTrackId)) {
          onMoveClips(clipsToMove, liveDragDeltaTime, liveTargetTrackId || undefined);
        }
      }
      // Commit Trim Left ONCE
      else if (snap.mode === 'trim-left' && snap.clipId && liveTrimLeft) {
        onUpdateClip(snap.clipId, {
          startTime: liveTrimLeft.startTime,
          sourceStart: liveTrimLeft.sourceStart,
        });
      }
      // Commit Trim Right ONCE
      else if (snap.mode === 'trim-right' && snap.clipId && liveTrimRight) {
        onUpdateClip(snap.clipId, {
          sourceEnd: liveTrimRight.sourceEnd,
        });
      }

      // Reset states
      setResizingTrackId(null);
      setDragMode(null);
      setDraggingClipId(null);
      setLiveDragDeltaTime(0);
      setLiveTargetTrackId(null);
      setLiveTrimLeft(null);
      setLiveTrimRight(null);

      dragSnapshotRef.current = {
        mode: null,
        clipId: null,
        initialClientX: 0,
        initialScrollLeft: 0,
        initialPxPerSec: pxPerSecond,
        initialStartTime: 0,
        initialSourceStart: 0,
        initialSourceEnd: 0,
        clipDuration: 0,
        targetTrackId: null,
        selectedClipIds: [],
        rangeStartTime: 0,
        frozenProjectDuration: 60,
      };
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      stopAutoScroll();
    };
  }, [
    resizingTrackId,
    resizeStartY,
    initialTrackHeight,
    onUpdateTrack,
    startAutoScroll,
    stopAutoScroll,
    updateDragMove,
    liveDragDeltaTime,
    liveTargetTrackId,
    liveTrimLeft,
    liveTrimRight,
    onMoveClips,
    onUpdateClip,
    pxPerSecond,
  ]);

  // 5. Zoom & Viewport Centering Logic
  const applyZoomWithCenter = useCallback(
    (newZoom: number) => {
      const container = scrollContainerRef.current;
      if (!container || !onZoomChange) return;

      const currentPxPerSec = BASE_PX_PER_SEC * (zoom || 1);
      const viewportLeftTime = container.scrollLeft / currentPxPerSec;
      const viewportRightTime = (container.scrollLeft + container.clientWidth) / currentPxPerSec;

      let anchorTime: number;
      let anchorOffsetX: number;

      // Keep playhead stable if visible, else keep viewport center stable
      if (currentTime >= viewportLeftTime && currentTime <= viewportRightTime) {
        anchorTime = currentTime;
        anchorOffsetX = currentTime * currentPxPerSec - container.scrollLeft;
      } else {
        anchorTime = (container.scrollLeft + container.clientWidth / 2) / currentPxPerSec;
        anchorOffsetX = container.clientWidth / 2;
      }

      onZoomChange(newZoom);

      requestAnimationFrame(() => {
        const nextPxPerSec = BASE_PX_PER_SEC * newZoom;
        const targetScrollLeft = anchorTime * nextPxPerSec - anchorOffsetX;
        container.scrollLeft = Math.max(0, targetScrollLeft);
      });
    },
    [zoom, currentTime, onZoomChange]
  );

  // Ctrl + Wheel Zoom (keeping mouse pointer point stable)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (!onZoomChange) return;

        const rect = container.getBoundingClientRect();
        const mouseOffsetX = e.clientX - rect.left;
        const currentScrollLeft = container.scrollLeft;
        const currentPxPerSec = BASE_PX_PER_SEC * (zoom || 1);
        const timeUnderMouse = (currentScrollLeft + mouseOffsetX) / currentPxPerSec;

        const zoomFactor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const nextZoom = Math.max(0.15, Math.min(15, Number((zoom * zoomFactor).toFixed(3))));

        if (nextZoom !== zoom) {
          onZoomChange(nextZoom);
          requestAnimationFrame(() => {
            const nextPxPerSec = BASE_PX_PER_SEC * nextZoom;
            const targetScrollLeft = timeUnderMouse * nextPxPerSec - mouseOffsetX;
            container.scrollLeft = Math.max(0, targetScrollLeft);
          });
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, onZoomChange]);

  // "Vừa khung nhìn" (Fit to view): computes zoom ONCE on click
  const handleFitToView = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !onZoomChange) return;

    let maxEnd = 0;
    for (const clip of project.clips) {
      const end = clip.startTime + (clip.sourceEnd - clip.sourceStart);
      if (end > maxEnd) maxEnd = end;
    }

    const activeDuration = Math.max(10, maxEnd);
    const targetDurationWithMargin = activeDuration * 1.08;
    const availableWidth = Math.max(300, container.clientWidth - 40);

    const targetPxPerSec = availableWidth / targetDurationWithMargin;
    const targetZoom = Math.max(0.15, Math.min(10, Number((targetPxPerSec / BASE_PX_PER_SEC).toFixed(2))));

    onZoomChange(targetZoom);
    container.scrollLeft = 0;
  }, [project.clips, onZoomChange]);

  const selectedSet = useMemo(() => new Set(selectedClipIds), [selectedClipIds]);

  return (
    <div className="flex flex-col w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl select-none">
      {/* Top Multi-Track Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Thời gian:</span>
            <span className="text-cyan-400 font-semibold">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span>{formatTime(totalDuration)}</span>
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tracks:</span>
            <span className="text-cyan-300 font-semibold">{project.tracks.length}/8</span>
            <span className="text-slate-500">·</span>
            <span>Clips:</span>
            <span className="text-emerald-300 font-semibold">{project.clips.length}</span>
            {selectedClipIds.length > 0 && (
              <span className="text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded">
                Chọn: {selectedClipIds.length}
              </span>
            )}
          </div>

          {selection && selection.end > selection.start && (
            <div className="flex items-center gap-2 pl-3 border-l border-slate-700 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
              <span className="text-slate-300">Vùng:</span>
              <span>
                {formatTime(selection.start)} - {formatTime(selection.end)}
              </span>
              <span className="text-xs bg-emerald-800/60 text-emerald-200 px-1.5 py-0.2 rounded font-mono">
                Δ {(selection.end - selection.start).toFixed(2)}s
              </span>
              <button
                onClick={() => onSelectionChange(null)}
                className="text-slate-400 hover:text-rose-400 font-bold ml-1 cursor-pointer"
                title="Bỏ chọn"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap font-sans">
          {/* Snap (Bắt dính) Button */}
          <button
            onClick={onToggleSnap}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              isSnapEnabled
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Bật/Tắt bắt dính vào con trỏ, clip khác và vạch thời gian (Phím N)"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Bắt dính (N):</span>
            <strong className="font-mono">{isSnapEnabled ? 'BẬT' : 'TẮT'}</strong>
          </button>

          {/* Fit to View (Vừa khung nhìn) Button */}
          <button
            onClick={handleFitToView}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors cursor-pointer"
            title="Tự động thu phóng để vừa toàn bộ nội dung project"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vừa khung</span>
          </button>

          {/* Quick Zoom Buttons */}
          <div className="flex items-center gap-1 bg-slate-850 border border-slate-750 px-1.5 py-0.5 rounded-lg text-slate-300">
            <button
              onClick={() => applyZoomWithCenter(Math.max(0.15, Number((zoom / 1.25).toFixed(2))))}
              title="Thu nhỏ timeline (-)"
              className="p-1 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[11px] text-cyan-300 min-w-8 text-center px-1">
              {zoom >= 1 ? `${zoom.toFixed(1)}x` : `${zoom.toFixed(2)}x`}
            </span>
            <button
              onClick={() => applyZoomWithCenter(Math.min(15, Number((zoom * 1.25).toFixed(2))))}
              title="Phóng to timeline (+)"
              className="p-1 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            {zoom !== 1 && (
              <button
                onClick={() => applyZoomWithCenter(1.0)}
                title="Đặt lại mức zoom chuẩn (1x)"
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer ml-0.5"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Add Track Button */}
          {project.tracks.length < 8 && (
            <button
              onClick={onAddTrack}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-medium transition-colors cursor-pointer"
              title="Thêm track mới (Ctrl+T)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Track</span>
            </button>
          )}

          {hoverTime !== null && (
            <span className="text-slate-400 font-mono hidden md:inline">
              Con trỏ: <span className="text-slate-200">{formatTime(hoverTime)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Multi-Track Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT COLUMN: Fixed Track Control Headers */}
        <div className="w-56 sm:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-20 shadow-xl">
          {/* Top Ruler Placeholder */}
          <div className="h-7 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-3 text-[11px] font-semibold text-slate-400">
            <span>DANH SÁCH TRACK</span>
            <span>M / S / 🔒</span>
          </div>

          {/* Track Headers List */}
          <div className="flex flex-col divide-y divide-slate-800 overflow-y-auto custom-scrollbar">
            {project.tracks.map((track) => {
              const theme = TRACK_PALETTES[track.colorIndex % TRACK_PALETTES.length];
              const isSelected = selectedTrackId === track.id;

              return (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track.id)}
                  style={{ height: `${track.height}px` }}
                  className={`relative flex flex-col justify-between p-2.5 transition-colors cursor-pointer group ${
                    isSelected ? 'bg-slate-800/90' : 'bg-slate-900/80 hover:bg-slate-850'
                  }`}
                >
                  {/* Color stripe on far left */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: theme.border }}
                  />

                  {/* Header Top: Track Name & Quick Controls */}
                  <div className="flex items-center justify-between gap-1.5">
                    {/* Inline Name Editing */}
                    {editingTrackId === track.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingTrackName}
                        onChange={(e) => setEditingTrackName(e.target.value)}
                        onBlur={() => {
                          if (editingTrackName.trim()) {
                            onUpdateTrack(track.id, { name: editingTrackName.trim() });
                          }
                          setEditingTrackId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingTrackName.trim()) {
                              onUpdateTrack(track.id, { name: editingTrackName.trim() });
                            }
                            setEditingTrackId(null);
                          }
                        }}
                        className="px-1.5 py-0.5 text-xs bg-slate-950 border border-cyan-500 rounded text-cyan-200 font-semibold focus:outline-none w-28"
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingTrackId(track.id);
                          setEditingTrackName(track.name);
                        }}
                        title="Bấm đúp để đổi tên track"
                        className="text-xs font-semibold text-slate-200 truncate max-w-28 hover:text-cyan-300"
                      >
                        {track.name}
                      </span>
                    )}

                    {/* Mute, Solo, Lock Buttons */}
                    <div className="flex items-center gap-1">
                      {/* Mute Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTrack(track.id, { mute: !track.mute });
                        }}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer ${
                          track.mute
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                        title="Tắt tiếng track (Shift+M)"
                      >
                        M
                      </button>

                      {/* Solo Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTrack(track.id, { solo: !track.solo });
                        }}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer ${
                          track.solo
                            ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                        title="Nghe riêng track này (Shift+S)"
                      >
                        S
                      </button>

                      {/* Lock Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTrack(track.id, { locked: !track.locked });
                        }}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] transition-all cursor-pointer ${
                          track.locked
                            ? 'bg-red-950/80 text-rose-400 border border-rose-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                        title="Khoá track chống di chuyển / sửa"
                      >
                        {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>

                      {/* Delete Track Button */}
                      {project.tracks.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTrack(track.id);
                          }}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer ml-0.5"
                          title="Xoá track này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Header Bottom: Volume & Pan Controls */}
                  <div className="flex flex-col gap-1.5 mt-auto pt-1 border-t border-slate-800/60">
                    {/* Volume Slider */}
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Volume2 className="w-3 h-3 text-cyan-400" />
                        <span>Vol:</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="6"
                        step="0.5"
                        value={track.volumeDb}
                        onChange={(e) =>
                          onUpdateTrack(track.id, { volumeDb: parseFloat(e.target.value) })
                        }
                        className="w-20 accent-cyan-400 h-1 cursor-pointer"
                        title="Âm lượng track (dB)"
                      />
                      <span className="text-slate-300 w-10 text-right">
                        {track.volumeDb > 0 ? `+${track.volumeDb}` : track.volumeDb} dB
                      </span>
                    </div>

                    {/* Pan Slider (-100 to +100) */}
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                      <span className="text-slate-400">Pan:</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={track.pan}
                        onChange={(e) =>
                          onUpdateTrack(track.id, { pan: parseInt(e.target.value, 10) })
                        }
                        className="w-20 accent-amber-400 h-1 cursor-pointer"
                        title="Cân bằng Stereo trái/phải (-100 đến +100)"
                      />
                      <span className="text-slate-300 w-10 text-right">
                        {track.pan === 0
                          ? 'Center'
                          : track.pan < 0
                          ? `L${Math.abs(track.pan)}`
                          : `R${track.pan}`}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Resize Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setResizingTrackId(track.id);
                      setInitialTrackHeight(track.height);
                      setResizeStartY(e.clientY);
                    }}
                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-cyan-500/50 transition-colors z-30"
                    title="Kéo để chỉnh chiều cao track"
                  />
                </div>
              );
            })}

            {/* Bottom Add Track Button in Header Column */}
            {project.tracks.length < 8 && (
              <button
                onClick={onAddTrack}
                className="flex items-center justify-center gap-2 p-3 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 text-xs font-semibold border-t border-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm track ({project.tracks.length}/8)</span>
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Scrollable Timeline Lanes Canvas */}
        <div
          ref={scrollContainerRef}
          onMouseMove={(e) => {
            const container = scrollContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const clickX = e.clientX - rect.left + container.scrollLeft;
            setHoverTime(pixelToTime(clickX));
          }}
          onMouseDown={(e) => {
            // Clicked directly on timeline background -> start range selection & playhead seek
            const container = scrollContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const clickX = e.clientX - rect.left + container.scrollLeft;
            const clickTime = pixelToTime(clickX);

            dragSnapshotRef.current = {
              mode: 'select-range',
              clipId: null,
              initialClientX: e.clientX,
              initialScrollLeft: container.scrollLeft,
              initialPxPerSec: pxPerSecond,
              initialStartTime: 0,
              initialSourceStart: 0,
              initialSourceEnd: 0,
              clipDuration: 0,
              targetTrackId: null,
              selectedClipIds: [],
              rangeStartTime: clickTime,
              frozenProjectDuration: totalDuration,
            };

            setDragMode('select-range');
            onSelectionChange({ start: clickTime, end: clickTime });
            onSeek(clickTime);
          }}
          className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-slate-950 cursor-crosshair min-h-[300px]"
        >
          {/* Top Shared Time Ruler (Sticky at top, scrolls horizontally) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              const container = scrollContainerRef.current;
              if (!container) return;
              const rect = container.getBoundingClientRect();
              const clickX = e.clientX - rect.left + container.scrollLeft;
              const clickTime = pixelToTime(clickX);

              dragSnapshotRef.current = {
                mode: 'scrub-playhead',
                clipId: null,
                initialClientX: e.clientX,
                initialScrollLeft: container.scrollLeft,
                initialPxPerSec: pxPerSecond,
                initialStartTime: 0,
                initialSourceStart: 0,
                initialSourceEnd: 0,
                clipDuration: 0,
                targetTrackId: null,
                selectedClipIds: [],
                rangeStartTime: 0,
                frozenProjectDuration: totalDuration,
              };

              setDragMode('scrub-playhead');
              onSeek(clickTime);
            }}
            className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 cursor-pointer"
          >
            <canvas ref={rulerCanvasRef} className="block" />
          </div>

          {/* Vertical Playhead Cursor */}
          <div
            style={{
              left: `${timeToPixel(currentTime)}px`,
            }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-40 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.8)]"
          >
            {/* Playhead Top Marker */}
            <div className="absolute -top-0 -left-1.5 w-3.5 h-3.5 bg-rose-500 rotate-45 transform origin-center shadow-md" />
          </div>

          {/* Time Selection Range Box spanning all tracks */}
          {selection && selection.end > selection.start && (
            <div
              style={{
                left: `${timeToPixel(selection.start)}px`,
                width: `${Math.max(2, timeToPixel(selection.end) - timeToPixel(selection.start))}px`,
              }}
              className="absolute top-7 bottom-0 bg-cyan-500/15 border-x border-cyan-400 z-20 pointer-events-none"
            />
          )}

          {/* Track Lanes */}
          <div className="flex flex-col divide-y divide-slate-800/80">
            {project.tracks.map((track, trackIndex) => {
              const theme = TRACK_PALETTES[track.colorIndex % TRACK_PALETTES.length];
              const containerWidth = Math.max(
                scrollContainerRef.current?.clientWidth || 800,
                timelineContentWidth
              );

              // Find clips on this track, considering live drag preview track switching
              const trackClips = project.clips.filter((c) => {
                if (dragMode === 'move' && draggingClipId === c.id && liveTargetTrackId) {
                  return liveTargetTrackId === track.id;
                }
                return c.trackId === track.id;
              });

              return (
                <div
                  key={track.id}
                  data-track-id={track.id}
                  style={{ height: `${track.height}px`, width: `${containerWidth}px` }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const filesArray = Array.from(e.dataTransfer.files);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const dropX = e.clientX - rect.left;
                      const dropTime = pixelToTime(dropX);
                      onDropFilesOnTrack(filesArray, track.id, Math.max(0, dropTime));
                    }
                  }}
                  className={`relative flex items-center transition-colors ${
                    trackIndex % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/30'
                  }`}
                >
                  {/* Subtle Grid Lines inside Lane */}
                  {renderConfig.showGrid && (
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#334155_1px,transparent_1px)] bg-[size:40px_100%]" />
                  )}

                  {/* Clips on this Track */}
                  {trackClips.map((clip) => {
                    const isSelected = selectedSet.has(clip.id);
                    const isBeingDragged = draggingClipId === clip.id;
                    const isGroupMove = dragMode === 'move' && selectedSet.has(clip.id);

                    // Compute effective preview values during live drag
                    let effectiveStartTime = clip.startTime;
                    let effectiveSourceStart = clip.sourceStart;
                    let effectiveSourceEnd = clip.sourceEnd;

                    if ((isBeingDragged || isGroupMove) && dragMode === 'move') {
                      effectiveStartTime = Math.max(0, clip.startTime + liveDragDeltaTime);
                    } else if (isBeingDragged && dragMode === 'trim-left' && liveTrimLeft) {
                      effectiveStartTime = liveTrimLeft.startTime;
                      effectiveSourceStart = liveTrimLeft.sourceStart;
                    } else if (isBeingDragged && dragMode === 'trim-right' && liveTrimRight) {
                      effectiveSourceEnd = liveTrimRight.sourceEnd;
                    }

                    const clipDuration = Math.max(0.05, effectiveSourceEnd - effectiveSourceStart);
                    const leftPx = timeToPixel(effectiveStartTime);
                    const widthPx = Math.max(8, timeToPixel(clipDuration));

                    // Waveform peaks extraction with caching
                    const cacheKey = `${clip.id}_${Math.floor(effectiveSourceStart * 10)}_${Math.floor(
                      effectiveSourceEnd * 10
                    )}_${Math.floor(widthPx)}`;
                    let peaks = clipPeaksCacheRef.current.get(cacheKey);
                    if (!peaks) {
                      peaks = extractClipPeaks(
                        clip.sourceBuffer,
                        effectiveSourceStart,
                        effectiveSourceEnd,
                        Math.max(40, Math.floor(widthPx * 1.2))
                      );
                      clipPeaksCacheRef.current.set(cacheKey, peaks);
                    }

                    return (
                      <div
                        key={clip.id}
                        style={{
                          left: `${leftPx}px`,
                          width: `${widthPx}px`,
                          height: `${track.height - 10}px`,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (track.locked) return;

                          onSelectClip(clip.id, e.ctrlKey || e.metaKey, e.shiftKey);

                          const container = scrollContainerRef.current;
                          const currentScrollLeft = container ? container.scrollLeft : 0;

                          dragSnapshotRef.current = {
                            mode: 'move',
                            clipId: clip.id,
                            initialClientX: e.clientX,
                            initialScrollLeft: currentScrollLeft,
                            initialPxPerSec: pxPerSecond,
                            initialStartTime: clip.startTime,
                            initialSourceStart: clip.sourceStart,
                            initialSourceEnd: clip.sourceEnd,
                            clipDuration: clip.sourceEnd - clip.sourceStart,
                            targetTrackId: clip.trackId,
                            selectedClipIds: selectedSet.has(clip.id) ? selectedClipIds : [clip.id],
                            rangeStartTime: 0,
                            frozenProjectDuration: totalDuration,
                          };

                          setDraggingClipId(clip.id);
                          setDragMode('move');
                          setLiveDragDeltaTime(0);
                          setLiveTargetTrackId(clip.trackId);
                        }}
                        className={`absolute rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-shadow z-10 ${
                          isSelected
                            ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] z-20'
                            : 'border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {/* Clip Background */}
                        <div
                          className="absolute inset-0 opacity-80"
                          style={{
                            backgroundColor: isSelected ? theme.selectedBg : theme.bg,
                          }}
                        />

                        {/* Top Header Tag inside Clip */}
                        <div
                          className="absolute top-0 left-0 right-0 h-4.5 px-1.5 flex items-center justify-between text-[10px] font-mono text-slate-100 z-10"
                          style={{ backgroundColor: isSelected ? theme.tag : 'rgba(15,23,42,0.85)' }}
                        >
                          <span className="truncate font-semibold">{clip.name}</span>
                          <span className="text-[9px] opacity-80 shrink-0 ml-1">
                            {clipDuration.toFixed(1)}s
                          </span>
                        </div>

                        {/* Render Waveform Canvas */}
                        <div className="absolute inset-0 pt-4 flex items-center justify-center pointer-events-none">
                          <ClipWaveformCanvas
                            peaks={peaks}
                            width={widthPx}
                            height={track.height - 26}
                            color={isSelected ? theme.selectedBorder : theme.wave}
                            isStereo={track.height >= 90 && clip.sourceBuffer.numberOfChannels > 1}
                            leftPeaks={
                              track.height >= 90 && clip.sourceBuffer.numberOfChannels > 1
                                ? extractClipPeaks(
                                    clip.sourceBuffer,
                                    effectiveSourceStart,
                                    effectiveSourceEnd,
                                    Math.max(40, Math.floor(widthPx * 1.2))
                                  )
                                : null
                            }
                          />
                        </div>

                        {/* Left Trim Handle */}
                        {!track.locked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id, false, false);
                              const container = scrollContainerRef.current;
                              const currentScrollLeft = container ? container.scrollLeft : 0;

                              dragSnapshotRef.current = {
                                mode: 'trim-left',
                                clipId: clip.id,
                                initialClientX: e.clientX,
                                initialScrollLeft: currentScrollLeft,
                                initialPxPerSec: pxPerSecond,
                                initialStartTime: clip.startTime,
                                initialSourceStart: clip.sourceStart,
                                initialSourceEnd: clip.sourceEnd,
                                clipDuration: clip.sourceEnd - clip.sourceStart,
                                targetTrackId: clip.trackId,
                                selectedClipIds: [clip.id],
                                rangeStartTime: 0,
                                frozenProjectDuration: totalDuration,
                              };

                              setDraggingClipId(clip.id);
                              setDragMode('trim-left');
                              setLiveTrimLeft({
                                startTime: clip.startTime,
                                sourceStart: clip.sourceStart,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-cyan-400/50 z-20 flex items-center justify-center group/trim"
                            title="Kéo mép trái để cắt bớt đầu (Trim)"
                          >
                            <div className="w-1 h-3 bg-cyan-400/60 rounded-full group-hover/trim:bg-cyan-300" />
                          </div>
                        )}

                        {/* Right Trim Handle */}
                        {!track.locked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id, false, false);
                              const container = scrollContainerRef.current;
                              const currentScrollLeft = container ? container.scrollLeft : 0;

                              dragSnapshotRef.current = {
                                mode: 'trim-right',
                                clipId: clip.id,
                                initialClientX: e.clientX,
                                initialScrollLeft: currentScrollLeft,
                                initialPxPerSec: pxPerSecond,
                                initialStartTime: clip.startTime,
                                initialSourceStart: clip.sourceStart,
                                initialSourceEnd: clip.sourceEnd,
                                clipDuration: clip.sourceEnd - clip.sourceStart,
                                targetTrackId: clip.trackId,
                                selectedClipIds: [clip.id],
                                rangeStartTime: 0,
                                frozenProjectDuration: totalDuration,
                              };

                              setDraggingClipId(clip.id);
                              setDragMode('trim-right');
                              setLiveTrimRight({ sourceEnd: clip.sourceEnd });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-cyan-400/50 z-20 flex items-center justify-center group/trim"
                            title="Kéo mép phải để cắt bớt đuôi (Trim)"
                          >
                            <div className="w-1 h-3 bg-cyan-400/60 rounded-full group-hover/trim:bg-cyan-300" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Bottom Empty Drop Area to Add Track */}
            {project.tracks.length < 8 && (
              <div
                style={{
                  width: `${Math.max(
                    scrollContainerRef.current?.clientWidth || 800,
                    timelineContentWidth
                  )}px`,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const filesArray = Array.from(e.dataTransfer.files);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const dropX = e.clientX - rect.left;
                    const dropTime = pixelToTime(dropX);
                    onDropFilesNewTrack(filesArray, Math.max(0, dropTime));
                  }
                }}
                className="h-20 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 flex items-center justify-center text-slate-500 text-xs font-medium gap-2 m-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Kéo-thả file âm thanh vào đây để tự động tạo Track mới</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ClipWaveformCanvasProps {
  peaks: Float32Array;
  width: number;
  height: number;
  color: string;
  isStereo?: boolean;
  leftPeaks?: Float32Array | null;
}

const ClipWaveformCanvas: React.FC<ClipWaveformCanvasProps> = ({
  peaks,
  width,
  height,
  color,
  isStereo = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = Math.max(10, width);
    canvas.height = Math.max(10, height);

    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const halfH = centerY - 2;
    const numBuckets = peaks.length / 2;

    ctx.fillStyle = color;

    for (let x = 0; x < width; x += 2) {
      const bIdx = Math.floor((x / width) * numBuckets);
      const minVal = peaks[bIdx * 2] || 0;
      const maxVal = peaks[bIdx * 2 + 1] || 0;

      const yTop = centerY - maxVal * halfH;
      const yBottom = centerY - minVal * halfH;
      const barH = Math.max(1.5, yBottom - yTop);

      ctx.fillRect(x, yTop, 1.5, barH);
    }
  }, [peaks, width, height, color, isStereo]);

  return <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />;
};
