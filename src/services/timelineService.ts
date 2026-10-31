/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimelineClip, SelectionRange } from '../types/audio';

export interface ClipTheme {
  name: string;
  border: string;
  selectedBorder: string;
  selectedGlow: string;
  bg: string;
  selectedBg: string;
  tagBg: string;
  tagText: string;
  waveColor: string;
  waveSelectedColor: string;
}

export const CLIP_THEMES: ClipTheme[] = [
  {
    name: 'Cyan',
    border: '#0891b2',
    selectedBorder: '#38bdf8',
    selectedGlow: 'rgba(56, 189, 248, 0.45)',
    bg: 'rgba(6, 182, 212, 0.08)',
    selectedBg: 'rgba(6, 182, 212, 0.22)',
    tagBg: '#0e7490',
    tagText: '#e0f2fe',
    waveColor: '#06b6d4',
    waveSelectedColor: '#38bdf8',
  },
  {
    name: 'Emerald',
    border: '#059669',
    selectedBorder: '#34d399',
    selectedGlow: 'rgba(52, 211, 153, 0.45)',
    bg: 'rgba(16, 185, 129, 0.08)',
    selectedBg: 'rgba(16, 185, 129, 0.22)',
    tagBg: '#047857',
    tagText: '#d1fae5',
    waveColor: '#10b981',
    waveSelectedColor: '#34d399',
  },
  {
    name: 'Purple',
    border: '#9333ea',
    selectedBorder: '#c084fc',
    selectedGlow: 'rgba(192, 132, 252, 0.45)',
    bg: 'rgba(168, 85, 247, 0.08)',
    selectedBg: 'rgba(168, 85, 247, 0.22)',
    tagBg: '#7e22ce',
    tagText: '#f3e8ff',
    waveColor: '#a855f7',
    waveSelectedColor: '#c084fc',
  },
  {
    name: 'Amber',
    border: '#d97706',
    selectedBorder: '#fbbf24',
    selectedGlow: 'rgba(251, 191, 36, 0.45)',
    bg: 'rgba(245, 158, 11, 0.08)',
    selectedBg: 'rgba(245, 158, 11, 0.22)',
    tagBg: '#b45309',
    tagText: '#fef3c7',
    waveColor: '#f59e0b',
    waveSelectedColor: '#fbbf24',
  },
  {
    name: 'Rose',
    border: '#e11d48',
    selectedBorder: '#fb7185',
    selectedGlow: 'rgba(251, 113, 133, 0.45)',
    bg: 'rgba(244, 63, 94, 0.08)',
    selectedBg: 'rgba(244, 63, 94, 0.22)',
    tagBg: '#be123c',
    tagText: '#ffe4e6',
    waveColor: '#f43f5e',
    waveSelectedColor: '#fb7185',
  },
  {
    name: 'Sky Blue',
    border: '#2563eb',
    selectedBorder: '#60a5fa',
    selectedGlow: 'rgba(96, 165, 250, 0.45)',
    bg: 'rgba(59, 130, 246, 0.08)',
    selectedBg: 'rgba(59, 130, 246, 0.22)',
    tagBg: '#1d4ed8',
    tagText: '#dbeafe',
    waveColor: '#3b82f6',
    waveSelectedColor: '#60a5fa',
  },
  {
    name: 'Teal',
    border: '#0d9488',
    selectedBorder: '#2dd4bf',
    selectedGlow: 'rgba(45, 212, 191, 0.45)',
    bg: 'rgba(20, 184, 166, 0.08)',
    selectedBg: 'rgba(20, 184, 166, 0.22)',
    tagBg: '#0f766e',
    tagText: '#ccfbf1',
    waveColor: '#14b8a6',
    waveSelectedColor: '#2dd4bf',
  },
  {
    name: 'Indigo',
    border: '#4f46e5',
    selectedBorder: '#818cf8',
    selectedGlow: 'rgba(129, 140, 248, 0.45)',
    bg: 'rgba(99, 102, 241, 0.08)',
    selectedBg: 'rgba(99, 102, 241, 0.22)',
    tagBg: '#4338ca',
    tagText: '#e0e7ff',
    waveColor: '#6366f1',
    waveSelectedColor: '#818cf8',
  },
];

