/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WaveformRenderConfig } from '../types/audio';
import { drawFrequencyScale } from './spectrogramService';

export interface ColorPalette {
  top: string;
  mid: string;
  bottom: string;
  glow: string;
  line: string;
}

export const COLOR_PALETTES: Record<WaveformRenderConfig['colorScheme'], ColorPalette> = {
  cyan: {
    top: '#38bdf8',
    mid: '#06b6d4',
    bottom: '#0284c7',
    glow: 'rgba(6, 182, 212, 0.5)',
    line: '#22d3ee',
  },
  neon: {
    top: '#f43f5e',
    mid: '#ec4899',
    bottom: '#a855f7',
    glow: 'rgba(236, 72, 153, 0.6)',
    line: '#f472b6',
  },
  amber: {
    top: '#fbbf24',
    mid: '#f59e0b',
    bottom: '#d97706',
    glow: 'rgba(245, 158, 11, 0.5)',
    line: '#fcd34d',
  },
  emerald: {
    top: '#34d399',
    mid: '#10b981',
    bottom: '#059669',
    glow: 'rgba(16, 185, 129, 0.5)',
    line: '#6ee7b7',
  },
  crimson: {
    top: '#fb7185',
    mid: '#e11d48',
    bottom: '#9f1239',
    glow: 'rgba(225, 29, 72, 0.5)',
    line: '#fda4af',
  },
  silver: {
    top: '#e2e8f0',
    mid: '#94a3b8',
    bottom: '#64748b',
    glow: 'rgba(148, 163, 184, 0.4)',
    line: '#cbd5e1',
  },
};

