/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ListMusic,
  ArrowUp,
  ArrowDown,
  Trash2,
  Play,
  Square,
  Combine,
  Plus,
  Radio,
  FileAudio,
} from 'lucide-react';
import { AudioClip } from '../../types/audio';
import { audioEngine } from '../../services/audioEngine';

interface ClipsManagerTabProps {
  clips: AudioClip[];
  activeClipId: string | null;
  onSelectClip: (id: string) => void;
  onReorderClips: (reordered: AudioClip[]) => void;
  onRemoveClip: (id: string) => void;
  onMergeClips: (crossfadeSec: number) => void;
  onAddNewClipFromFile: () => void;
}

export const ClipsManagerTab: React.FC<ClipsManagerTabProps> = ({
  clips,
  activeClipId,
  onSelectClip,
  onReorderClips,
  onRemoveClip,
  onMergeClips,
  onAddNewClipFromFile,
}) => {
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(1.0);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  const moveClip = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= clips.length) return;

    const newClips = [...clips];
    const [moved] = newClips.splice(index, 1);
    newClips.splice(targetIndex, 0, moved);
    onReorderClips(newClips);
  };

  const handlePlayClip = (clip: AudioClip) => {
    if (playingClipId === clip.id) {
      audioEngine.stop();
      setPlayingClipId(null);
    } else {
      audioEngine.play(clip.buffer, 0, false);
      setPlayingClipId(clip.id);
      audioEngine.onPlaybackEnd(() => {
        setPlayingClipId(null);
      });
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  };

  return (
    <div className="flex flex-col gap-5 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-cyan-400" />
            Danh Sách & Ghép Nhiều Đoạn (Clips & Merging)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Sắp xếp thứ tự các file/đoạn âm thanh và ghép nối thành một bản hoàn chỉnh có hiệu ứng chuyển bài (Crossfade).
          </p>
        </div>

        <button
          onClick={onAddNewClipFromFile}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm file khác</span>
        </button>
      </div>

      {/* Clip List */}
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-400 gap-2">
            <FileAudio className="w-8 h-8 text-slate-600" />
            <p className="text-xs">Chưa có clip nào trong danh sách ghép nối</p>
          </div>
        ) : (
          clips.map((clip, index) => {
            const isActive = clip.id === activeClipId;
            const isPlayingThis = playingClipId === clip.id;

            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip(clip.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-950/30 border-cyan-500/80 shadow-md shadow-cyan-950/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-400 w-5">
                    {index + 1}.
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayClip(clip);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
                    title={isPlayingThis ? 'Dừng' : 'Phát thử đoạn này'}
                  >
                    {isPlayingThis ? (
                      <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>

                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {clip.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatDuration(clip.duration)} · {clip.sampleRate} Hz · {clip.numberOfChannels === 1 ? 'Mono' : 'Stereo'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => moveClip(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-20 cursor-pointer"
                    title="Chuyển lên trước"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveClip(index, 'down')}
                    disabled={index === clips.length - 1}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-20 cursor-pointer"
                    title="Chuyển xuống sau"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveClip(clip.id)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                    title="Xoá khỏi danh sách"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Crossfade & Merge Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-3 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-slate-300 font-medium">Chuyển âm (Crossfade):</span>
          <input
            type="range"
            min="0"
            max="5.0"
            step="0.5"
            value={crossfadeDuration}
            onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))}
            className="w-28 accent-cyan-400 cursor-pointer"
          />
          <span className="text-xs font-mono font-semibold text-cyan-400 w-10">
            {crossfadeDuration}s
          </span>
        </div>

        <button
          onClick={() => onMergeClips(crossfadeDuration)}
          disabled={clips.length < 2}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <Combine className="w-4 h-4" />
          <span>Ghép các đoạn thành một ({clips.length} clip)</span>
        </button>
      </div>
    </div>
  );
};
