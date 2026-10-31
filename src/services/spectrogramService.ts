/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * High performance Client-Side STFT Spectrogram Generator
 * Computes frequency spectrum over time and renders a heatmap canvas
 */

// In-place Cooley-Tukey Radix-2 FFT
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;

      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly updates
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let m = 0; m < halfLen; m++) {
        const idxEven = i + m;
        const idxOdd = i + m + halfLen;

        const uR = real[idxEven];
        const uI = imag[idxEven];

        const vR = real[idxOdd] * wR - imag[idxOdd] * wI;
        const vI = real[idxOdd] * wI + imag[idxOdd] * wR;

        real[idxEven] = uR + vR;
        imag[idxEven] = uI + vI;

        real[idxOdd] = uR - vR;
        imag[idxOdd] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }
}

// Generate Hann window
function getHannWindow(size: number): Float32Array {
  const win = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return win;
}

// Color Palette LUTs (Normalized 0.0 to 1.0)
type RGB = [number, number, number];

function interpolateColor(t: number, stops: { pos: number; color: RGB }[]): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (clamped >= s1.pos && clamped <= s2.pos) {
      const frac = (clamped - s1.pos) / (s2.pos - s1.pos);
      return [
        Math.round(s1.color[0] + (s2.color[0] - s1.color[0]) * frac),
        Math.round(s1.color[1] + (s2.color[1] - s1.color[1]) * frac),
        Math.round(s1.color[2] + (s2.color[2] - s1.color[2]) * frac),
      ];
    }
  }
  return stops[stops.length - 1].color;
}

const PALETTE_DEFINITIONS: Record<string, { pos: number; color: RGB }[]> = {
  magma: [
    { pos: 0.0, color: [10, 5, 20] },
    { pos: 0.25, color: [80, 18, 120] },
    { pos: 0.5, color: [180, 50, 80] },
    { pos: 0.75, color: [245, 140, 30] },
    { pos: 1.0, color: [255, 250, 190] },
  ],
  viridis: [
    { pos: 0.0, color: [68, 1, 84] },
    { pos: 0.3, color: [49, 104, 142] },
    { pos: 0.6, color: [53, 183, 121] },
    { pos: 0.85, color: [180, 222, 44] },
    { pos: 1.0, color: [253, 231, 37] },
  ],
  cyan: [
    { pos: 0.0, color: [8, 14, 28] },
    { pos: 0.3, color: [24, 50, 110] },
    { pos: 0.6, color: [6, 182, 212] },
    { pos: 0.85, color: [103, 232, 249] },
    { pos: 1.0, color: [240, 253, 255] },
  ],
  fire: [
    { pos: 0.0, color: [15, 3, 2] },
    { pos: 0.3, color: [160, 24, 12] },
    { pos: 0.65, color: [245, 120, 15] },
    { pos: 0.9, color: [255, 225, 40] },
    { pos: 1.0, color: [255, 255, 230] },
  ],
};

// Cache for generated offscreen canvas
interface SpectrogramCache {
  buffer: AudioBuffer;
  palette: string;
  canvas: HTMLCanvasElement;
}

let cachedSpectrogram: SpectrogramCache | null = null;

/**
 * Computes STFT spectrogram and draws onto an offscreen canvas
 */
export function generateSpectrogramCanvas(
  buffer: AudioBuffer,
  palette: 'magma' | 'viridis' | 'cyan' | 'fire' = 'magma'
): HTMLCanvasElement {
  // Check cache
  if (cachedSpectrogram && cachedSpectrogram.buffer === buffer && cachedSpectrogram.palette === palette) {
    return cachedSpectrogram.canvas;
  }

  const fftSize = 512;
  const halfFft = fftSize >> 1; // 256 frequency bins
  const hann = getHannWindow(fftSize);

  // Mix down to mono for spectral analysis
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  const ch0 = buffer.getChannelData(0);
  const ch1 = channels > 1 ? buffer.getChannelData(1) : ch0;

  for (let i = 0; i < length; i++) {
    mono[i] = (ch0[i] + ch1[i]) * 0.5;
  }

  // Calculate number of time slices (columns)
  const numTimeSlices = Math.min(1600, Math.max(400, Math.floor(length / 256)));
  const numFreqBins = 140; // Frequency display bins (logarithmic scale)

  const offscreen = document.createElement('canvas');
  offscreen.width = numTimeSlices;
  offscreen.height = numFreqBins;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return offscreen;

  const imgData = ctx.createImageData(numTimeSlices, numFreqBins);
  const data = imgData.data;

  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  const paletteStops = PALETTE_DEFINITIONS[palette] || PALETTE_DEFINITIONS.magma;
  const hopStep = (length - fftSize) / Math.max(1, numTimeSlices - 1);

  // Dynamic range thresholds in dB
  const minDb = -75;
  const maxDb = -5;
  const dbRange = maxDb - minDb;

  for (let t = 0; t < numTimeSlices; t++) {
    const startSample = Math.min(length - fftSize, Math.max(0, Math.floor(t * hopStep)));

    // Windowed signal
    for (let i = 0; i < fftSize; i++) {
      real[i] = mono[startSample + i] * hann[i];
      imag[i] = 0;
    }

    fft(real, imag);

    // Compute magnitude spectrum for bins
    const magnitudes = new Float32Array(halfFft);
    for (let k = 0; k < halfFft; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      // Convert to dB
      const db = 20 * Math.log10(mag + 1e-6);
      const normalized = Math.max(0, Math.min(1, (db - minDb) / dbRange));
      magnitudes[k] = normalized;
    }

    // Map frequency bins on a quasi-logarithmic / perceptual scale to vertical pixels
    // y = 0 is highest frequency (top), y = numFreqBins - 1 is lowest frequency (bottom)
    for (let y = 0; y < numFreqBins; y++) {
      // Invert: 0 at bottom, 1 at top
      const freqFrac = 1.0 - (y / numFreqBins);
      // Logarithmic / power mapping (giving more space to bass & midrange)
      const binIndex = Math.min(
        halfFft - 1,
        Math.max(1, Math.floor(Math.pow(freqFrac, 1.8) * (halfFft - 1)))
      );

      const intensity = magnitudes[binIndex];
      const [r, g, b] = interpolateColor(intensity, paletteStops);

      const pixelIdx = (y * numTimeSlices + t) * 4;
      data[pixelIdx] = r;
      data[pixelIdx + 1] = g;
      data[pixelIdx + 2] = b;
      data[pixelIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Update cache
  cachedSpectrogram = {
    buffer,
    palette,
    canvas: offscreen,
  };

  return offscreen;
}

/**
 * Draw frequency scale labels (e.g., 10kHz, 5kHz, 1kHz, 200Hz) on the canvas
 */
export function drawFrequencyScale(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const markers = [
    { label: '16 kHz', frac: 0.92 },
    { label: '8 kHz', frac: 0.72 },
    { label: '4 kHz', frac: 0.52 },
    { label: '1 kHz', frac: 0.28 },
    { label: '200 Hz', frac: 0.10 },
  ];

  ctx.save();
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'right';

  markers.forEach(({ label, frac }) => {
    const y = height - (frac * height);

    // Subtle dotted horizontal tick
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    // Frequency label tag with dark background for high legibility
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(width - 50, y - 6, 46, 12);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.fillText(label, width - 8, y + 3);
  });

  ctx.restore();
}
