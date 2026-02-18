import { DEFAULT_TONE_HZ } from '../hell/constants.ts';

export class Settings {
  private container: HTMLElement;
  private toneInput: HTMLInputElement;
  private toneLabel: HTMLSpanElement;
  private contrastInput: HTMLInputElement;
  private _toneHz: number = DEFAULT_TONE_HZ;
  private _contrast: number = 0.5;
  private toneListeners: ((toneHz: number) => void)[] = [];
  private contrastListeners: ((contrast: number) => void)[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement('section');
    this.container.innerHTML = `
      <h2>Settings</h2>
      <label>
        Tone Frequency:
        <input type="range" min="400" max="2000" step="10" value="${DEFAULT_TONE_HZ}" />
        <span>${DEFAULT_TONE_HZ} Hz</span>
      </label>
      <label>
        Contrast:
        <input type="range" min="0" max="100" step="1" value="50" data-contrast />
      </label>
    `;

    this.toneInput = this.container.querySelector('input[type="range"]:not([data-contrast])')!;
    this.toneLabel = this.container.querySelector('span')!;
    this.contrastInput = this.container.querySelector('input[data-contrast]')!;

    this.toneInput.addEventListener('input', () => {
      this._toneHz = Number(this.toneInput.value);
      this.toneLabel.textContent = `${this._toneHz} Hz`;
      for (const listener of this.toneListeners) listener(this._toneHz);
    });

    this.contrastInput.addEventListener('input', () => {
      this._contrast = Number(this.contrastInput.value) / 100;
      for (const listener of this.contrastListeners) listener(this._contrast);
    });

    parent.appendChild(this.container);
  }

  get toneHz(): number {
    return this._toneHz;
  }

  get contrast(): number {
    return this._contrast;
  }

  onToneChange(listener: (toneHz: number) => void): void {
    this.toneListeners.push(listener);
  }

  onContrastChange(listener: (contrast: number) => void): void {
    this.contrastListeners.push(listener);
  }
}
