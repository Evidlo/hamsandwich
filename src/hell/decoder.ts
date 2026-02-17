import { BAUD_RATE, DEFAULT_TONE_HZ, COLUMN_HEIGHT, SAMPLE_RATE } from './constants.ts';

export interface DecodeOptions {
  sampleRate?: number;
  toneHz?: number;
}

/**
 * Number of energy estimates per hellpixel duration.
 * Higher = finer vertical resolution on the display, but more CPU.
 */
export const SUB_PIXEL_FACTOR = 4;

/**
 * Decode Feld-Hell audio samples into a continuous stream of energy estimates.
 *
 * Returns energy values at sub-pixel resolution. Each value represents the
 * tone energy over a short window (1/SUB_PIXEL_FACTOR of a pixel duration).
 * The caller arranges these into display rows/columns.
 *
 * Returns a Float32Array of energy values (0.0 = silence, ~1.0 = full tone).
 */
export function decodeEnergy(samples: Float32Array, opts: DecodeOptions = {}): Float32Array {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const toneHz = opts.toneHz ?? DEFAULT_TONE_HZ;
  const samplesPerPixel = Math.round(sampleRate / BAUD_RATE);
  const windowSize = Math.round(samplesPerPixel / SUB_PIXEL_FACTOR);

  const totalWindows = Math.floor(samples.length / windowSize);
  const energies = new Float32Array(totalWindows);

  const angularFreq = 2 * Math.PI * toneHz / sampleRate;

  for (let w = 0; w < totalWindows; w++) {
    const start = w * windowSize;
    let sinSum = 0;
    let cosSum = 0;

    for (let s = 0; s < windowSize; s++) {
      const sample = samples[start + s]!;
      const angle = angularFreq * s;
      sinSum += sample * Math.sin(angle);
      cosSum += sample * Math.cos(angle);
    }

    energies[w] = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / (windowSize / 2);
  }

  return energies;
}

/**
 * Number of audio samples consumed to produce the given number of decoded columns.
 */
export function samplesPerColumn(opts: DecodeOptions = {}): number {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const samplesPerPixel = Math.round(sampleRate / BAUD_RATE);
  const windowSize = Math.round(samplesPerPixel / SUB_PIXEL_FACTOR);
  return COLUMN_HEIGHT * SUB_PIXEL_FACTOR * windowSize;
}

/** Number of display rows per decoded column */
export const DISPLAY_ROWS = COLUMN_HEIGHT * SUB_PIXEL_FACTOR;

/**
 * Arrange energy estimates into display columns.
 * Each column is DISPLAY_ROWS values (top to bottom), one per sub-pixel estimate.
 * Transmission order (bottom to top) is remapped to display order (top to bottom).
 */
export function energyToColumns(energies: Float32Array): number[][] {
  const totalColumns = Math.floor(energies.length / DISPLAY_ROWS);
  const columns: number[][] = [];

  for (let col = 0; col < totalColumns; col++) {
    const column: number[] = new Array(DISPLAY_ROWS);
    for (let i = 0; i < DISPLAY_ROWS; i++) {
      // estimate 0 in transmission = bottom row in display
      column[DISPLAY_ROWS - 1 - i] = energies[col * DISPLAY_ROWS + i]!;
    }
    columns.push(column);
  }

  return columns;
}

/**
 * Convenience: decode samples directly into pixel columns.
 * Used by tests and simple consumers.
 */
export function decode(samples: Float32Array, opts: DecodeOptions = {}): number[][] {
  return energyToColumns(decodeEnergy(samples, opts));
}
