import type { HellFont } from './font.ts';
import { BAUD_RATE, CHAR_GAP_COLUMNS, DEFAULT_TONE_HZ, PIXEL_HEIGHT, SAMPLE_RATE } from './constants.ts';

export interface EncodeOptions {
  sampleRate?: number;
  toneHz?: number;
}

/**
 * Encode text into Feld-Hell audio samples.
 *
 * Feld-Hell transmits characters as a bitmap, column by column, bottom to top.
 * Each pixel is either tone-on or silence for one pixel duration (1/BAUD_RATE seconds).
 * Each column has PIXEL_HEIGHT pixels scanned from bottom row to top row.
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

  const totalSamples = totalColumns * PIXEL_HEIGHT * samplesPerPixel;
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
      // Each column scanned bottom to top (row height-1 down to row 0)
      for (let row = PIXEL_HEIGHT - 1; row >= 0; row--) {
        const pixelOn = (row < glyph.length) ? glyph[row]![col]! : 0;

        for (let s = 0; s < samplesPerPixel; s++) {
          if (pixelOn) {
            // Generate sine wave tone
            const t = (sampleIndex + s) / sampleRate;
            samples[sampleIndex + s] = Math.sin(angularFreq * t);
          }
          // else: samples already initialized to 0
        }
        sampleIndex += samplesPerPixel;
      }
    }

    // Inter-character gap (silence)
    for (let col = 0; col < CHAR_GAP_COLUMNS; col++) {
      sampleIndex += PIXEL_HEIGHT * samplesPerPixel;
    }
  }

  return samples;
}

/**
 * Get the pixel columns for a text string (without audio generation).
 * Useful for testing and visualization.
 * Returns array of columns, each column is PIXEL_HEIGHT values (top to bottom, 0 or 1).
 */
export function textToPixelColumns(text: string, font: HellFont): number[][] {
  const columns: number[][] = [];

  for (const char of text) {
    const glyph = font.getGlyph(char);
    if (!glyph) continue;

    const glyphWidth = glyph[0]?.length ?? 0;

    for (let col = 0; col < glyphWidth; col++) {
      const column: number[] = [];
      for (let row = 0; row < PIXEL_HEIGHT; row++) {
        column.push((row < glyph.length) ? (glyph[row]![col] ?? 0) : 0);
      }
      columns.push(column);
    }

    // Inter-character gap
    for (let i = 0; i < CHAR_GAP_COLUMNS; i++) {
      columns.push(new Array(PIXEL_HEIGHT).fill(0));
    }
  }

  return columns;
}