export function getClipTheme(colorIndex: number): ClipTheme {
  const index = Math.abs(colorIndex) % CLIP_THEMES.length;
  return CLIP_THEMES[index];
}

export interface ClipTimelinePlacement {
  clip: TimelineClip;
  index: number;
  timelineStart: number;
  timelineEnd: number;
  duration: number;
}

/**
 * Calculates start and end timestamps of each clip along the sequence timeline
 */
export function getTimelinePlacements(clips: TimelineClip[]): ClipTimelinePlacement[] {
  let currentTime = 0;
  return clips.map((clip, index) => {
    const duration = Math.max(0, clip.sourceEnd - clip.sourceStart);
    const timelineStart = currentTime;
    const timelineEnd = currentTime + duration;
    currentTime = timelineEnd;
    return {
      clip,
      index,
      timelineStart,
      timelineEnd,
      duration,
    };
  });
}

/**
 * Total timeline duration in seconds
 */
export function getTimelineTotalDuration(clips: TimelineClip[]): number {
  return clips.reduce((acc, clip) => acc + Math.max(0, clip.sourceEnd - clip.sourceStart), 0);
}

/**
 * Builds a single composite AudioBuffer from all timeline clips sequentially.
 * Used for audio playback, export, spectrogram and audio processing.
 */
export function buildCompositeBuffer(
  ctx: BaseAudioContext,
  clips: TimelineClip[]
): AudioBuffer | null {
  if (clips.length === 0) return null;

  const validClips = clips.filter((c) => c.sourceEnd > c.sourceStart);
  if (validClips.length === 0) return null;

  const sampleRate = validClips[0].sourceBuffer.sampleRate;
  const numberOfChannels = Math.max(
    ...validClips.map((c) => c.sourceBuffer.numberOfChannels),
    2
  );

  let totalSamples = 0;
  for (const clip of validClips) {
    const dur = clip.sourceEnd - clip.sourceStart;
    totalSamples += Math.round(dur * sampleRate);
  }

  if (totalSamples <= 0) return null;

  const composite = ctx.createBuffer(numberOfChannels, totalSamples, sampleRate);

  let currentSampleOffset = 0;
  for (const clip of validClips) {
    const src = clip.sourceBuffer;
    const srcStartSample = Math.max(0, Math.floor(clip.sourceStart * src.sampleRate));
    const srcEndSample = Math.min(src.length, Math.ceil(clip.sourceEnd * src.sampleRate));
    const clipSamples = Math.max(0, srcEndSample - srcStartSample);

    if (clipSamples > 0) {
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const destData = composite.getChannelData(ch);
        const srcCh = Math.min(ch, src.numberOfChannels - 1);
        const srcData = src.getChannelData(srcCh);

        for (let i = 0; i < clipSamples; i++) {
          if (currentSampleOffset + i < totalSamples) {
            destData[currentSampleOffset + i] = srcData[srcStartSample + i];
          }
        }
      }
      currentSampleOffset += clipSamples;
    }
  }

  return composite;
}

/**
 * Extracts downsampled min/max peak pairs directly from a clip's source slice
 * without copying or cloning audio buffers.
 */
