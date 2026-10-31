/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, X, AlertCircle } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (buffer: AudioBuffer, name: string) => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  onClose,
  onRecordingComplete,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stopFnRef = useRef<(() => Promise<AudioBuffer>) | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (isRecording && stopFnRef.current) {
        stopFnRef.current();
      }
      setIsRecording(false);
      setElapsedSec(0);
      setErrorMessage(null);
    }
  }, [isOpen, isRecording]);

  if (!isOpen) return null;

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const recorder = await audioEngine.recordMicrophone((sec) => {
        setElapsedSec(sec);
      });
      stopFnRef.current = recorder.stop;
      setIsRecording(true);
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      setErrorMessage('Không thể truy cập Microphone. Vui lòng cấp quyền truy cập micro trong trình duyệt.');
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (!stopFnRef.current) return;
    try {
      const buffer = await stopFnRef.current();
      setIsRecording(false);
      const name = `Bản ghi âm ${new Date().toLocaleTimeString('vi-VN')}`;
      onRecordingComplete(buffer, name);
      onClose();
    } catch (err) {
      console.error('Error stopping recording:', err);
      setErrorMessage('Lỗi khi mã hoá dữ liệu ghi âm.');
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-5">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-rose-500" />
            <h3 className="font-semibold text-slate-100 text-sm">Ghi Âm Trực Tiếp</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="w-full p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Big recording status orb */}
        <div className="relative flex items-center justify-center w-32 h-32">
          {isRecording && (
            <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
          )}
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all ${
              isRecording
                ? 'bg-rose-500/20 border-rose-500 shadow-lg shadow-rose-500/30'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <Mic className={`w-10 h-10 ${isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
          </div>
        </div>

        {/* Timer display */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-3xl font-bold tracking-wider text-slate-100">
            {formatTimer(elapsedSec)}
          </span>
          <span className="text-xs text-slate-400">
            {isRecording ? 'Đang thu âm từ microphone...' : 'Sẵn sàng ghi âm'}
          </span>
        </div>

        {/* Action button */}
        <div className="w-full flex items-center justify-center pt-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>Bắt đầu thu âm</span>
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-rose-500 text-rose-400 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Dừng & Nạp vào Studio</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
