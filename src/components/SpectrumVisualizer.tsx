/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { audioEngine } from '../services/audioEngine';

interface SpectrumVisualizerProps {
  isPlaying: boolean;
  className?: string;
}

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({ isPlaying, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audioEngine.getAnalyser();
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Gradient background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      const numBars = 48;
      const barWidth = Math.max(2, (width / numBars) - 1.5);

      for (let i = 0; i < numBars; i++) {
        // Logarithmic frequency scale mapping
        const logIndex = Math.floor(Math.pow(i / numBars, 2) * (bufferLength * 0.75));
        const value = isPlaying ? dataArray[logIndex] || 0 : 0;
        const percent = value / 255;
        const barHeight = Math.max(2, percent * (height - 6));

        // Dynamic color based on intensity
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#06b6d4');   // cyan
        gradient.addColorStop(0.6, '#3b82f6'); // blue
        gradient.addColorStop(1, '#a855f7');   // purple

        ctx.fillStyle = gradient;
        const x = i * (barWidth + 1.5);
        const y = height - barHeight;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying]);

  return (
    <div className={`relative flex flex-col bg-slate-950 border border-slate-800 rounded-lg p-2.5 shadow-inner ${className}`}>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1 font-mono">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          Phổ Tần Số (Real-time Spectrum)
        </span>
        <span className="text-[10px] text-slate-400">20Hz - 20kHz</span>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={56}
        className="w-full h-14 rounded bg-slate-900/50 block"
      />
    </div>
  );
};
