/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Scissors,
  Music2,
  Sliders,
  Sparkles,
  ListMusic,
  Palette,
  ShieldCheck,
} from 'lucide-react';
import {
  SelectionRange,
  ProjectClip,
  AudioTrack,
  MultiTrackProject,
  HistoryState,
  EQBand,
  EffectSettings,
  PitchTempoSettings,
  WaveformRenderConfig,
  AntiRecognitionSettings,
} from './types/audio';
import { multiTrackEngine } from './services/multiTrackEngine';
import { audioEngine } from './services/audioEngine';
import {
  cropAudioBuffer,
  reverseAudio,
  normalizeAudio,
  applyFadeIn,
  applyFadeOut,
  cloneAudioBuffer,
} from './services/audioOperations';
import { processPitchAndTempo } from './services/pitchTempo';
import { renderEffects, DEFAULT_EFFECT_SETTINGS } from './services/audioEffects';
import { applyAntiRecognition } from './services/antiRecognition';

import { Header } from './components/Header';
import { MultiTrackTimeline, TRACK_PALETTES } from './components/MultiTrackTimeline';
import { TransportBar } from './components/TransportBar';
import { SpectrumVisualizer } from './components/SpectrumVisualizer';
import { StatusBar } from './components/StatusBar';
import { EditToolsTab } from './components/tabs/EditToolsTab';
import { PitchTempoTab } from './components/tabs/PitchTempoTab';
import { EqualizerTab } from './components/tabs/EqualizerTab';
import { EffectsTab } from './components/tabs/EffectsTab';
import { AntiScanTab } from './components/tabs/AntiScanTab';
import { ExportModal } from './components/ExportModal';
import { RecordModal } from './components/RecordModal';
import { GuideModal } from './components/GuideModal';
import { WaveformStyleModal } from './components/WaveformStyleModal';
import { AudioStatsModal } from './components/AudioStatsModal';

