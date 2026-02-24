import type { HellFont } from './font.ts';
import { BAUD_RATE, CHAR_GAP_COLUMNS, COLUMN_HEIGHT, DEFAULT_TONE_HZ, GLYPH_HEIGHT, SAMPLE_RATE } from './constants.ts';

export interface EncodeOptions {
  sampleRate?: number;
  toneHz?: number;
}

/** Fade length in samples applied at on↔off transitions to eliminate clicks. */
const FADE_SAMPLES = 8;

/**
 * Build the flat pixel on/off sequence for the given text.
 * Pixels are in transmission order (bottom to top per column, left to right per character).
 */
function buildPixelSequence(text: string, font: HellFont): boolean[] {
  const pixels: boolean[] = [];

  for (const char of text) {
    const glyph = font.getGlyph(char);
    if (!glyph) continue;
    const glyphWidth = glyph[0]?.length ?? 0;

    for (let col = 0; col < glyphWidth; col++) {
      for (let copy = 0; copy < 2; copy++) {
        for (let row = GLYPH_HEIGHT - 1; row >= 0; row--) {
          pixels.push(!!glyph[row]?.[col]);
        }
      }
    }

    for (let col = 0; col < CHAR_GAP_COLUMNS; col++) {
      for (let p = 0; p < COLUMN_HEIGHT; p++) pixels.push(false);
    }
  }

  return pixels;
}

/**
 * Encode text into Feld-Hell audio samples.
 *
 * Feld-Hell transmits characters as a bitmap, column by column, bottom to top.
 * Each pixel is either tone-on or silence for one pixel duration (1/BAUD_RATE seconds).
 * Each column has COLUMN_HEIGHT (14) pixels: the glyph is sent twice (double print).
 *
 * A short linear fade is applied at on↔off transitions to prevent audible clicks
 * caused by phase discontinuities.
 */
export function encode(text: string, font: HellFont, opts: EncodeOptions = {}): Float32Array {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const toneHz = opts.toneHz ?? DEFAULT_TONE_HZ;
  const samplesPerPixel = Math.round(sampleRate / BAUD_RATE);
  const angularFreq = 2 * Math.PI * toneHz;

  const pixels = buildPixelSequence(text, font);
  const samples = new Float32Array(pixels.length * samplesPerPixel);

  for (let pi = 0; pi < pixels.length; pi++) {
    if (!pixels[pi]) continue;

    const prevOn = pi > 0 && pixels[pi - 1];
    const nextOn = pi < pixels.length - 1 && pixels[pi + 1];
    const base = pi * samplesPerPixel;

    for (let s = 0; s < samplesPerPixel; s++) {
      const t = (base + s) / sampleRate;
      let amp = 1.0;
      if (!prevOn && s < FADE_SAMPLES) amp = s / FADE_SAMPLES;
      if (!nextOn && s >= samplesPerPixel - FADE_SAMPLES) amp = (samplesPerPixel - s) / FADE_SAMPLES;
      samples[base + s] = amp * Math.sin(angularFreq * t);
    }
  }

  return samples;
}

/**
 * Get the pixel columns for a text string (without audio generation).
 * Useful for testing and visualization.
 * Returns array of columns, each column is COLUMN_HEIGHT values (top to bottom, 0 or 1).
 * The glyph appears twice (double print).
 */
export function textToPixelColumns(text: string, font: HellFont): number[][] {
  const columns: number[][] = [];

  for (const char of text) {
    const glyph = font.getGlyph(char);
    if (!glyph) continue;

    const glyphWidth = glyph[0]?.length ?? 0;

    for (let col = 0; col < glyphWidth; col++) {
      const column: number[] = [];
      // Double print: glyph rows twice
      for (let copy = 0; copy < 2; copy++) {
        for (let row = 0; row < GLYPH_HEIGHT; row++) {
          column.push((row < glyph.length) ? (glyph[row]![col] ?? 0) : 0);
        }
      }
      columns.push(column);
    }

    // Inter-character gap
    for (let i = 0; i < CHAR_GAP_COLUMNS; i++) {
      columns.push(new Array(COLUMN_HEIGHT).fill(0));
    }
  }

  return columns;
}
