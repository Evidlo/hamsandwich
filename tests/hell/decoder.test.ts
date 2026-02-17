import { describe, it, expect } from 'vitest';
import { decode, DISPLAY_ROWS, SUB_PIXEL_FACTOR } from '../../src/hell/decoder.ts';
import { BAUD_RATE, COLUMN_HEIGHT, SAMPLE_RATE, DEFAULT_TONE_HZ } from '../../src/hell/constants.ts';

/** Threshold analog energy values to binary for comparison */
function threshold(columns: number[][], t = 0.3): number[][] {
  return columns.map(col => col.map(v => v > t ? 1 : 0));
}

describe('decode', () => {
  const samplesPerPixel = Math.round(SAMPLE_RATE / BAUD_RATE);

  function generateTonePixels(pattern: number[]): Float32Array {
    // Generate audio for a sequence of pixels (1=tone, 0=silence)
    const totalSamples = pattern.length * samplesPerPixel;
    const samples = new Float32Array(totalSamples);
    const angularFreq = 2 * Math.PI * DEFAULT_TONE_HZ;

    for (let p = 0; p < pattern.length; p++) {
      if (pattern[p]) {
        for (let s = 0; s < samplesPerPixel; s++) {
          const sampleIdx = p * samplesPerPixel + s;
          const t = sampleIdx / SAMPLE_RATE;
          samples[sampleIdx] = Math.sin(angularFreq * t);
        }
      }
    }
    return samples;
  }

  it('decodes a single all-on column with high energy', () => {
    const pattern = new Array(COLUMN_HEIGHT).fill(1);
    const samples = generateTonePixels(pattern);
    const columns = decode(samples);

    expect(columns.length).toBe(1);
    for (const val of columns[0]!) {
      expect(val).toBeGreaterThan(0.5);
    }
  });

  it('decodes a single all-off column with near-zero energy', () => {
    const pattern = new Array(COLUMN_HEIGHT).fill(0);
    const samples = generateTonePixels(pattern);
    const columns = decode(samples);

    expect(columns.length).toBe(1);
    for (const val of columns[0]!) {
      expect(val).toBeLessThan(0.01);
    }
  });

  it('decodes mixed on/off pixels with correct row ordering', () => {
    // Transmission order bottom to top: first pixel on, rest off
    const transmissionOrder = new Array(COLUMN_HEIGHT).fill(0);
    transmissionOrder[0] = 1; // bottom pixel on
    const samples = generateTonePixels(transmissionOrder);
    const columns = decode(samples);

    expect(columns.length).toBe(1);
    // In display order (top to bottom), only the bottom SUB_PIXEL_FACTOR rows should be on
    const binary = threshold(columns)[0]!;
    expect(binary.length).toBe(DISPLAY_ROWS);
    // Bottom SUB_PIXEL_FACTOR rows should be on
    for (let i = DISPLAY_ROWS - SUB_PIXEL_FACTOR; i < DISPLAY_ROWS; i++) {
      expect(binary[i]).toBe(1);
    }
    // Everything above should be off
    expect(binary.slice(0, DISPLAY_ROWS - SUB_PIXEL_FACTOR).every(v => v === 0)).toBe(true);
  });

  it('returns empty for insufficient samples', () => {
    const samples = new Float32Array(10);
    const columns = decode(samples);
    expect(columns.length).toBe(0);
  });
});