export default function App() {
  // --- MULTI-TRACK PROJECT STATE ---
  const [project, setProject] = useState<MultiTrackProject>(() => {
    const initialTrack: AudioTrack = {
      id: 'track-1',
      name: 'Track 1 (Vocal / Main)',
      colorIndex: 0,
      volumeDb: 0,
      pan: 0,
      mute: false,
      solo: false,
      locked: false,
      height: 96,
    };
    return {
      tracks: [initialTrack],
      clips: [],
    };
  });

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('track-1');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loopSelection, setLoopSelection] = useState<boolean>(false);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [isSnapEnabled, setIsSnapEnabled] = useState<boolean>(true);
  const [isSoloClipActive, setIsSoloClipActive] = useState<boolean>(false);

  // Active filename representation for Header & Modals
  const [activeFilename, setActiveFilename] = useState<string>('project-am-thanh.wav');

  // Clipboard for clips
  const [clipboardClips, setClipboardClips] = useState<ProjectClip[]>([]);

  // 60-step Immutable Undo / Redo History
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // UI Tabs & Modals
  const [activeTab, setActiveTab] = useState<'edit' | 'pitch' | 'eq' | 'effects' | 'antiScan'>('edit');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState<boolean>(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);

  // Waveform Visual Template
  const [waveformConfig, setWaveformConfig] = useState<WaveformRenderConfig>({
    template: 'classic',
    colorScheme: 'cyan',
    showGrid: true,
    glowEffect: true,
    barWidth: 1,
    barGap: 0,
    showSpectrogram: false,
    spectrogramOpacity: 0.35,
    spectrogramPalette: 'magma',
  });

  // Live Audition Preview state
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Toast notification
  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage('');
    }, 4000);
  }, []);

  /**
   * Commit a project state change into the undo/redo stack
   */
  const commitProjectChange = useCallback(
    (newProject: MultiTrackProject, description: string, newSelectedClipIds?: string[]) => {
      setProject(newProject);
      if (newSelectedClipIds !== undefined) {
        setSelectedClipIds(newSelectedClipIds);
      }

      // Update multiTrackEngine nodes
      multiTrackEngine.setupTrackNodes(newProject.tracks);

      const newHistoryItem: HistoryState = {
        project: newProject,
        selectedClipIds: newSelectedClipIds ?? selectedClipIds,
        selectedTrackId,
        name: activeFilename,
        description,
        timestamp: Date.now(),
      };

      const updatedHistory = history.slice(0, historyIndex + 1);
      if (updatedHistory.length >= 60) {
        updatedHistory.shift();
      }
      updatedHistory.push(newHistoryItem);

      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
      showToast(`Đã áp dụng: ${description}`);
    },
    [activeFilename, history, historyIndex, selectedClipIds, selectedTrackId, showToast]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const targetState = history[prevIndex];
      setHistoryIndex(prevIndex);
      setProject(targetState.project);
      setSelectedClipIds(targetState.selectedClipIds);
      setSelectedTrackId(targetState.selectedTrackId);
      multiTrackEngine.setupTrackNodes(targetState.project.tracks);
      multiTrackEngine.stop();
      setIsPlaying(false);
      showToast(`Hoàn tác: ${history[historyIndex].description}`);
    }
  }, [history, historyIndex, showToast]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const targetState = history[nextIndex];
      setHistoryIndex(nextIndex);
      setProject(targetState.project);
      setSelectedClipIds(targetState.selectedClipIds);
      setSelectedTrackId(targetState.selectedTrackId);
      multiTrackEngine.setupTrackNodes(targetState.project.tracks);
      multiTrackEngine.stop();
      setIsPlaying(false);
      showToast(`Làm lại: ${targetState.description}`);
    }
  }, [history, historyIndex, showToast]);

  // Synchronize playback currentTime from multiTrackEngine
  useEffect(() => {
    const unsubTime = multiTrackEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });
    const unsubEnd = multiTrackEngine.onPlaybackEnd(() => {
      setIsPlaying(false);
    });
    return () => {
      unsubTime();
      unsubEnd();
    };
  }, []);

  // Play / Pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      multiTrackEngine.pause();
      setIsPlaying(false);
    } else {
      const soloId = isSoloClipActive && selectedClipIds.length === 1 ? selectedClipIds[0] : null;
      multiTrackEngine.play(project, currentTime, loopSelection, selection, soloId);
      setIsPlaying(true);
    }
  }, [isPlaying, isSoloClipActive, selectedClipIds, project, currentTime, loopSelection, selection]);

  // Stop
  const handleStop = useCallback(() => {
    multiTrackEngine.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Seek
  const handleSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
      multiTrackEngine.seek(project, time);
    },
    [project]
  );

  // Selected Primary Clip
  const primarySelectedClip = useMemo(() => {
    if (selectedClipIds.length === 0) return null;
    return project.clips.find((c) => c.id === selectedClipIds[0]) || null;
  }, [project.clips, selectedClipIds]);

  // Selected Track object
  const currentSelectedTrack = useMemo(() => {
    return project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0] || null;
  }, [project.tracks, selectedTrackId]);

  // Clip buffer for downstream tabs (EQ, Effects, Pitch/Tempo, Anti-Scan)
  const activeWorkingBuffer = useMemo(() => {
    if (primarySelectedClip) {
      return primarySelectedClip.sourceBuffer;
    }
    if (project.clips.length > 0) {
      return project.clips[0].sourceBuffer;
    }
    return null;
  }, [primarySelectedClip, project.clips]);

  // Stop audition preview
  const stopAuditionPreview = useCallback(() => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      previewSourceRef.current = null;
    }
    setIsPreviewing(false);
  }, []);

  // Start audition preview
  const startAuditionPreview = useCallback(
    (buffer: AudioBuffer) => {
      stopAuditionPreview();
      const ctx = multiTrackEngine.getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(multiTrackEngine.getMasterGain());

      previewSourceRef.current = source;
      setIsPreviewing(true);

      source.onended = () => {
        setIsPreviewing(false);
        previewSourceRef.current = null;
      };

      source.start(0);
    },
    [stopAuditionPreview]
  );

  // =========================================================================
  // MULTI-TRACK TRACK ACTIONS
  // =========================================================================

  const handleAddTrack = useCallback(() => {
    if (project.tracks.length >= 8) {
      showToast('Đã đạt giới hạn tối đa 8 track.');
      return;
    }

    const nextIdx = project.tracks.length;
    const newTrack: AudioTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `Track ${nextIdx + 1} (${TRACK_PALETTES[nextIdx % TRACK_PALETTES.length].name})`,
      colorIndex: nextIdx % TRACK_PALETTES.length,
      volumeDb: 0,
      pan: 0,
      mute: false,
      solo: false,
      locked: false,
      height: 96,
    };

    const updated = {
      ...project,
      tracks: [...project.tracks, newTrack],
    };

    setSelectedTrackId(newTrack.id);
    commitProjectChange(updated, `Thêm ${newTrack.name}`);
  }, [project, commitProjectChange, showToast]);

  const handleDeleteTrack = useCallback(
    (trackId: string) => {
      if (project.tracks.length <= 1) {
        showToast('Không thể xoá track duy nhất còn lại.');
        return;
      }

      const updatedTracks = project.tracks.filter((t) => t.id !== trackId);
      const updatedClips = project.clips.filter((c) => c.trackId !== trackId);

      const nextSelected = updatedTracks[0].id;
      setSelectedTrackId(nextSelected);

      commitProjectChange(
        { tracks: updatedTracks, clips: updatedClips },
        'Xoá track khỏi project'
      );
    },
    [project, commitProjectChange, showToast]
  );

  const handleUpdateTrack = useCallback(
    (trackId: string, updates: Partial<AudioTrack>) => {
      const updatedTracks = project.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t));
      const updatedProject = { ...project, tracks: updatedTracks };
      setProject(updatedProject);
      multiTrackEngine.setupTrackNodes(updatedTracks);
    },
    [project]
  );

  // =========================================================================
  // MULTI-TRACK CLIP ACTIONS
  // =========================================================================

  const handleSelectClip = useCallback(
    (clipId: string, isCtrl: boolean, isShift: boolean) => {
      if (isCtrl) {
        setSelectedClipIds((prev) =>
          prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
        );
      } else if (isShift && selectedClipIds.length > 0) {
        const lastSelectedId = selectedClipIds[selectedClipIds.length - 1];
        const lastIdx = project.clips.findIndex((c) => c.id === lastSelectedId);
        const targetIdx = project.clips.findIndex((c) => c.id === clipId);

        if (lastIdx !== -1 && targetIdx !== -1) {
          const minIdx = Math.min(lastIdx, targetIdx);
          const maxIdx = Math.max(lastIdx, targetIdx);
          const rangeClipIds = project.clips.slice(minIdx, maxIdx + 1).map((c) => c.id);
          setSelectedClipIds(rangeClipIds);
        } else {
          setSelectedClipIds([clipId]);
        }
      } else {
        setSelectedClipIds([clipId]);
        // Also focus that clip's track
        const target = project.clips.find((c) => c.id === clipId);
        if (target) {
          setSelectedTrackId(target.trackId);
        }
      }
    },
    [project.clips, selectedClipIds]
  );

  const handleUpdateClip = useCallback(
    (clipId: string, updates: Partial<ProjectClip>) => {
      const updatedClips = project.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
      commitProjectChange({ ...project, clips: updatedClips }, 'Chỉnh sửa clip');
    },
    [project, commitProjectChange]
  );

  const handleMoveClips = useCallback(
    (clipIds: string[], deltaTime: number, targetTrackId?: string) => {
      const idSet = new Set(clipIds);
      const updatedClips = project.clips.map((clip) => {
        if (!idSet.has(clip.id)) return clip;
        const newStartTime = Math.max(0, clip.startTime + deltaTime);
        return {
          ...clip,
          startTime: newStartTime,
          trackId: targetTrackId || clip.trackId,
        };
      });

      commitProjectChange({ ...project, clips: updatedClips }, 'Di chuyển clip');
    },
    [project, commitProjectChange]
  );

  // TÁCH ĐÔI (S):
  // - If clip is selected, splits that clip at playhead
  // - If no clip is selected, splits all clips at playhead on unlocked tracks
  const handleSplit = useCallback(() => {
    const lockedTrackIds = new Set(project.tracks.filter((t) => t.locked).map((t) => t.id));
    let clipsToSplit: ProjectClip[] = [];

    if (selectedClipIds.length > 0) {
      clipsToSplit = project.clips.filter(
        (c) => selectedClipIds.includes(c.id) && !lockedTrackIds.has(c.trackId)
      );
    } else {
      clipsToSplit = project.clips.filter((c) => {
        if (lockedTrackIds.has(c.trackId)) return false;
        const end = c.startTime + (c.sourceEnd - c.sourceStart);
        return currentTime > c.startTime + 0.02 && currentTime < end - 0.02;
      });
    }

    if (clipsToSplit.length === 0) {
      showToast('Không có clip nào tại vị trí con trỏ để tách.');
      return;
    }

    const splitIds = new Set(clipsToSplit.map((c) => c.id));
    const newClips: ProjectClip[] = [];
    const createdSecondClipIds: string[] = [];

    for (const clip of project.clips) {
      if (!splitIds.has(clip.id)) {
        newClips.push(clip);
        continue;
      }

      const offsetInClip = currentTime - clip.startTime;
      const splitSourcePoint = clip.sourceStart + offsetInClip;

      const baseName = clip.name.replace(/\s*\(\d+\)$/, '');
      const newId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      const clipA: ProjectClip = {
        ...clip,
        name: `${baseName} (1)`,
        sourceEnd: splitSourcePoint,
      };

      const clipB: ProjectClip = {
        id: newId,
        trackId: clip.trackId,
        name: `${baseName} (2)`,
        sourceBuffer: clip.sourceBuffer,
        sourceStart: splitSourcePoint,
        sourceEnd: clip.sourceEnd,
        startTime: currentTime,
        colorIndex: clip.colorIndex,
      };

      newClips.push(clipA, clipB);
      createdSecondClipIds.push(newId);
    }

    commitProjectChange(
      { ...project, clips: newClips },
      `Tách ${clipsToSplit.length} clip tại ${currentTime.toFixed(2)}s`,
      createdSecondClipIds
    );
  }, [project, selectedClipIds, currentTime, commitProjectChange, showToast]);

  // DELETE SELECTED CLIPS OR TIME RANGE
  const handleDeleteSelection = useCallback(() => {
    if (selectedClipIds.length > 0) {
      const deleteSet = new Set(selectedClipIds);
      const updatedClips = project.clips.filter((c) => !deleteSet.has(c.id));
      commitProjectChange(
        { ...project, clips: updatedClips },
        `Xoá ${selectedClipIds.length} clip`,
        []
      );
      showToast(`Đã xoá ${selectedClipIds.length} clip.`);
    } else if (selection && selection.end > selection.start) {
      // Delete portion of clips intersecting selection
      const updatedClips = project.clips.filter((c) => {
        const cEnd = c.startTime + (c.sourceEnd - c.sourceStart);
        return !(c.startTime >= selection.start && cEnd <= selection.end);
      });
      commitProjectChange({ ...project, clips: updatedClips }, 'Xoá vùng chọn timeline', []);
      setSelection(null);
    }
  }, [selectedClipIds, selection, project, commitProjectChange, showToast]);

  // MERGE / BOUNCE SELECTED CLIPS
  const handleMergeSelectedClips = useCallback(async () => {
    if (selectedClipIds.length < 2) {
      showToast('Vui lòng chọn từ 2 clip trở lên để ghép.');
      return;
    }

    const clipsToMerge = project.clips.filter((c) => selectedClipIds.includes(c.id));
    if (clipsToMerge.length < 2) return;

    setIsProcessing(true);
    try {
      const mergedBuffer = await multiTrackEngine.mergeClipsToBuffer(clipsToMerge);
      const minStartTime = Math.min(...clipsToMerge.map((c) => c.startTime));
      const targetTrackId = selectedTrackId || clipsToMerge[0].trackId;

      const newClip: ProjectClip = {
        id: `clip-bounced-${Date.now()}`,
        trackId: targetTrackId,
        name: `Bounced (${clipsToMerge.length} clips)`,
        sourceBuffer: mergedBuffer,
        sourceStart: 0,
        sourceEnd: mergedBuffer.duration,
        startTime: minStartTime,
      };

      // Remove merged clips and insert new merged clip
      const removeSet = new Set(selectedClipIds);
      const remainingClips = project.clips.filter((c) => !removeSet.has(c.id));

      commitProjectChange(
        { ...project, clips: [...remainingClips, newClip] },
        `Ghép ${clipsToMerge.length} clip thành clip duy nhất`,
        [newClip.id]
      );
      showToast(`Đã ghép thành công ${clipsToMerge.length} clip!`);
    } catch (err) {
      console.error('Merge error:', err);
      showToast('Lỗi khi ghép các clip đã chọn.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedClipIds, project, selectedTrackId, commitProjectChange, showToast]);

  // COPY CLIPS
  const handleCopy = useCallback(() => {
    const selected = project.clips.filter((c) => selectedClipIds.includes(c.id));
    if (selected.length === 0) return;
    setClipboardClips(selected.map((c) => ({ ...c })));
    showToast(`Đã sao chép ${selected.length} clip vào bộ nhớ tạm.`);
  }, [project.clips, selectedClipIds, showToast]);

  // PASTE CLIPS
  const handlePaste = useCallback(() => {
    if (clipboardClips.length === 0) return;
    const targetTrackId = selectedTrackId || project.tracks[0].id;
    const minOrigStart = Math.min(...clipboardClips.map((c) => c.startTime));

    const pastedClips = clipboardClips.map((clip) => {
      const offset = clip.startTime - minOrigStart;
      return {
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        trackId: targetTrackId,
        startTime: currentTime + offset,
      };
    });

    const newIds = pastedClips.map((c) => c.id);
    const targetTrack = project.tracks.find((t) => t.id === targetTrackId) || project.tracks[0];
    const targetTrackName = targetTrack?.name || currentSelectedTrack?.name || 'Track';
    commitProjectChange(
      { ...project, clips: [...project.clips, ...pastedClips] },
      `Dán ${pastedClips.length} clip vào track ${targetTrackName}`,
      newIds
    );
  }, [clipboardClips, selectedTrackId, project, currentTime, currentSelectedTrack, commitProjectChange]);

  // DUPLICATE CLIPS
  const handleDuplicate = useCallback(() => {
    const selected = project.clips.filter((c) => selectedClipIds.includes(c.id));
    if (selected.length === 0) return;

    const duplicated = selected.map((clip) => {
      const dur = clip.sourceEnd - clip.sourceStart;
      return {
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        startTime: clip.startTime + dur + 0.5,
      };
    });

    const newIds = duplicated.map((c) => c.id);
    commitProjectChange(
      { ...project, clips: [...project.clips, ...duplicated] },
      `Nhân đôi ${duplicated.length} clip`,
      newIds
    );
  }, [project, selectedClipIds, commitProjectChange]);

  // CROP (CHỈ GIỮ VÙNG CHỌN)
  const handleCrop = useCallback(() => {
    if (!selection || selection.end <= selection.start) return;

    const croppedClips: ProjectClip[] = [];
    for (const clip of project.clips) {
      const cEnd = clip.startTime + (clip.sourceEnd - clip.sourceStart);
      if (cEnd <= selection.start || clip.startTime >= selection.end) continue;

      const newStart = Math.max(0, clip.startTime - selection.start);
      const cutFront = Math.max(0, selection.start - clip.startTime);
      const newSourceStart = clip.sourceStart + cutFront;
      const newDuration = Math.min(
        clip.sourceEnd - newSourceStart,
        selection.end - Math.max(clip.startTime, selection.start)
      );

      croppedClips.push({
        ...clip,
        startTime: newStart,
        sourceStart: newSourceStart,
        sourceEnd: newSourceStart + newDuration,
      });
    }

    commitProjectChange(
      { ...project, clips: croppedClips },
      'Chỉ giữ vùng chọn (xoá phần ngoài)',
      []
    );
    setSelection(null);
    setCurrentTime(0);
  }, [selection, project, commitProjectChange]);

  // MASTER NORMALIZATION
  const handleNormalizeMaster = useCallback(async () => {
    if (project.clips.length === 0) return;
    setIsProcessing(true);
    try {
      const suggestedDb = await multiTrackEngine.calculateMasterNormalizationGain(project);
      if (Math.abs(suggestedDb) < 0.2) {
        showToast('Mức âm tổng đã đạt chuẩn tối ưu (-0.1 dBFS).');
        return;
      }

      // Adjust all active track volumes proportionally
      const updatedTracks = project.tracks.map((t) => ({
        ...t,
        volumeDb: Math.max(-40, Math.min(10, parseFloat((t.volumeDb + suggestedDb).toFixed(1)))),
      }));

      commitProjectChange(
        { ...project, tracks: updatedTracks },
        `Chuẩn hoá Master (${suggestedDb > 0 ? `+${suggestedDb.toFixed(1)}` : suggestedDb.toFixed(1)} dB)`
      );
      showToast(`Đã chuẩn hoá Master: bù ${suggestedDb.toFixed(1)} dB.`);
    } catch (err) {
      console.error('Normalize error:', err);
      showToast('Lỗi khi chuẩn hoá master.');
    } finally {
      setIsProcessing(false);
    }
  }, [project, commitProjectChange, showToast]);

  // =========================================================================
  // FILE LOADING & RECORDING
  // =========================================================================

  const handleOpenFiles = useCallback(
    async (files: File[] | FileList) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      const targetTrack = project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0];
      const targetTrackId = targetTrack?.id || 'track-1';
      const targetTrackName = targetTrack?.name || currentSelectedTrack?.name || 'Track 1';
      const newClips: ProjectClip[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file) continue;
        try {
          const decoded = await audioEngine.decodeAudioFile(file);
          const clip: ProjectClip = {
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            trackId: targetTrackId,
            name: file.name.replace(/\.[^/.]+$/, ''),
            sourceBuffer: decoded,
            sourceStart: 0,
            sourceEnd: decoded.duration,
            startTime: currentTime + i * 2,
          };
          newClips.push(clip);
        } catch (err) {
          console.error('Failed to decode file:', err);
          showToast(`Không thể đọc file "${file.name}".`);
        }
      }

      if (newClips.length > 0) {
        const firstFileName = fileList[0]?.name || 'audio-track.wav';
        setActiveFilename(firstFileName);
        commitProjectChange(
          { ...project, clips: [...project.clips, ...newClips] },
          `Nạp ${newClips.length} file vào ${targetTrackName}`,
          newClips.map((c) => c.id)
        );
      }
    },
    [selectedTrackId, project, currentTime, currentSelectedTrack, commitProjectChange, showToast]
  );

  // Drop files onto specific track
  const handleDropFilesOnTrack = useCallback(
    async (files: File[] | FileList, trackId: string, atTime: number) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;
      const targetTrack = project.tracks.find((t) => t.id === trackId) || project.tracks[0];
      const targetTrackName = targetTrack?.name || 'Track';

      const newClips: ProjectClip[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file) continue;
        try {
          const decoded = await audioEngine.decodeAudioFile(file);
          newClips.push({
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            trackId,
            name: file.name.replace(/\.[^/.]+$/, ''),
            sourceBuffer: decoded,
            sourceStart: 0,
            sourceEnd: decoded.duration,
            startTime: atTime + i * 1.5,
          });
        } catch (err) {
          console.error(err);
        }
      }

      if (newClips.length > 0) {
        setSelectedTrackId(trackId);
        setActiveFilename(fileList[0]?.name || 'audio.wav');
        commitProjectChange(
          { ...project, clips: [...project.clips, ...newClips] },
          `Thả ${newClips.length} file vào ${targetTrackName}`,
          newClips.map((c) => c.id)
        );
      }
    },
    [project, commitProjectChange]
  );

  // Drop files to create a new track
  const handleDropFilesNewTrack = useCallback(
    async (files: File[] | FileList, atTime: number) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      if (project.tracks.length >= 8) {
        showToast('Đã đạt tối đa 8 track.');
        return;
      }

      const firstFileName = fileList[0]?.name ? fileList[0].name.replace(/\.[^/.]+$/, '') : 'Audio';
      const nextIdx = project.tracks.length;
      const newTrack: AudioTrack = {
        id: `track-${Date.now()}`,
        name: `Track ${nextIdx + 1} (${firstFileName})`,
        colorIndex: nextIdx % TRACK_PALETTES.length,
        volumeDb: 0,
        pan: 0,
        mute: false,
        solo: false,
        locked: false,
        height: 96,
      };

      const newClips: ProjectClip[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file) continue;
        try {
          const decoded = await audioEngine.decodeAudioFile(file);
          newClips.push({
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            trackId: newTrack.id,
            name: file.name.replace(/\.[^/.]+$/, ''),
            sourceBuffer: decoded,
            sourceStart: 0,
            sourceEnd: decoded.duration,
            startTime: atTime + i * 1.5,
          });
        } catch (err) {
          console.error(err);
        }
      }

      if (newClips.length > 0) {
        setSelectedTrackId(newTrack.id);
        setActiveFilename(fileList[0]?.name || 'audio.wav');
        commitProjectChange(
          {
            tracks: [...project.tracks, newTrack],
            clips: [...project.clips, ...newClips],
          },
          `Tạo track mới và thêm ${newClips.length} file`,
          newClips.map((c) => c.id)
        );
      }
    },
    [project, commitProjectChange, showToast]
  );

  // Load Demo multi-track project
  const handleLoadDemo = useCallback(() => {
    const demoBuffer = audioEngine.createDemoTrack();
    const track1: AudioTrack = {
      id: 'track-demo-1',
      name: 'Track 1 (Pad & Melody)',
      colorIndex: 0,
      volumeDb: -1.5,
      pan: -20,
      mute: false,
      solo: false,
      locked: false,
      height: 96,
    };
    const track2: AudioTrack = {
      id: 'track-demo-2',
      name: 'Track 2 (Bass & Beat)',
      colorIndex: 2,
      volumeDb: 0,
      pan: 20,
      mute: false,
      solo: false,
      locked: false,
      height: 96,
    };

    const clip1: ProjectClip = {
      id: 'demo-clip-1',
      trackId: track1.id,
      name: 'Giai điệu Synth Pad',
      sourceBuffer: demoBuffer,
      sourceStart: 0,
      sourceEnd: 12.0,
      startTime: 0,
    };

    const clip2: ProjectClip = {
      id: 'demo-clip-2',
      trackId: track2.id,
      name: 'Bass & Nhịp trống',
      sourceBuffer: demoBuffer,
      sourceStart: 3.0,
      sourceEnd: 12.0,
      startTime: 3.0,
    };

    setSelectedTrackId(track1.id);
    setSelectedClipIds([clip1.id]);
    setActiveFilename('Bản_nhạc_mẫu_demo.wav');

    const newProj: MultiTrackProject = {
      tracks: [track1, track2],
      clips: [clip1, clip2],
    };

    commitProjectChange(newProj, 'Nạp bản nhạc mẫu multi-track demo', [clip1.id]);
  }, [commitProjectChange]);

  // Insert silence
  const handleInsertSilence = useCallback(
    (duration: number) => {
      // Shift clips on selected track forward by duration
      if (!selectedTrackId) return;
      const updatedClips = project.clips.map((clip) => {
        if (clip.trackId === selectedTrackId && clip.startTime >= currentTime) {
          return { ...clip, startTime: clip.startTime + duration };
        }
        return clip;
      });
      commitProjectChange(
        { ...project, clips: updatedClips },
        `Chèn ${duration}s khoảng lặng tại ${currentTime.toFixed(2)}s`
      );
    },
    [selectedTrackId, project, currentTime, commitProjectChange]
  );

  // Normalize / Reverse / Fades on selected clip or track
  const handleNormalize = useCallback(
    (target: 'clip' | 'track') => {
      if (target === 'clip' && primarySelectedClip) {
        const ctx = multiTrackEngine.getAudioContext();
        const norm = normalizeAudio(ctx, primarySelectedClip.sourceBuffer);
        const updated = project.clips.map((c) =>
          c.id === primarySelectedClip.id ? { ...c, sourceBuffer: norm } : c
        );
        commitProjectChange({ ...project, clips: updated }, 'Chuẩn hoá âm lượng clip');
      } else {
        handleNormalizeMaster();
      }
    },
    [primarySelectedClip, project, handleNormalizeMaster, commitProjectChange]
  );

  const handleReverse = useCallback(
    (target: 'clip' | 'track') => {
      if (!primarySelectedClip) return;
      const ctx = multiTrackEngine.getAudioContext();
      const rev = reverseAudio(ctx, primarySelectedClip.sourceBuffer);
      const updated = project.clips.map((c) =>
        c.id === primarySelectedClip.id ? { ...c, sourceBuffer: rev } : c
      );
      commitProjectChange({ ...project, clips: updated }, 'Đảo ngược clip');
    },
    [primarySelectedClip, project, commitProjectChange]
  );

  const handleFadeIn = useCallback(
    (duration: number) => {
      if (!primarySelectedClip) return;
      handleUpdateClip(primarySelectedClip.id, { fadeIn: duration });
    },
    [primarySelectedClip, handleUpdateClip]
  );

  const handleFadeOut = useCallback(
    (duration: number) => {
      if (!primarySelectedClip) return;
      handleUpdateClip(primarySelectedClip.id, { fadeOut: duration });
    },
    [primarySelectedClip, handleUpdateClip]
  );

  const handleApplyGain = useCallback(
    (db: number, target: 'clip' | 'track') => {
      if (target === 'track' && selectedTrackId) {
        const track = project.tracks.find((t) => t.id === selectedTrackId);
        if (track) {
          handleUpdateTrack(track.id, { volumeDb: track.volumeDb + db });
          showToast(`Đã điều chỉnh âm lượng track: ${db > 0 ? `+${db}` : db} dB`);
        }
      } else if (primarySelectedClip) {
        const ctx = multiTrackEngine.getAudioContext();
        const multiplier = Math.pow(10, db / 20);
        const result = cloneAudioBuffer(ctx, primarySelectedClip.sourceBuffer);
        for (let ch = 0; ch < result.numberOfChannels; ch++) {
          const data = result.getChannelData(ch);
          for (let i = 0; i < data.length; i++) data[i] *= multiplier;
        }
        const updated = project.clips.map((c) =>
          c.id === primarySelectedClip.id ? { ...c, sourceBuffer: result } : c
        );
        commitProjectChange({ ...project, clips: updated }, `Bù âm lượng clip (${db} dB)`);
      }
    },
    [selectedTrackId, project, primarySelectedClip, handleUpdateTrack, commitProjectChange, showToast]
  );

  // Fit to view calculation: computes zoom once on demand
  const handleFitToView = useCallback(() => {
    let maxEnd = 0;
    for (const clip of project.clips) {
      const end = clip.startTime + (clip.sourceEnd - clip.sourceStart);
      if (end > maxEnd) maxEnd = end;
    }
    const activeDur = Math.max(10, maxEnd);
    // 30 px/sec is BASE_PX_PER_SEC. Average timeline viewport width is ~900px.
    const targetPxPerSec = 900 / (activeDur * 1.08);
    const targetZoom = Math.max(0.15, Math.min(10, Number((targetPxPerSec / 30).toFixed(2))));
    setZoom(targetZoom);
    showToast(`Đã căn vừa khung nhìn (${targetZoom}x)`);
  }, [project.clips, showToast]);

  // =========================================================================
  // KEYBOARD SHORTCUTS
  // =========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
      // S: Split at cursor
      else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleSplit();
      }
      // Delete / Backspace: Delete selected
      else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        handleDeleteSelection();
      }
      // N: Toggle Snapping
      else if (e.code === 'KeyN' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsSnapEnabled((prev) => !prev);
      }
      // Ctrl+T: Add New Track
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyT') {
        e.preventDefault();
        handleAddTrack();
      }
      // Ctrl+Up / Ctrl+Down: Select Track Above / Below
      else if ((e.ctrlKey || e.metaKey) && e.code === 'ArrowUp') {
        e.preventDefault();
        const curIdx = project.tracks.findIndex((t) => t.id === selectedTrackId);
        if (curIdx > 0) setSelectedTrackId(project.tracks[curIdx - 1].id);
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'ArrowDown') {
        e.preventDefault();
        const curIdx = project.tracks.findIndex((t) => t.id === selectedTrackId);
        if (curIdx < project.tracks.length - 1) setSelectedTrackId(project.tracks[curIdx + 1].id);
      }
      // Alt+Up / Alt+Down: Move Selected Clip to Track Above / Below
      else if (e.altKey && e.code === 'ArrowUp') {
        e.preventDefault();
        if (selectedClipIds.length > 0) {
          const curIdx = project.tracks.findIndex((t) => t.id === selectedTrackId);
          if (curIdx > 0) {
            handleMoveClips(selectedClipIds, 0, project.tracks[curIdx - 1].id);
            setSelectedTrackId(project.tracks[curIdx - 1].id);
          }
        }
      } else if (e.altKey && e.code === 'ArrowDown') {
        e.preventDefault();
        if (selectedClipIds.length > 0) {
          const curIdx = project.tracks.findIndex((t) => t.id === selectedTrackId);
          if (curIdx < project.tracks.length - 1) {
            handleMoveClips(selectedClipIds, 0, project.tracks[curIdx + 1].id);
            setSelectedTrackId(project.tracks[curIdx + 1].id);
          }
        }
      }
      // Shift+M: Mute selected track
      else if (e.shiftKey && e.code === 'KeyM') {
        e.preventDefault();
        if (selectedTrackId) {
          const t = project.tracks.find((tr) => tr.id === selectedTrackId);
          if (t) handleUpdateTrack(t.id, { mute: !t.mute });
        }
      }
      // Shift+S: Solo selected track
      else if (e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        if (selectedTrackId) {
          const t = project.tracks.find((tr) => tr.id === selectedTrackId);
          if (t) handleUpdateTrack(t.id, { solo: !t.solo });
        }
      }
      // Ctrl+C: Copy
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyC') {
        e.preventDefault();
        handleCopy();
      }
      // Ctrl+V: Paste
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyV') {
        e.preventDefault();
        handlePaste();
      }
      // Ctrl+D: Duplicate
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        handleDuplicate();
      }
      // Ctrl+Z: Undo
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z: Redo
      else if (
        ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ')
      ) {
        e.preventDefault();
        handleRedo();
      }
      // +/- Zoom
      else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((prev) => Math.min(15, prev + 1));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((prev) => Math.max(1, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePlayPause,
    handleSplit,
    handleDeleteSelection,
    handleAddTrack,
    handleMoveClips,
    handleUpdateTrack,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleUndo,
    handleRedo,
    project.tracks,
    selectedTrackId,
    selectedClipIds,
  ]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200"
    >
      {/* Top Header */}
      <Header
        onOpenFile={handleOpenFiles}
        onOpenRecordModal={() => setIsRecordModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
        onLoadDemoTrack={handleLoadDemo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasBuffer={project.clips.length > 0}
        historyCount={history.length}
      />

      {/* Main Studio Workspace */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl w-full mx-auto gap-4">
        {/* Multi-Track DAW Timeline Component */}
        <MultiTrackTimeline
          project={project}
          selectedClipIds={selectedClipIds}
          selectedTrackId={selectedTrackId}
          currentTime={currentTime}
          selection={selection}
          zoom={zoom}
          isSnapEnabled={isSnapEnabled}
          onToggleSnap={() => setIsSnapEnabled(!isSnapEnabled)}
          onSeek={handleSeek}
          onSelectionChange={setSelection}
          onSelectTrack={setSelectedTrackId}
          onSelectClip={handleSelectClip}
          onUpdateTrack={handleUpdateTrack}
          onAddTrack={handleAddTrack}
          onDeleteTrack={handleDeleteTrack}
          onUpdateClip={handleUpdateClip}
          onMoveClips={handleMoveClips}
          onDropFilesOnTrack={handleDropFilesOnTrack}
          onDropFilesNewTrack={handleDropFilesNewTrack}
          renderConfig={waveformConfig}
          onZoomChange={setZoom}
        />

        {/* Transport & Realtime Spectrum Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          <div className="lg:col-span-2">
            <TransportBar
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              loopSelection={loopSelection}
              onToggleLoop={() => setLoopSelection(!loopSelection)}
              zoom={zoom}
              onZoomChange={setZoom}
              onFitToView={handleFitToView}
              hasSelection={Boolean(selection && selection.end > selection.start)}
              disabled={project.clips.length === 0}
              onNormalizeMaster={handleNormalizeMaster}
              isSoloClipActive={isSoloClipActive}
              onToggleSoloClip={() => setIsSoloClipActive(!isSoloClipActive)}
              hasSelectedClip={selectedClipIds.length === 1}
            />
          </div>
          <div>
            <SpectrumVisualizer isPlaying={isPlaying || isPreviewing} className="h-full" />
          </div>
        </div>

        {/* Studio Tool Tabs */}
        <div className="flex flex-col gap-3">
          {/* Tab Selector Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>Cắt & Ghép Multi-Track</span>
            </button>

            <button
              onClick={() => setActiveTab('pitch')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'pitch'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music2 className="w-4 h-4" />
              <span>Cao độ & Tốc độ</span>
            </button>

            <button
              onClick={() => setActiveTab('eq')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'eq'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Equalizer (10 Băng)</span>
            </button>

            <button
              onClick={() => setActiveTab('effects')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'effects'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Hiệu ứng & Lọc nhiễu</span>
            </button>

            <button
              onClick={() => setActiveTab('antiScan')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'antiScan'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Chống quét nhận diện</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-medium">
                SUNO AI & Bản quyền
              </span>
            </button>

            <button
              onClick={() => setIsStyleModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap bg-slate-950/80 border border-slate-700/80 text-cyan-300 hover:border-cyan-500/80 hover:bg-slate-900 transition-all cursor-pointer ml-auto"
              title="Đổi mẫu vẽ sóng nhạc"
            >
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              <span>Đổi mẫu sóng</span>
            </button>
          </div>

          {/* Active Tab Panel */}
          <div>
            {activeTab === 'edit' && (
              <EditToolsTab
                hasBuffer={project.clips.length > 0}
                selection={selection}
                selectedClipCount={selectedClipIds.length}
                clipboardCount={clipboardClips.length}
                selectedTrackName={currentSelectedTrack?.name || 'Track 1'}
                onCrop={handleCrop}
                onDeleteSelection={handleDeleteSelection}
                onSplit={handleSplit}
                onMergeSelectedClips={handleMergeSelectedClips}
                onCopy={handleCopy}
                onPaste={handlePaste}
                onDuplicate={handleDuplicate}
                onInsertSilence={handleInsertSilence}
                onNormalize={handleNormalize}
                onReverse={handleReverse}
                onFadeIn={handleFadeIn}
                onFadeOut={handleFadeOut}
                onApplyGain={handleApplyGain}
              />
            )}

            {activeTab === 'pitch' && (
              <PitchTempoTab
                hasBuffer={Boolean(activeWorkingBuffer)}
                onPreview={(settings) => {
                  if (!activeWorkingBuffer) return;
                  const ctx = multiTrackEngine.getAudioContext();
                  const sampleDuration = Math.min(8.0, activeWorkingBuffer.duration);
                  const excerpt = cropAudioBuffer(ctx, activeWorkingBuffer, { start: 0, end: sampleDuration });
                  const processed = processPitchAndTempo(ctx, excerpt, settings.semitones, settings.cents, settings.tempo);
                  startAuditionPreview(processed);
                }}
                onStopPreview={stopAuditionPreview}
                isPreviewing={isPreviewing}
                onApply={async (settings) => {
                  if (!primarySelectedClip) {
                    showToast('Vui lòng chọn 1 clip để áp dụng đổi cao độ/tốc độ.');
                    return;
                  }
                  setIsProcessing(true);
                  stopAuditionPreview();
                  setTimeout(() => {
                    try {
                      const ctx = multiTrackEngine.getAudioContext();
                      const processed = processPitchAndTempo(
                        ctx,
                        primarySelectedClip.sourceBuffer,
                        settings.semitones,
                        settings.cents,
                        settings.tempo
                      );
                      const updated = project.clips.map((c) =>
                        c.id === primarySelectedClip.id ? { ...c, sourceBuffer: processed, sourceEnd: processed.duration } : c
                      );
                      commitProjectChange({ ...project, clips: updated }, `Đổi cao độ/tốc độ cho ${primarySelectedClip?.name || 'clip'}`);
                    } catch (err) {
                      console.error(err);
                      showToast('Lỗi khi tính toán WSOLA.');
                    } finally {
                      setIsProcessing(false);
                    }
                  }, 50);
                }}
                isProcessing={isProcessing}
              />
            )}

            {activeTab === 'eq' && (
              <EqualizerTab
                hasBuffer={Boolean(activeWorkingBuffer)}
                onPreviewEQ={async (bands) => {
                  if (!activeWorkingBuffer) return;
                  const ctx = multiTrackEngine.getAudioContext();
                  const sampleDuration = Math.min(8.0, activeWorkingBuffer.duration);
                  const excerpt = cropAudioBuffer(ctx, activeWorkingBuffer, { start: 0, end: sampleDuration });
                  const rendered = await renderEffects(excerpt, bands, DEFAULT_EFFECT_SETTINGS);
                  startAuditionPreview(rendered);
                }}
                onStopPreview={stopAuditionPreview}
                isPreviewing={isPreviewing}
                onApplyEQ={async (bands) => {
                  if (!primarySelectedClip) {
                    showToast('Vui lòng chọn 1 clip để áp dụng EQ.');
                    return;
                  }
                  setIsProcessing(true);
                  stopAuditionPreview();
                  try {
                    const rendered = await renderEffects(primarySelectedClip.sourceBuffer, bands, DEFAULT_EFFECT_SETTINGS);
                    const updated = project.clips.map((c) =>
                      c.id === primarySelectedClip.id ? { ...c, sourceBuffer: rendered } : c
                    );
                    commitProjectChange({ ...project, clips: updated }, `Áp dụng 10-Band EQ cho ${primarySelectedClip?.name || 'clip'}`);
                  } catch (err) {
                    console.error(err);
                    showToast('Lỗi khi áp dụng EQ.');
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                isProcessing={isProcessing}
              />
            )}

            {activeTab === 'effects' && (
              <EffectsTab
                hasBuffer={Boolean(activeWorkingBuffer)}
                onPreviewEffects={async (settings) => {
                  if (!activeWorkingBuffer) return;
                  const ctx = multiTrackEngine.getAudioContext();
                  const sampleDuration = Math.min(8.0, activeWorkingBuffer.duration);
                  const excerpt = cropAudioBuffer(ctx, activeWorkingBuffer, { start: 0, end: sampleDuration });
                  const emptyBands: EQBand[] = [];
                  const rendered = await renderEffects(excerpt, emptyBands, settings);
                  startAuditionPreview(rendered);
                }}
                onStopPreview={stopAuditionPreview}
                isPreviewing={isPreviewing}
                onApplyEffects={async (settings) => {
                  if (!primarySelectedClip) {
                    showToast('Vui lòng chọn 1 clip để áp dụng hiệu ứng.');
                    return;
                  }
                  setIsProcessing(true);
                  stopAuditionPreview();
                  try {
                    const emptyBands: EQBand[] = [];
                    const rendered = await renderEffects(primarySelectedClip.sourceBuffer, emptyBands, settings);
                    const updated = project.clips.map((c) =>
                      c.id === primarySelectedClip.id ? { ...c, sourceBuffer: rendered } : c
                    );
                    commitProjectChange({ ...project, clips: updated }, `Áp dụng hiệu ứng cho ${primarySelectedClip?.name || 'clip'}`);
                  } catch (err) {
                    console.error(err);
                    showToast('Lỗi khi áp dụng hiệu ứng.');
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                isProcessing={isProcessing}
              />
            )}

            {activeTab === 'antiScan' && (
              <AntiScanTab
                hasBuffer={Boolean(activeWorkingBuffer)}
                onPreview={async (settings) => {
                  if (!activeWorkingBuffer) return;
                  const ctx = multiTrackEngine.getAudioContext();
                  const sampleDuration = Math.min(8.0, activeWorkingBuffer.duration);
                  const excerpt = cropAudioBuffer(ctx, activeWorkingBuffer, { start: 0, end: sampleDuration });
                  const protectedBuf = await applyAntiRecognition(ctx, excerpt, settings);
                  startAuditionPreview(protectedBuf);
                }}
                onStopPreview={stopAuditionPreview}
                isPreviewing={isPreviewing}
                onApply={async (settings) => {
                  if (!primarySelectedClip) {
                    showToast('Vui lòng chọn 1 clip để áp dụng bảo vệ chống quét nhận diện.');
                    return;
                  }
                  setIsProcessing(true);
                  stopAuditionPreview();
                  setTimeout(async () => {
                    try {
                      const ctx = multiTrackEngine.getAudioContext();
                      const protectedBuf = await applyAntiRecognition(ctx, primarySelectedClip.sourceBuffer, settings);
                      const updated = project.clips.map((c) =>
                        c.id === primarySelectedClip.id ? { ...c, sourceBuffer: protectedBuf } : c
                      );
                      commitProjectChange({ ...project, clips: updated }, `Áp dụng chống quét nhận diện cho ${primarySelectedClip?.name || 'clip'}`);
                    } catch (err) {
                      console.error(err);
                      showToast('Lỗi khi áp dụng bảo vệ chống quét.');
                    } finally {
                      setIsProcessing(false);
                    }
                  }, 50);
                }}
                isProcessing={isProcessing}
              />
            )}
          </div>
        </div>
      </main>

      {/* Bottom Technical Status Bar */}
      <StatusBar
        buffer={activeWorkingBuffer}
        currentTime={currentTime}
        selection={selection}
        activeFilename={activeFilename}
        statusMessage={statusMessage}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
      />

      {/* Modals */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        project={project}
        selection={selection}
        defaultFilename={activeFilename}
      />

      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onRecordingComplete={(recBuffer, name) => {
          const targetTrack = project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0];
          const targetTrackId = targetTrack?.id || 'track-1';
          const targetTrackName = targetTrack?.name || currentSelectedTrack?.name || 'Track 1';
          const newClip: ProjectClip = {
            id: `clip-rec-${Date.now()}`,
            trackId: targetTrackId,
            name: `${name}.wav`,
            sourceBuffer: recBuffer,
            sourceStart: 0,
            sourceEnd: recBuffer.duration,
            startTime: currentTime,
          };
          commitProjectChange(
            { ...project, clips: [...project.clips, newClip] },
            `Ghi âm vào track ${targetTrackName} tại ${currentTime.toFixed(2)}s`,
            [newClip.id]
          );
        }}
      />

      <GuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      <WaveformStyleModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        config={waveformConfig}
        onChangeConfig={setWaveformConfig}
      />

      <AudioStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        buffer={activeWorkingBuffer}
        filename={activeFilename}
        onNormalize={() => handleNormalize('clip')}
      />
    </div>
  );
}
