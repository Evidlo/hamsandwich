import { BAUD_RATE, DEFAULT_TONE_HZ, PIXEL_HEIGHT, SAMPLE_RATE } from './constants.ts';

export interface DecodeOptions {
  sampleRate?: number;
  toneHz?: number;
}

/**
 * Decode Feld-Hell audio samples into pixel columns with analog energy values.
 *
 * Pipeline: Goertzel energy detection per pixel window → arrange into columns.
 * Each returned column is PIXEL_HEIGHT values (top to bottom).
 * Values are normalized energy levels (0.0 = silence, higher = more energy at tone freq).
 * Values are NOT thresholded — the display layer decides how to render them.
 */
export function decode(samples: Float32Array, opts: DecodeOptions = {}): number[][] {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const toneHz = opts.toneHz ?? DEFAULT_TONE_HZ;
  const samplesPerPixel = Math.round(sampleRate / BAUD_RATE);

  // Goertzel energy detection per pixel window
  const totalPixels = Math.floor(samples.length / samplesPerPixel);
  const energies = new Float32Array(totalPixels);

  const angularFreq = 2 * Math.PI * toneHz / sampleRate;

  for (let p = 0; p < totalPixels; p++) {
    const start = p * samplesPerPixel;
    let sinSum = 0;
    let cosSum = 0;

    for (let s = 0; s < samplesPerPixel; s++) {
      const sample = samples[start + s]!;
      const angle = angularFreq * s;
      sinSum += sample * Math.sin(angle);
      cosSum += sample * Math.cos(angle);
    }

    // Normalized energy (magnitude of DFT bin at tone frequency)
    energies[p] = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / (samplesPerPixel / 2);
  }

  // Arrange into pixel columns (transmitted bottom to top, stored top to bottom)
  const totalColumns = Math.floor(totalPixels / PIXEL_HEIGHT);
  const columns: number[][] = [];

  for (let col = 0; col < totalColumns; col++) {
    const column: number[] = new Array(PIXEL_HEIGHT);
    for (let pixel = 0; pixel < PIXEL_HEIGHT; pixel++) {
      const energyIndex = col * PIXEL_HEIGHT + pixel;
      // pixel 0 in transmission = bottom row = row (PIXEL_HEIGHT-1) in display
      column[PIXEL_HEIGHT - 1 - pixel] = energies[energyIndex]!;
    }
    columns.push(column);
  }

  return columns;
}
