/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, CheckCircle2, Loader2, X, Layers, Music } from 'lucide-react';
import { ExportSettings, SelectionRange, MultiTrackProject } from '../types/audio';
import { multiTrackEngine } from '../services/multiTrackEngine';
import { exportAudio, triggerDownload } from '../services/audioExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: MultiTrackProject;
  selection: SelectionRange | null;
  defaultFilename: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  selection,
  defaultFilename,
}) => {
  const [format, setFormat] = useState<'wav' | 'mp3'>('mp3');
  const [bitrate, setBitrate] = useState<128 | 192 | 320>(192);
  const [exportRange, setExportRange] = useState<'all' | 'selection'>('all');
  const [exportMode, setExportMode] = useState<'master' | 'stems'>('master');
  const [filename, setFilename] = useState<string>(
    defaultFilename ? defaultFilename.replace(/\.[^/.]+$/, '') : 'ban-thu-am-pro'
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [downloadReady, setDownloadReady] = useState<{ count: number; filename: string } | null>(null);

  if (!isOpen) return null;

  const hasSelection = Boolean(selection && selection.end > selection.start);

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setDownloadReady(null);
    setCurrentStepText('Đang render OfflineAudioContext...');

    const settings: ExportSettings = {
      format,
      mp3Bitrate: bitrate,
      sampleRate: 44100,
      exportRange,
      exportMode,
      filename,
    };

    const targetRange = hasSelection && exportRange === 'selection' && selection ? selection : undefined;

    try {
      if (exportMode === 'master') {
        // Master Mixdown: render all active tracks
        setCurrentStepText('Đang trộn âm thanh tất cả các track...');
        const renderedBuffer = await multiTrackEngine.renderProjectOffline(project, {
          range: targetRange,
          onProgress: (p) => setProgress(Math.round(p * 0.4)),
        });

        setCurrentStepText(`Đang mã hoá ${format.toUpperCase()}...`);
        const ctx = multiTrackEngine.getAudioContext();
        const result = await exportAudio(
          ctx,
          renderedBuffer,
          settings,
          undefined,
          (p) => setProgress(40 + Math.round(p * 0.6))
        );

        triggerDownload(result.blob, result.filename);
        setDownloadReady({ count: 1, filename: result.filename });
      } else {
        // Stems Export: render each track individually
        const activeTracks = project.tracks.filter((t) => !t.mute && project.clips.some((c) => c.trackId === t.id));
        const total = activeTracks.length;
        if (total === 0) {
          alert('Không có track nào khả dụng để xuất stems.');
          setIsExporting(false);
          return;
        }

        const ctx = multiTrackEngine.getAudioContext();

        for (let i = 0; i < total; i++) {
          const track = activeTracks[i];
          const trackTitle = track?.name || `Track_${i + 1}`;
          setCurrentStepText(`Đang xuất Track ${i + 1}/${total}: ${trackTitle}...`);

          const trackBuffer = await multiTrackEngine.renderProjectOffline(project, {
            range: targetRange,
            soloTrackId: track.id,
          });

          const stemFilename = `${filename}_${trackTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_')}`;
          const stemSettings = { ...settings, filename: stemFilename };

          const result = await exportAudio(ctx, trackBuffer, stemSettings, undefined, (p) => {
            const trackProgress = ((i + p / 100) / total) * 100;
            setProgress(Math.round(trackProgress));
          });

          triggerDownload(result.blob, result.filename);
          // small delay between multiple downloads
          await new Promise((r) => setTimeout(r, 400));
        }

        setDownloadReady({ count: total, filename: `${filename} (${total} files)` });
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Có lỗi xảy ra trong quá trình xuất file âm thanh.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-base">Xuất Tệp Âm Thanh Multi-Track</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Filename Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Tên tệp xuất:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                disabled={isExporting}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <span className="text-xs font-mono text-cyan-400 font-bold px-2 py-2 bg-slate-800 rounded-lg">
                .{format}
              </span>
            </div>
          </div>

          {/* Export Mode: Master Mixdown vs Stems */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Chế độ xuất:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportMode('master')}
                disabled={isExporting}
                className={`flex flex-col items-start p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  exportMode === 'master'
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold">Toàn bộ Master</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1">Trộn tất cả track thành 1 file</span>
              </button>

              <button
                type="button"
                onClick={() => setExportMode('stems')}
                disabled={isExporting}
                className={`flex flex-col items-start p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  exportMode === 'stems'
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold">Từng Track riêng</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1">Xuất mỗi track thành 1 file độc lập</span>
              </button>
            </div>
          </div>

          {/* Format selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Định dạng file:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                disabled={isExporting}
                className={`flex flex-col items-start p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  format === 'mp3'
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-bold">MP3</span>
                <span className="text-[11px] text-slate-400">Nén thông dụng, tải nhanh</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('wav')}
                disabled={isExporting}
                className={`flex flex-col items-start p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  format === 'wav'
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-bold">WAV (16-bit)</span>
                <span className="text-[11px] text-slate-400">Chất lượng phòng thu nguyên bản</span>
              </button>
            </div>
          </div>

          {/* MP3 Bitrate Options */}
          {format === 'mp3' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Chất lượng MP3 (Bitrate):</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { rate: 128 as const, label: '128 kbps', desc: 'Tiết kiệm' },
                  { rate: 192 as const, label: '192 kbps', desc: 'Tiêu chuẩn' },
                  { rate: 320 as const, label: '320 kbps', desc: 'Chất lượng cao' },
                ].map((item) => (
                  <button
                    key={item.rate}
                    type="button"
                    onClick={() => setBitrate(item.rate)}
                    disabled={isExporting}
                    className={`flex flex-col items-center p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      bitrate === item.rate
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] text-slate-400">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export Range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Phạm vi xuất:</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="exportRange"
                  value="all"
                  checked={exportRange === 'all'}
                  onChange={() => setExportRange('all')}
                  disabled={isExporting}
                  className="accent-cyan-400"
                />
                <span className="text-xs text-slate-200">Toàn bộ Timeline</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 ${
                  !hasSelection ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="exportRange"
                  value="selection"
                  checked={exportRange === 'selection'}
                  onChange={() => setExportRange('selection')}
                  disabled={!hasSelection || isExporting}
                  className="accent-cyan-400"
                />
                <span className="text-xs text-slate-200">Chỉ đoạn đã chọn</span>
              </label>
            </div>
          </div>

          {/* Progress bar during encoding */}
          {isExporting && (
            <div className="flex flex-col gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>{currentStepText}</span>
                </span>
                <span className="font-mono text-cyan-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Download ready confirmation */}
          {downloadReady && !isExporting && (
            <div className="flex items-center justify-between p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {downloadReady.count > 1
                    ? `Đã xuất và tải về ${downloadReady.count} track riêng thành công!`
                    : 'File đã xuất và tự động tải về thành công!'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-950/60 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={handleStartExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 rounded-xl shadow-md shadow-cyan-500/20 disabled:opacity-40 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting
                ? 'Đang xuất...'
                : exportMode === 'stems'
                ? 'Xuất từng Track riêng'
                : 'Bắt đầu xuất Mixdown'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
