/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle, X, UploadCloud, Sliders, Download, Keyboard, Layers, Magnet } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-base">Hướng Dẫn & Bảng Phím Tắt Multi-Track</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Multi-Track Overview */}
          <div className="flex gap-3.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400 font-bold text-sm">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-200">
                Làm việc trên Timeline đa Track chuyên nghiệp
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hỗ trợ tối đa 8 track âm thanh phát đồng thời. Kéo-thả clip theo chiều ngang để đổi thời gian, kéo dọc để đổi track. Kéo mép trái/phải để Trim không mất dữ liệu gốc.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 font-bold text-sm">
              <Magnet className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-200">
                Bắt dính (Snap) & Ghép clip (Bounce)
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bật bắt dính (phím N) để mép clip tự hút vào con trỏ, vạch nhịp và các clip khác. Chọn từ 2 clip trở lên và nhấn <strong>Ghép clip (Bounce)</strong> để trộn thành một clip duy nhất.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-sm">
              <Download className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-200">
                Xuất Mixdown Master hoặc từng Track riêng (Stems)
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Render âm thanh qua OfflineAudioContext cực nhanh. Có thể xuất bản tổng Master hoặc chọn xuất riêng từng stem track để phối khí trên DAW khác.
              </p>
            </div>
          </div>

          {/* Full Keyboard Shortcuts Table */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-cyan-400" />
              Bảng phím tắt đầy đủ:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Phát / Tạm dừng</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Tách đôi (Split)</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">S</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Xoá clip / vùng chọn</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Delete</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Thêm track mới</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Ctrl+T</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Bật / Tắt bắt dính</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-300 font-mono text-[11px]">N</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Chọn track Trên / Dưới</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Ctrl+↑ / Ctrl+↓</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Chuyển clip sang track</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Alt+↑ / Alt+↓</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Tắt tiếng (Mute) track</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-rose-300 font-mono text-[11px]">Shift+M</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Nghe riêng (Solo) track</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-300 font-mono text-[11px]">Shift+S</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Sao chép / Dán</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Ctrl+C / Ctrl+V</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Nhân đôi (Duplicate)</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Ctrl+D</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Hoàn tác / Làm lại</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">Ctrl+Z / Ctrl+Y</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Phóng to / Thu nhỏ</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-mono text-[11px]">+ / -</kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-5 py-3 bg-slate-950/60 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl transition-colors cursor-pointer"
          >
            Đã hiểu, bắt đầu dùng
          </button>
        </div>
      </div>
    </div>
  );
};
