import type { HellFont } from './font.ts';
import { BAUD_RATE, CHAR_GAP_COLUMNS, COLUMN_HEIGHT, DEFAULT_TONE_HZ, GLYPH_HEIGHT, SAMPLE_RATE } from './constants.ts';

export interface EncodeOptions {
  sampleRate?: number;
  toneHz?: number;
}

/**
 * Encode text into Feld-Hell audio samples.
 *
 * Feld-Hell transmits characters as a bitmap, column by column, bottom to top.
 * Each pixel is either tone-on or silence for one pixel duration (1/BAUD_RATE seconds).
 * Each column has COLUMN_HEIGHT (14) pixels: the glyph is sent twice (double print).
 */
export function encode(text: string, font: HellFont, opts: EncodeOptions = {}): Float32Array {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const toneHz = opts.toneHz ?? DEFAULT_TONE_HZ;
  const samplesPerPixel = Math.round(sampleRate / BAUD_RATE);

  // First pass: count total samples needed
  let totalColumns = 0;
  for (const char of text) {
    const glyph = font.getGlyph(char);
    if (!glyph) continue;
    const glyphWidth = glyph[0]?.length ?? 0;
    totalColumns += glyphWidth + CHAR_GAP_COLUMNS;
  }

  const totalSamples = totalColumns * COLUMN_HEIGHT * samplesPerPixel;
  const samples = new Float32Array(totalSamples);

  // Second pass: generate audio
  let sampleIndex = 0;
  const angularFreq = 2 * Math.PI * toneHz;

  for (const char of text) {
    const glyph = font.getGlyph(char);
    if (!glyph) continue;

    const glyphWidth = glyph[0]?.length ?? 0;

    // Transmit glyph column by column (left to right)
    for (let col = 0; col < glyphWidth; col++) {
      // Double print: send the glyph twice per column (bottom to top each time)
      for (let copy = 0; copy < 2; copy++) {
        for (let row = GLYPH_HEIGHT - 1; row >= 0; row--) {
          const pixelOn = (row < glyph.length) ? glyph[row]![col]! : 0;

          for (let s = 0; s < samplesPerPixel; s++) {
            if (pixelOn) {
              const t = (sampleIndex + s) / sampleRate;
              samples[sampleIndex + s] = Math.sin(angularFreq * t);
            }
          }
          sampleIndex += samplesPerPixel;
        }
      }
    }

    // Inter-character gap (silence)
    for (let col = 0; col < CHAR_GAP_COLUMNS; col++) {
      sampleIndex += COLUMN_HEIGHT * samplesPerPixel;
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
