import { DEFAULT_TONE_HZ } from '../hell/constants.ts';

export class Settings {
  private container: HTMLElement;
  private toneInput: HTMLInputElement;
  private toneLabel: HTMLSpanElement;
  private _toneHz: number = DEFAULT_TONE_HZ;
  private listeners: ((toneHz: number) => void)[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement('section');
    this.container.innerHTML = `
      <h2>Settings</h2>
      <label>
        Tone Frequency:
        <input type="range" min="400" max="2000" step="10" value="${DEFAULT_TONE_HZ}" />
        <span>${DEFAULT_TONE_HZ} Hz</span>
      </label>
    `;

    this.toneInput = this.container.querySelector('input[type="range"]')!;
    this.toneLabel = this.container.querySelector('span')!;

    this.toneInput.addEventListener('input', () => {
      this._toneHz = Number(this.toneInput.value);
      this.toneLabel.textContent = `${this._toneHz} Hz`;
      for (const listener of this.listeners) {
        listener(this._toneHz);
      }
    });

    parent.appendChild(this.container);
  }

  get toneHz(): number {
    return this._toneHz;
  }

  onToneChange(listener: (toneHz: number) => void): void {
    this.listeners.push(listener);
  }
}
