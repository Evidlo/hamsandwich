import { encode, textToPixelColumns } from '../hell/encoder.ts';
import { BUILTIN_FONT } from '../hell/font.ts';
import { BAUD_RATE, PIXEL_HEIGHT } from '../hell/constants.ts';
import { AudioPlayer } from '../audio/output.ts';

const PIXEL_SIZE = 4;

export class EncodePanel {
  private container: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private getAudioContext: () => Promise<AudioContext>;
  private toneHz: number;
  private sending = false;
  private cursorAnimId: number | null = null;

  constructor(parent: HTMLElement, getAudioContext: () => Promise<AudioContext>, toneHz: number) {
    this.toneHz = toneHz;
    this.getAudioContext = getAudioContext;

    this.container = document.createElement('section');
    this.container.innerHTML = `
      <h2>Transmit</h2>
      <textarea rows="3" placeholder="Type message to send..."></textarea>
      <div style="margin-top: 0.5rem;">
        <button>Send</button>
      </div>
      <h3>TX Preview</h3>
      <canvas></canvas>
    `;

    this.textarea = this.container.querySelector('textarea')!;
    this.sendButton = this.container.querySelector('button')!;
    this.canvas = this.container.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;

    this.sendButton.addEventListener('click', () => this.send());
    parent.appendChild(this.container);
  }

  setToneHz(hz: number): void {
    this.toneHz = hz;
  }

  private async send(): Promise<void> {
    if (this.sending) return;
    const text = this.textarea.value.trim();
    if (!text) return;

    this.sending = true;
    this.sendButton.disabled = true;
    this.sendButton.textContent = 'Sending...';

    const columns = textToPixelColumns(text, BUILTIN_FONT);
    this.renderColumns(columns);

    // Start cursor animation
    const totalColumns = columns.length;
    const secondsPerColumn = PIXEL_HEIGHT / BAUD_RATE;
    const totalDuration = totalColumns * secondsPerColumn;
    const startTime = performance.now();

    const animateCursor = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / totalDuration, 1);
      const cursorCol = Math.floor(progress * totalColumns);

      this.renderColumns(columns);
      this.drawCursor(cursorCol);

      if (progress < 1) {
        this.cursorAnimId = requestAnimationFrame(animateCursor);
      } else {
        this.cursorAnimId = null;
      }
    };
    this.cursorAnimId = requestAnimationFrame(animateCursor);

    const ctx = await this.getAudioContext();
    const player = new AudioPlayer(ctx);
    const samples = encode(text, BUILTIN_FONT, { toneHz: this.toneHz });
    try {
      await player.play(samples);
    } finally {
      if (this.cursorAnimId !== null) {
        cancelAnimationFrame(this.cursorAnimId);
        this.cursorAnimId = null;
      }
      this.renderColumns(columns);
      this.sending = false;
      this.sendButton.disabled = false;
      this.sendButton.textContent = 'Send';
    }
  }

  private renderColumns(columns: number[][]): void {
    const width = columns.length * PIXEL_SIZE;
    const height = PIXEL_HEIGHT * PIXEL_SIZE;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.fillStyle = '#0f0';
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c]!;
      for (let r = 0; r < PIXEL_HEIGHT; r++) {
        if (col[r]) {
          this.ctx.fillRect(c * PIXEL_SIZE, r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }
      }
    }
  }

  private drawCursor(columnIndex: number): void {
    const x = columnIndex * PIXEL_SIZE;
    this.ctx.strokeStyle = '#f00';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 0.5, 0);
    this.ctx.lineTo(x + 0.5, this.canvas.height);
    this.ctx.stroke();
  }
}
