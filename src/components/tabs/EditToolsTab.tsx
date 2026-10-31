/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Scissors,
  Trash2,
  GitFork,
  Copy,
  ClipboardPaste,
  Layers,
  Clock,
  Sparkles,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Volume2,
  AlertTriangle,
  Info,
  Combine,
} from 'lucide-react';
import { SelectionRange } from '../../types/audio';

interface EditToolsTabProps {
  hasBuffer: boolean;
  selection: SelectionRange | null;
  selectedClipCount?: number;
  clipboardCount?: number;
  selectedTrackName?: string;
  onCrop: () => void;
  onDeleteSelection: () => void;
  onSplit: () => void;
  onMergeSelectedClips?: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onInsertSilence: (duration: number) => void;
  onNormalize: (target: 'clip' | 'track') => void;
  onReverse: (target: 'clip' | 'track') => void;
  onFadeIn: (duration: number) => void;
  onFadeOut: (duration: number) => void;
  onApplyGain: (db: number, target: 'clip' | 'track') => void;
}

export const EditToolsTab: React.FC<EditToolsTabProps> = ({
  hasBuffer,
  selection,
  selectedClipCount = 0,
  clipboardCount = 0,
  selectedTrackName = 'Track 1',
  onCrop,
  onDeleteSelection,
  onSplit,
  onMergeSelectedClips,
  onCopy,
  onPaste,
  onDuplicate,
  onInsertSilence,
  onNormalize,
  onReverse,
  onFadeIn,
  onFadeOut,
  onApplyGain,
}) => {
  const [gainDb, setGainDb] = useState<number>(0);
  const [silenceDuration, setSilenceDuration] = useState<number>(1.0);
  const [fadeDuration, setFadeDuration] = useState<number>(1.5);
  const [targetScope, setTargetScope] = useState<'clip' | 'track'>('clip');
  const [showSilenceModal, setShowSilenceModal] = useState<boolean>(false);
  const [showCropConfirmModal, setShowCropConfirmModal] = useState<boolean>(false);

  const hasSelection = Boolean(selection && selection.end > selection.start);
  const canDelete = hasBuffer && (hasSelection || selectedClipCount > 0);

  return (
    <div className="flex flex-col gap-5 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {/* Primary Editing Actions */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Công cụ cắt gọt & thao tác Multi-Track
          </h4>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Track hiện tại: <strong className="text-cyan-400">{selectedTrackName}</strong></span>
            {selectedClipCount > 0 && (
              <span className="text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                Đang chọn: {selectedClipCount} clip
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* TÁCH ĐÔI (S) */}
          <button
            onClick={onSplit}
            disabled={!hasBuffer}
            title={
              selectedClipCount > 0
                ? 'Tách clip đang chọn tại vị trí con trỏ (Phím S)'
                : 'Tách tất cả clip nằm tại vị trí con trỏ trên các track không bị khoá (Phím S)'
            }
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-slate-200 border border-amber-500/40 hover:border-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer shadow-sm"
          >
            <GitFork className="w-5 h-5 mb-1.5 text-amber-400 group-hover:scale-110 transition-transform rotate-90" />
            <span className="text-xs font-semibold text-amber-300">Tách đôi (S)</span>
            <span className="text-[10px] text-amber-400/80">
              {selectedClipCount > 0 ? 'Clip chọn' : 'Tất cả track'}
            </span>
          </button>

          {/* GHÉP CÁC CLIP ĐÃ CHỌN (BOUNCE / MERGE) */}
          {onMergeSelectedClips && (
            <button
              onClick={onMergeSelectedClips}
              disabled={selectedClipCount < 2}
              title={
                selectedClipCount >= 2
                  ? `Trộn ${selectedClipCount} clip đã chọn (kể cả khác track) thành một clip duy nhất`
                  : 'Hãy chọn ít nhất 2 clip (Ctrl+nhấp) để ghép'
              }
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-slate-200 border border-indigo-500/40 hover:border-indigo-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer shadow-sm"
            >
              <Combine className="w-5 h-5 mb-1.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-indigo-300">Ghép clip (Bounce)</span>
              <span className="text-[10px] text-indigo-400/80">
                {selectedClipCount >= 2 ? `${selectedClipCount} clip` : 'Chọn ≥ 2 clip'}
              </span>
            </button>
          )}

          {/* CHỈ GIỮ VÙNG CHỌN */}
          <button
            onClick={() => {
              if (hasSelection) {
                setShowCropConfirmModal(true);
              }
            }}
            disabled={!hasBuffer || !hasSelection}
            title="Chỉ giữ lại vùng chọn, phần ngoài sẽ bị xoá"
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
          >
            <Scissors className="w-5 h-5 mb-1.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Chỉ giữ vùng chọn</span>
            <span className="text-[10px] text-slate-400">Xoá 2 đầu</span>
          </button>

          {/* XOÁ CLIP / VÙNG CHỌN */}
          <button
            onClick={onDeleteSelection}
            disabled={!canDelete}
            title={
              selectedClipCount > 0
                ? `Xoá ${selectedClipCount} clip đang chọn (Phím Delete)`
                : 'Xoá vùng chọn hoặc clip đang chọn (Phím Delete)'
            }
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-200 border border-slate-700 hover:border-rose-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
          >
            <Trash2 className="w-5 h-5 mb-1.5 text-rose-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-rose-300">Xoá clip/vùng</span>
            <span className="text-[10px] text-slate-400">
              {selectedClipCount > 0 ? `${selectedClipCount} clip` : 'Phím Del'}
            </span>
          </button>

          {/* SAO CHÉP */}
          <button
            onClick={onCopy}
            disabled={!hasBuffer || selectedClipCount === 0}
            title="Sao chép clip đang chọn (Ctrl+C)"
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
          >
            <Copy className="w-5 h-5 mb-1.5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Sao chép</span>
            <span className="text-[10px] text-slate-400">Ctrl+C</span>
          </button>

          {/* DÁN */}
          <button
            onClick={onPaste}
            disabled={!hasBuffer || clipboardCount === 0}
            title={
              clipboardCount > 0
                ? `Dán vào track "${selectedTrackName}" tại vị trí con trỏ (Ctrl+V)`
                : 'Chưa có clip nào trong bộ nhớ tạm'
            }
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
          >
            <ClipboardPaste className="w-5 h-5 mb-1.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Dán (Paste)</span>
            <span className="text-[10px] text-slate-400">Vào track chọn</span>
          </button>

          {/* NHÂN ĐÔI */}
          <button
            onClick={onDuplicate}
            disabled={!hasBuffer || selectedClipCount === 0}
            title="Nhân đôi clip đang chọn (Ctrl+D)"
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
          >
            <Layers className="w-5 h-5 mb-1.5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Nhân đôi</span>
            <span className="text-[10px] text-slate-400">Ctrl+D</span>
          </button>

          {/* CHÈN LẶNG */}
          <button
            onClick={() => setShowSilenceModal(true)}
            disabled={!hasBuffer}
            title="Chèn một khoảng im lặng tại con trỏ trên track đang chọn"
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
          >
            <Clock className="w-5 h-5 mb-1.5 text-slate-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Chèn lặng</span>
            <span className="text-[10px] text-slate-400">Silence</span>
          </button>
        </div>
      </div>

      {/* Target Scope Switch: Áp dụng cho Clip hay cả Track */}
      <div className="flex items-center justify-between p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
        <span className="text-slate-300 font-medium flex items-center gap-1.5">
          <Info className="w-4 h-4 text-cyan-400" />
          Phạm vi áp dụng xử lý âm thanh:
        </span>
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setTargetScope('clip')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              targetScope === 'clip'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Clip đang chọn
          </button>
          <button
            onClick={() => setTargetScope('track')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              targetScope === 'track'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cả Track ({selectedTrackName})
          </button>
        </div>
      </div>

      {/* Audio Operations: Normalize, Reverse, Fades, Volume */}
      <div className="pt-2 border-t border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Quick Transform */}
          <div className="flex flex-col gap-2.5 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-xs font-medium text-slate-300">Biến đổi âm thanh ({targetScope === 'clip' ? 'Clip' : 'Track'})</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNormalize(targetScope)}
                disabled={!hasBuffer}
                title="Tự động cân bằng mức đỉnh lên -0.1dB không vỡ tiếng"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 hover:border-amber-400/50 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Chuẩn hoá</span>
              </button>
              <button
                onClick={() => onReverse(targetScope)}
                disabled={!hasBuffer}
                title="Đảo ngược chiều phát âm thanh"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 hover:border-cyan-400/50 disabled:opacity-40 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                <span>Đảo ngược</span>
              </button>
            </div>
          </div>

          {/* Fade In & Fade Out */}
          <div className="flex flex-col gap-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Làm mờ âm (Fade Clip)</span>
              <span className="text-xs font-mono text-cyan-400">{fadeDuration}s</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.1"
              value={fadeDuration}
              onChange={(e) => setFadeDuration(parseFloat(e.target.value))}
              className="accent-cyan-400"
            />
            <div className="grid grid-cols-2 gap-2 mt-0.5">
              <button
                onClick={() => onFadeIn(fadeDuration)}
                disabled={!hasBuffer}
                title="Lớn dần từ đầu clip"
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
              >
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span>Fade In</span>
              </button>
              <button
                onClick={() => onFadeOut(fadeDuration)}
                disabled={!hasBuffer}
                title="Nhỏ dần về cuối clip"
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
              >
                <TrendingDown className="w-3 h-3 text-rose-400" />
                <span>Fade Out</span>
              </button>
            </div>
          </div>

          {/* Gain / Volume */}
          <div className="flex flex-col gap-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                Bù âm lượng (Gain)
              </span>
              <span className={`text-xs font-mono font-semibold ${gainDb > 0 ? 'text-amber-400' : gainDb < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {gainDb > 0 ? `+${gainDb}` : gainDb} dB
              </span>
            </div>
            <input
              type="range"
              min="-24"
              max="12"
              step="0.5"
              value={gainDb}
              onChange={(e) => setGainDb(parseFloat(e.target.value))}
              className="accent-cyan-400"
            />
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => setGainDb(0)}
                className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 rounded cursor-pointer"
              >
                0 dB
              </button>
              <button
                onClick={() => onApplyGain(gainDb, targetScope)}
                disabled={!hasBuffer || gainDb === 0}
                className="flex-1 py-1 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded disabled:opacity-40 cursor-pointer transition-colors"
              >
                Áp dụng {targetScope === 'clip' ? 'Clip' : 'Track'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for "Chỉ giữ vùng chọn" */}
      {showCropConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Chỉ giữ vùng chọn
                </h3>
                <p className="text-xs text-amber-300/90 font-medium">
                  Phần còn lại sẽ bị xoá, bạn có thể hoàn tác bằng Ctrl+Z.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <p>
                Toàn bộ timeline ngoài vùng chọn sẽ được loại bỏ trên tất cả các track.
              </p>
              <p className="mt-1.5 text-cyan-400 flex items-center gap-1.5">
                <Info className="w-4 h-4 shrink-0" />
                <span>Gợi ý: Dùng nút <strong>Tách đôi (S)</strong> nếu bạn chỉ muốn chia nhỏ clip mà không làm mất đoạn nào.</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCropConfirmModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setShowCropConfirmModal(false);
                  onCrop();
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer transition-colors shadow-sm"
              >
                Xác nhận xoá phần còn lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Silence Modal */}
      {showSilenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Chèn khoảng lặng (Silence)
            </h3>
            <p className="text-xs text-slate-400">
              Chọn độ dài khoảng im lặng muốn chèn vào tại vị trí con trỏ phát trên track {selectedTrackName}:
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0.1"
                max="60"
                step="0.5"
                value={silenceDuration}
                onChange={(e) => setSilenceDuration(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-cyan-400 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-sm text-slate-300">giây</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSilenceModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  onInsertSilence(silenceDuration);
                  setShowSilenceModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg cursor-pointer transition-colors"
              >
                Xác nhận chèn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