export function extractClipPeaks(
  sourceBuffer: AudioBuffer,
  sourceStart: number,
  sourceEnd: number,
  numBuckets: number = 500
): Float32Array {
  const sampleRate = sourceBuffer.sampleRate;
  const startSample = Math.max(0, Math.floor(sourceStart * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.ceil(sourceEnd * sampleRate));
  const length = Math.max(1, endSample - startSample);
  const bucketSize = Math.max(1, Math.floor(length / numBuckets));
  const peaks = new Float32Array(numBuckets * 2);

  const channels = sourceBuffer.numberOfChannels;
  const chData0 = sourceBuffer.getChannelData(0);
  const chData1 = channels > 1 ? sourceBuffer.getChannelData(1) : chData0;

  for (let b = 0; b < numBuckets; b++) {
    const bStart = startSample + b * bucketSize;
    const bEnd = Math.min(endSample, bStart + bucketSize);
    let min = 1.0;
    let max = -1.0;

    const stride = Math.max(1, Math.floor((bEnd - bStart) / 40));
    for (let i = bStart; i < bEnd; i += stride) {
      const val = (chData0[i] + chData1[i]) * 0.5;
      if (val < min) min = val;
      if (val > max) max = val;
    }

    if (min > max) {
      min = 0;
      max = 0;
    }

    peaks[b * 2] = min;
    peaks[b * 2 + 1] = max;
  }

  return peaks;
}

/**
 * Splits a clip at a specific timeline timestamp into two clips.
 * NEVER LOSES ANY AUDIO DATA: both clips point to the same original sourceBuffer!
 */
export function splitTimelineAtTime(
  clips: TimelineClip[],
  splitTime: number
): { clips: TimelineClip[]; newClipId: string | null } {
  const placements = getTimelinePlacements(clips);
  const target = placements.find(
    (p) => splitTime > p.timelineStart + 0.015 && splitTime < p.timelineEnd - 0.015
  );

  if (!target) {
    return { clips, newClipId: null };
  }

  const offsetInClip = splitTime - target.timelineStart;
  const original = target.clip;
  const splitSourceTime = original.sourceStart + offsetInClip;

  const baseName = original.name.replace(/\s*\(\d+\)$/, '');
  const newClipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  const clipA: TimelineClip = {
    ...original,
    name: `${baseName} (1)`,
    sourceEnd: splitSourceTime,
  };

  const clipB: TimelineClip = {
    id: newClipId,
    name: `${baseName} (2)`,
    sourceBuffer: original.sourceBuffer,
    sourceStart: splitSourceTime,
    sourceEnd: original.sourceEnd,
    colorIndex: (original.colorIndex + 1) % CLIP_THEMES.length,
  };

  const newClips: TimelineClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    if (i === target.index) {
      newClips.push(clipA, clipB);
    } else {
      newClips.push(clips[i]);
    }
  }

  return { clips: newClips, newClipId };
}

/**
 * Splits timeline around a dragged selection range [start, end].
 * Produces up to 3 clips (before selection, selection, after selection)
 * without losing any audio data!
 */
export function splitTimelineAtRange(
  clips: TimelineClip[],
  range: SelectionRange
): { clips: TimelineClip[]; middleClipIds: string[] } {
  if (range.end <= range.start + 0.02) {
    return { clips, middleClipIds: [] };
  }

  // First split at range.end (higher timestamp first so range.start timestamp remains stable)
  const afterEndSplit = splitTimelineAtTime(clips, range.end).clips;

  // Then split at range.start
  const afterBothSplits = splitTimelineAtTime(afterEndSplit, range.start).clips;

  // Identify clips that are now inside the selection range
  const placements = getTimelinePlacements(afterBothSplits);
  const middleClipIds = placements
    .filter((p) => {
      const mid = (p.timelineStart + p.timelineEnd) / 2;
      return mid >= range.start - 0.01 && mid <= range.end + 0.01;
    })
    .map((p) => p.clip.id);

  return {
    clips: afterBothSplits,
    middleClipIds,
  };
}

/**
 * Deletes specific clips by ID. Subsequent clips automatically shift left with 0 gap!
 */
export function deleteClipsByIds(
  clips: TimelineClip[],
  clipIdsToDelete: Set<string>
): TimelineClip[] {
  return clips.filter((c) => !clipIdsToDelete.has(c.id));
}

/**
 * Deletes a range on the timeline: splits at range boundaries, then deletes the clips inside.
 * Subsequent clips automatically shift left seamlessly (ripple delete).
 */
export function deleteTimelineRange(
  clips: TimelineClip[],
  range: SelectionRange
): TimelineClip[] {
  const { clips: splitClips, middleClipIds } = splitTimelineAtRange(clips, range);
  if (middleClipIds.length === 0) return splitClips;
  const deleteSet = new Set(middleClipIds);
  return splitClips.filter((c) => !deleteSet.has(c.id));
}

/**
 * Keeps ONLY the selection range (Crop): splits at boundaries and discards outside clips.
 */
export function cropTimelineToRange(
  clips: TimelineClip[],
  range: SelectionRange
): TimelineClip[] {
  const { clips: splitClips, middleClipIds } = splitTimelineAtRange(clips, range);
  if (middleClipIds.length === 0) return splitClips;
  const keepSet = new Set(middleClipIds);
  return splitClips.filter((c) => keepSet.has(c.id));
}
