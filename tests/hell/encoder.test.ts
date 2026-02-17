import { describe, it, expect } from 'vitest';
import { encode, textToPixelColumns } from '../../src/hell/encoder.ts';
import { BUILTIN_FONT } from '../../src/hell/font.ts';
import { COLUMN_HEIGHT, GLYPH_HEIGHT, CHAR_GAP_COLUMNS } from '../../src/hell/constants.ts';

describe('textToPixelColumns', () => {
  it('produces correct column count for a single character', () => {
    const columns = textToPixelColumns('A', BUILTIN_FONT);
    const glyph = BUILTIN_FONT.getGlyph('A')!;
    const expectedCols = glyph[0]!.length + CHAR_GAP_COLUMNS;
    expect(columns.length).toBe(expectedCols);
  });

  it('produces columns with correct height (double print)', () => {
    const columns = textToPixelColumns('H', BUILTIN_FONT);
    for (const col of columns) {
      expect(col.length).toBe(COLUMN_HEIGHT);
    }
  });

  it('maps lowercase to uppercase', () => {
    const upper = textToPixelColumns('A', BUILTIN_FONT);
    const lower = textToPixelColumns('a', BUILTIN_FONT);
    expect(lower).toEqual(upper);
  });

  it('skips unknown characters', () => {
    const columns = textToPixelColumns('~', BUILTIN_FONT);
    expect(columns.length).toBe(0);
  });

  it('returns empty for empty string', () => {
    const columns = textToPixelColumns('', BUILTIN_FONT);
    expect(columns.length).toBe(0);
  });

  it('pixel columns contain the glyph data twice (double print)', () => {
    const glyph = BUILTIN_FONT.getGlyph('T')!;
    const columns = textToPixelColumns('T', BUILTIN_FONT);

    // Check glyph columns (excluding the gap)
    for (let col = 0; col < glyph[0]!.length; col++) {
      // First copy (rows 0-6)
      for (let row = 0; row < GLYPH_HEIGHT; row++) {
        expect(columns[col]![row]).toBe(glyph[row]![col]);
      }
      // Second copy (rows 7-13)
      for (let row = 0; row < GLYPH_HEIGHT; row++) {
        expect(columns[col]![GLYPH_HEIGHT + row]).toBe(glyph[row]![col]);
      }
    }
  });
});

describe('encode', () => {
  it('produces audio samples', () => {
    const samples = encode('A', BUILTIN_FONT);
    expect(samples.length).toBeGreaterThan(0);
  });

  it('produces silence for space character', () => {
    const samples = encode(' ', BUILTIN_FONT);
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i]).toBe(0);
    }
  });

  it('produces non-zero samples for characters with pixels on', () => {
    const samples = encode('H', BUILTIN_FONT);
    const hasNonZero = samples.some(s => s !== 0);
    expect(hasNonZero).toBe(true);
  });

  it('sample values are in [-1, 1] range', () => {
    const samples = encode('HELLO', BUILTIN_FONT);
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(-1);
      expect(samples[i]).toBeLessThanOrEqual(1);
    }
  });
});
