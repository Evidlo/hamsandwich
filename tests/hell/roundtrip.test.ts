import { describe, it, expect } from 'vitest';
import { encode, textToPixelColumns } from '../../src/hell/encoder.ts';
import { decode } from '../../src/hell/decoder.ts';
import { BUILTIN_FONT } from '../../src/hell/font.ts';
import { CHAR_GAP_COLUMNS } from '../../src/hell/constants.ts';

/** Threshold analog energy columns to binary for comparison with font data */
function toBinary(columns: number[][], t = 0.3): number[][] {
  return columns.map(col => col.map(v => v > t ? 1 : 0));
}

describe('encode → decode round-trip', () => {
  it('round-trips a single character', () => {
    const text = 'A';
    const expectedColumns = textToPixelColumns(text, BUILTIN_FONT);
    const samples = encode(text, BUILTIN_FONT);
    const decodedColumns = toBinary(decode(samples));

    expect(decodedColumns.length).toBe(expectedColumns.length);
    for (let i = 0; i < expectedColumns.length; i++) {
      expect(decodedColumns[i]).toEqual(expectedColumns[i]);
    }
  });

  it('round-trips a multi-character string', () => {
    const text = 'HI';
    const expectedColumns = textToPixelColumns(text, BUILTIN_FONT);
    const samples = encode(text, BUILTIN_FONT);
    const decodedColumns = toBinary(decode(samples));

    expect(decodedColumns.length).toBe(expectedColumns.length);
    for (let i = 0; i < expectedColumns.length; i++) {
      expect(decodedColumns[i]).toEqual(expectedColumns[i]);
    }
  });

  it('round-trips all uppercase letters', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const expectedColumns = textToPixelColumns(text, BUILTIN_FONT);
    const samples = encode(text, BUILTIN_FONT);
    const decodedColumns = toBinary(decode(samples));

    expect(decodedColumns.length).toBe(expectedColumns.length);
    for (let i = 0; i < expectedColumns.length; i++) {
      expect(decodedColumns[i]).toEqual(expectedColumns[i]);
    }
  });

  it('round-trips digits', () => {
    const text = '0123456789';
    const expectedColumns = textToPixelColumns(text, BUILTIN_FONT);
    const samples = encode(text, BUILTIN_FONT);
    const decodedColumns = toBinary(decode(samples));

    expect(decodedColumns.length).toBe(expectedColumns.length);
    for (let i = 0; i < expectedColumns.length; i++) {
      expect(decodedColumns[i]).toEqual(expectedColumns[i]);
    }
  });

  it('round-trips with a non-default tone frequency', () => {
    const text = 'CQ';
    const opts = { toneHz: 1200 };
    const expectedColumns = textToPixelColumns(text, BUILTIN_FONT);
    const samples = encode(text, BUILTIN_FONT, opts);
    const decodedColumns = toBinary(decode(samples, opts));

    expect(decodedColumns.length).toBe(expectedColumns.length);
    for (let i = 0; i < expectedColumns.length; i++) {
      expect(decodedColumns[i]).toEqual(expectedColumns[i]);
    }
  });

  it('preserves inter-character gaps as blank columns', () => {
    const text = 'AB';
    const decodedColumns = decode(encode(text, BUILTIN_FONT));

    // Find the gap columns between A and B
    const glyphA = BUILTIN_FONT.getGlyph('A')!;
    const gapStart = glyphA[0]!.length;
    for (let g = 0; g < CHAR_GAP_COLUMNS; g++) {
      const col = decodedColumns[gapStart + g]!;
      // All energy values should be near zero in gap columns
      expect(col.every(v => v < 0.01)).toBe(true);
    }
  });
});