export function renderWaveformCanvas(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  leftPeaks: Float32Array | null,
  rightPeaks: Float32Array | null,
  width: number,
  height: number,
  config: WaveformRenderConfig,
  spectrogramCanvas?: HTMLCanvasElement | null
): void {
  const centerY = height / 2;
  const halfHeight = centerY - 12;
  const palette = COLOR_PALETTES[config.colorScheme] || COLOR_PALETTES.cyan;
  const numBuckets = peaks.length / 2;

  // Reset context state
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Background
  if (config.template === 'oscilloscope') {
    ctx.fillStyle = '#03140c'; // CRT Dark Phosphor green
  } else if (config.template === 'neon') {
    ctx.fillStyle = '#0a0518'; // Dark Cyberpunk violet
  } else {
    ctx.fillStyle = '#090d16'; // Classic DAW dark
  }
  ctx.fillRect(0, 0, width, height);

  // Render Spectrogram Overlay if enabled (under the waveform with soft translucent opacity)
  if (config.showSpectrogram && spectrogramCanvas) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.08, Math.min(0.75, config.spectrogramOpacity || 0.35));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(spectrogramCanvas, 0, 0, width, height);
    ctx.restore();

    // Frequency scale markers (e.g. 16kHz, 8kHz, 1kHz, 200Hz)
    drawFrequencyScale(ctx, width, height);
  }

  // Background Grid
  if (config.showGrid || config.template === 'oscilloscope' || config.template === 'neon') {
    ctx.strokeStyle = config.template === 'oscilloscope' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 1;
    const gridSpacing = config.template === 'oscilloscope' ? 24 : 40;

    ctx.beginPath();
    // Vertical grid lines
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    // Horizontal dB lines
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  // Center reference axis
  ctx.strokeStyle = config.template === 'oscilloscope' ? 'rgba(34, 197, 94, 0.4)' : '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  // Glow setup if enabled
  if (config.glowEffect || config.template === 'neon' || config.template === 'oscilloscope') {
    ctx.shadowBlur = config.template === 'neon' ? 12 : 8;
    ctx.shadowColor = config.template === 'oscilloscope' ? '#22c55e' : palette.glow;
  }

  // --- TEMPLATE 1: CLASSIC STUDIO BARS ---
  if (config.template === 'classic') {
    const gradient = ctx.createLinearGradient(0, centerY - halfHeight, 0, centerY + halfHeight);
    gradient.addColorStop(0, palette.top);
    gradient.addColorStop(0.5, palette.mid);
    gradient.addColorStop(1, palette.bottom);

    ctx.fillStyle = gradient;
    const step = Math.max(1, config.barWidth + config.barGap);

    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.floor((x / width) * numBuckets);
      const minVal = peaks[peakIdx * 2] || 0;
      const maxVal = peaks[peakIdx * 2 + 1] || 0;

      const yTop = centerY - maxVal * halfHeight;
      const yBottom = centerY - minVal * halfHeight;
      const barHeight = Math.max(2, yBottom - yTop);

      ctx.fillRect(x, yTop, config.barWidth, barHeight);
    }
  }

  // --- TEMPLATE 2: SMOOTH SPLINE FLOW (SOUNDCLOUD / CURVE) ---
  else if (config.template === 'smooth') {
    const step = Math.max(2, config.barWidth * 2);
    const topPoints: { x: number; y: number }[] = [];
    const bottomPoints: { x: number; y: number }[] = [];

    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.floor((x / width) * numBuckets);
      const minVal = peaks[peakIdx * 2] || 0;
      const maxVal = peaks[peakIdx * 2 + 1] || 0;

      topPoints.push({ x, y: centerY - maxVal * halfHeight });
      bottomPoints.push({ x, y: centerY - minVal * halfHeight });
    }

    if (topPoints.length > 0) {
      // Area Fill
      const areaGradient = ctx.createLinearGradient(0, centerY - halfHeight, 0, centerY + halfHeight);
      areaGradient.addColorStop(0, `${palette.top}99`);
      areaGradient.addColorStop(0.5, `${palette.mid}66`);
      areaGradient.addColorStop(1, `${palette.bottom}99`);

      ctx.beginPath();
      ctx.moveTo(topPoints[0].x, centerY);
      for (let i = 0; i < topPoints.length; i++) {
        ctx.lineTo(topPoints[i].x, topPoints[i].y);
      }
      for (let i = bottomPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = areaGradient;
      ctx.fill();

      // Top glowing stroke line
      ctx.beginPath();
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i++) {
        ctx.lineTo(topPoints[i].x, topPoints[i].y);
      }
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bottom glowing stroke line
      ctx.beginPath();
      ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
      for (let i = 1; i < bottomPoints.length; i++) {
        ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
      }
      ctx.strokeStyle = palette.bottom;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // --- TEMPLATE 3: NEON CYBERPUNK LASER WAVE ---
  else if (config.template === 'neon') {
    const step = Math.max(1, config.barWidth + config.barGap);

    const laserGradient = ctx.createLinearGradient(0, centerY - halfHeight, 0, centerY + halfHeight);
    laserGradient.addColorStop(0, '#f43f5e'); // hot pink
    laserGradient.addColorStop(0.5, '#ec4899'); // neon magenta
    laserGradient.addColorStop(1, '#a855f7'); // electric purple

    ctx.fillStyle = laserGradient;

    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.floor((x / width) * numBuckets);
      const minVal = peaks[peakIdx * 2] || 0;
      const maxVal = peaks[peakIdx * 2 + 1] || 0;

      const yTop = centerY - maxVal * halfHeight;
      const yBottom = centerY - minVal * halfHeight;
      const barHeight = Math.max(2, yBottom - yTop);

      ctx.fillRect(x, yTop, config.barWidth, barHeight);

      // Accent laser spark at peaks
      if (Math.abs(maxVal) > 0.4) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, yTop - 1, config.barWidth, 2);
        ctx.fillStyle = laserGradient;
      }
    }

    // Laser center accent line
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // --- TEMPLATE 4: LED MATRIX / VU METER DOTS ---
  else if (config.template === 'led') {
    const colStep = 4; // Distance between LED columns
    const dotSpacing = 5; // Distance between vertical LED dots
    const dotRadius = 1.6;

    for (let x = 2; x < width; x += colStep) {
      const peakIdx = Math.floor((x / width) * numBuckets);
      const maxVal = Math.max(Math.abs(peaks[peakIdx * 2] || 0), Math.abs(peaks[peakIdx * 2 + 1] || 0));
      const colHeight = maxVal * halfHeight;

      // Draw symmetrical dots above and below center
      for (let dist = 0; dist < halfHeight; dist += dotSpacing) {
        const isLit = dist <= colHeight;
        const normalizedLevel = dist / halfHeight;

        // Color coding: Green (low) -> Yellow (mid) -> Red (peak)
        let dotColor: string;
        if (normalizedLevel > 0.85) {
          dotColor = isLit ? '#ef4444' : 'rgba(239, 68, 68, 0.15)'; // Red
        } else if (normalizedLevel > 0.6) {
          dotColor = isLit ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)'; // Amber
        } else {
          dotColor = isLit ? '#10b981' : 'rgba(16, 185, 129, 0.15)'; // Green
        }

        ctx.fillStyle = dotColor;

        // Top dot
        ctx.beginPath();
        ctx.arc(x, centerY - dist, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Bottom dot
        if (dist > 0) {
          ctx.beginPath();
          ctx.arc(x, centerY + dist, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // --- TEMPLATE 5: STEREO SPLIT (L / R DUAL CHANNEL) ---
  else if (config.template === 'stereo') {
    const leftData = leftPeaks || peaks;
    const rightData = rightPeaks || peaks;
    const chHeight = (height / 2) - 18;

    // Left channel center: 1/4 of total height
    const leftCenterY = height * 0.26;
    // Right channel center: 3/4 of total height
    const rightCenterY = height * 0.74;

    // Draw Channel Labels
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('L (Trái)', 10, leftCenterY - chHeight * 0.75);

    ctx.fillStyle = '#fb923c';
    ctx.fillText('R (Phải)', 10, rightCenterY - chHeight * 0.75);

    // Separator line between L and R
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    const step = Math.max(1, config.barWidth + config.barGap);

    // Render Left Channel (Cyan gradient)
    ctx.fillStyle = '#06b6d4';
    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.floor((x / width) * numBuckets);
      const minVal = leftData[peakIdx * 2] || 0;
      const maxVal = leftData[peakIdx * 2 + 1] || 0;

      const yTop = leftCenterY - maxVal * chHeight * 0.8;
      const yBottom = leftCenterY - minVal * chHeight * 0.8;
      ctx.fillRect(x, yTop, config.barWidth, Math.max(2, yBottom - yTop));
    }

    // Render Right Channel (Orange / Coral gradient)
    ctx.fillStyle = '#f97316';
    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.floor((x / width) * numBuckets);
      const minVal = rightData[peakIdx * 2] || 0;
      const maxVal = rightData[peakIdx * 2 + 1] || 0;

      const yTop = rightCenterY - maxVal * chHeight * 0.8;
      const yBottom = rightCenterY - minVal * chHeight * 0.8;
      ctx.fillRect(x, yTop, config.barWidth, Math.max(2, yBottom - yTop));
    }
  }

  // --- TEMPLATE 6: CRT OSCILLOSCOPE (VINTAGE PHOSPHOR) ---
  else if (config.template === 'oscilloscope') {
    ctx.strokeStyle = '#22c55e'; // Phosphor green
    ctx.lineWidth = 2;
    ctx.beginPath();

    const step = 2;
    let isFirst = true;

    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.floor((x / width) * numBuckets);
      // Alternate between positive and negative peaks to create continuous analog oscilloscope trace
      const val = (x / step) % 2 === 0 ? (peaks[peakIdx * 2 + 1] || 0) : (peaks[peakIdx * 2] || 0);
      const y = centerY - val * halfHeight;

      if (isFirst) {
        ctx.moveTo(x, y);
        isFirst = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Circular radar reticle at center
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(width / 2, centerY, 60, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
