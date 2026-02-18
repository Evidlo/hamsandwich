import { EncodePanel } from './encode-panel.ts';
import { DecodePanel } from './decode-panel.ts';
import { Settings } from './settings.ts';

/**
 * Lazily creates and resumes an AudioContext on first user gesture.
 * Browsers require AudioContext to be created/resumed after a user interaction.
 */
function createLazyAudioContext(sampleRate: number): () => Promise<AudioContext> {
  let ctx: AudioContext | null = null;
  return async () => {
    if (!ctx) {
      ctx = new AudioContext({ sampleRate });
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  };
}

export class App {
  constructor(root: HTMLElement) {
    root.innerHTML = `
      <h1>Ham Sandwich — Feld-Hell</h1>
      <div id="settings-container"></div>
      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
        <div id="encode-container"></div>
        <div id="decode-container"></div>
      </div>
    `;

    const getAudioContext = createLazyAudioContext(48000);

    const settingsContainer = root.querySelector('#settings-container') as HTMLElement;
    const encodeContainer = root.querySelector('#encode-container') as HTMLElement;
    const decodeContainer = root.querySelector('#decode-container') as HTMLElement;

    const settings = new Settings(settingsContainer);
    const encodePanel = new EncodePanel(encodeContainer, getAudioContext, settings.toneHz);
    const decodePanel = new DecodePanel(decodeContainer, getAudioContext, settings.toneHz);

    // Wire settings changes to panels
    settings.onToneChange((hz) => {
      encodePanel.setToneHz(hz);
      decodePanel.setToneHz(hz);
    });
    settings.onContrastChange((contrast) => {
      decodePanel.setContrast(contrast);
    });
  }
}
