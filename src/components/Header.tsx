/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  Upload,
  Mic,
  Download,
  Undo2,
  Redo2,
  HelpCircle,
  Music,
  Sparkles,
  BarChart3,
} from 'lucide-react';

interface HeaderProps {
  onOpenFile: (files: File[] | FileList) => void;
  onOpenRecordModal: () => void;
  onOpenExportModal: () => void;
  onOpenGuideModal: () => void;
  onOpenStatsModal?: () => void;
  onLoadDemoTrack: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasBuffer: boolean;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenFile,
  onOpenRecordModal,
  onOpenExportModal,
  onOpenGuideModal,
  onOpenStatsModal,
  onLoadDemoTrack,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasBuffer,
  historyCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
      onOpenFile(filesArray);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shadow-md">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20">
          <Music className="w-5 h-5 fill-current" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
            <span>Studio Âm Thanh Web</span>
            <span className="text-[10px] font-mono uppercase bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-1.5 py-0.2 rounded font-semibold">
              Pro
            </span>
          </h1>
          <span className="text-[11px] text-slate-400">
            Xử lý hoàn toàn trên trình duyệt · Không tải lên máy chủ
          </span>
        </div>
      </div>

      {/* Primary Actions: Open, Record, Demo */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-medium transition-colors cursor-pointer"
          title="Chọn một hoặc nhiều tệp MP3, WAV, OGG, M4A, FLAC"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Mở file</span>
        </button>

        <button
          onClick={onOpenRecordModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 text-xs font-medium transition-colors cursor-pointer"
          title="Ghi âm trực tiếp từ micro máy tính"
        >
          <Mic className="w-3.5 h-3.5 text-rose-400" />
          <span>Ghi âm</span>
        </button>

        <button
          onClick={onLoadDemoTrack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          title="Tải đoạn nhạc mẫu tổng hợp chất lượng cao để trải nghiệm ngay"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Nhạc mẫu Demo</span>
        </button>
      </div>

      {/* Undo/Redo & Export & Help */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 px-1 select-none">
            {historyCount}
          </span>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Làm lại (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onOpenExportModal}
          disabled={!hasBuffer}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất file</span>
        </button>

        {onOpenStatsModal && (
          <button
            onClick={onOpenStatsModal}
            disabled={!hasBuffer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors cursor-pointer"
            title="Xem bảng thống kê âm thanh (Peak dBFS, RMS, Crest Factor, Clipping)"
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Thống kê</span>
          </button>
        )}

        <button
          onClick={onOpenGuideModal}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Hướng dẫn sử dụng & Phím tắt"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
