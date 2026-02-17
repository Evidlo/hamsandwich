/** Feld-Hell baud rate: 122.5 pixels per second */
export const BAUD_RATE = 122.5;

/** Default audio sample rate */
export const SAMPLE_RATE = 48000;

/** Default tone frequency in Hz */
export const DEFAULT_TONE_HZ = 980;

/** Pixel height of each character column */
export const PIXEL_HEIGHT = 7;

/** Number of audio samples per pixel */
export const SAMPLES_PER_PIXEL = Math.round(SAMPLE_RATE / BAUD_RATE);

/** Inter-character gap in columns */
export const CHAR_GAP_COLUMNS = 1;
