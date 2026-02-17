# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ham Sandwich is a collection of web-based modems for Ham radio. The modems use the browser's Web Audio API (speakers/mic) to encode/decode over common digital modes. Currently implements Feld-Hell (Hellschreiber).

**Static site only** — no Node.js in the app. Vite/TypeScript/Vitest are dev-only tools.

## Commands

- `npm run dev` — start Vite dev server (0.0.0.0:8009)
- `npm run build` — TypeScript check + Vite production build (outputs to `dist/`)
- `npm run test` — run all tests (Vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run deploy` — build + push `dist/` contents to root of `deploy` branch
- `npx tsc --noEmit` — type check only

## Architecture

```
src/
  hell/           — Feld-Hell modem core (pure logic, no DOM/audio deps)
    constants.ts  — Baud rate (122.5), sample rate, tone freq, pixel dimensions
    font.ts       — HellFont interface + BUILTIN_FONT (hardcoded 7-row bitmap glyphs)
    encoder.ts    — Text → Float32Array audio samples (also textToPixelColumns for testing)
    decoder.ts    — Float32Array → pixel columns (Goertzel energy detection + threshold)
  audio/          — Web Audio API wrappers
    output.ts     — AudioPlayer: plays Float32Array via AudioBufferSourceNode
    input.ts      — AudioCapture: mic input via AudioWorklet (ScriptProcessor fallback)
  ui/             — Vanilla TS UI classes (no framework), styled with Oat CSS
    app.ts        — Main app: creates shared AudioContext, wires panels + settings
    encode-panel.ts — Text input + Send button + TX preview canvas
    decode-panel.ts — Scrolling RX canvas (pixel strip display)
    settings.ts   — Tone frequency slider
  main.ts         — Entry point
tests/hell/       — Vitest tests for encoder, decoder, and encode→decode round-trip
```

## Key Design Decisions

- **HellFont interface** (`font.ts`): abstraction over glyph data so a BDF font parser can be swapped in later. Current implementation is a hardcoded `Record<string, number[][]>`.
- **Feld-Hell encoding**: columns transmitted left→right, pixels scanned bottom→top within each column. Each pixel is tone-on or silence for 1/122.5 seconds.
- **Decoder** uses Goertzel algorithm (DFT at single frequency) per pixel window for narrowband detection.
- **Full duplex**: single shared AudioContext for simultaneous encode (speaker) and decode (mic).
- **Visual decode only**: no OCR — receiver shows a scrolling pixel strip the operator reads visually.
- [Oat](https://oat.ink/components/) for UI styling (CSS/JS loaded from CDN in index.html).

## Future Plans

- BDF font upload/parsing (behind existing HellFont interface)
- Additional digital modes beyond Feld-Hell
- Send/receive waterfall displays
- Modular GUI with shared components across modes (e.g. sound card config)
