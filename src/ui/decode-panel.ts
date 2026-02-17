import { decode, samplesPerColumn } from '../hell/decoder.ts';
import { PIXEL_HEIGHT } from '../hell/constants.ts';
import { AudioCapture } from '../audio/input.ts';

const PIXEL_SIZE = 4;
const CANVAS_WIDTH_COLUMNS = 300;
const LINE_HEIGHT = PIXEL_HEIGHT * PIXEL_SIZE;
const LINE_GAP = 4;

export class DecodePanel {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private getAudioContext: () => Promise<AudioContext>;
  private capture: AudioCapture | null = null;
  private toneHz: number;
  private listening = false;
  private listenButton: HTMLButtonElement;

  /** Buffer of undecoded samples from the mic */
  private sampleBuffer: Float32Array = new Float32Array(0);
  /** Current column position on the active (top) line */
  private columnPos = 0;

  constructor(parent: HTMLElement, getAudioContext: () => Promise<AudioContext>, toneHz: number) {
    this.toneHz = toneHz;
    this.getAudioContext = getAudioContext;

    this.container = document.createElement('section');
    this.container.innerHTML = `
      <h2>Receive</h2>
      <div style="margin-bottom: 0.5rem;">
        <button>Start Listening</button>
      </div>
      <canvas></canvas>
    `;

    this.listenButton = this.container.querySelector('button')!;
    this.canvas = this.container.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;

    const canvasWidth = CANVAS_WIDTH_COLUMNS * PIXEL_SIZE;
    const canvasHeight = LINE_HEIGHT * 2 + LINE_GAP;
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    this.canvas.style.background = '#000';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.listenButton.disabled = true;
      this.listenButton.textContent = 'Mic unavailable (requires HTTPS)';
    } else {
      this.listenButton.addEventListener('click', () => this.toggle());
    }

    parent.appendChild(this.container);
  }

  setToneHz(hz: number): void {
    this.toneHz = hz;
  }

  private async toggle(): Promise<void> {
    if (this.listening) {
      this.stop();
    } else {
      await this.startListening();
    }
  }

  private async startListening(): Promise<void> {
    this.listening = true;
    this.listenButton.textContent = 'Stop Listening';
    this.sampleBuffer = new Float32Array(0);
    this.columnPos = 0;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const ctx = await this.getAudioContext();
    this.capture = new AudioCapture(ctx);
    await this.capture.start((chunk) => this.onAudioChunk(chunk));
  }

  private stop(): void {
    this.listening = false;
    this.listenButton.textContent = 'Start Listening';
    this.capture?.stop();
    this.capture = null;
  }

  private onAudioChunk(chunk: Float32Array): void {
    // Append to sample buffer
    const newBuffer = new Float32Array(this.sampleBuffer.length + chunk.length);
    newBuffer.set(this.sampleBuffer);
    newBuffer.set(chunk, this.sampleBuffer.length);
    this.sampleBuffer = newBuffer;

    // Decode whatever complete columns we can
    const opts = { toneHz: this.toneHz };
    const columns = decode(this.sampleBuffer, opts);
    if (columns.length === 0) return;

    // Remove decoded samples from buffer
    this.sampleBuffer = this.sampleBuffer.slice(columns.length * samplesPerColumn(opts));

    // Draw new columns
    for (const col of columns) {
      this.drawColumn(col);
    }
  }

  private drawColumn(column: number[]): void {
    // If cursor has reached the end, copy top line to bottom and clear top
    if (this.columnPos >= CANVAS_WIDTH_COLUMNS) {
      const topLineData = this.ctx.getImageData(0, 0, this.canvas.width, LINE_HEIGHT);
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.putImageData(topLineData, 0, LINE_HEIGHT + LINE_GAP);
      this.columnPos = 0;
    }

    const x = this.columnPos * PIXEL_SIZE;

    // Clear this column on top line
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x, 0, PIXEL_SIZE, LINE_HEIGHT);

    // Draw pixels with analog intensity
    for (let r = 0; r < PIXEL_HEIGHT; r++) {
      const energy = column[r]!;
      if (energy > 0) {
        const brightness = Math.min(energy, 1);
        const g = Math.round(brightness * 255);
        this.ctx.fillStyle = `rgb(0,${g},0)`;
        this.ctx.fillRect(x, r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    this.columnPos++;

    // Draw red cursor line at current position
    this.drawCursor();
  }

  private drawCursor(): void {
    const x = this.columnPos * PIXEL_SIZE;
    this.ctx.strokeStyle = '#f00';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 0.5, 0);
    this.ctx.lineTo(x + 0.5, LINE_HEIGHT);
    this.ctx.stroke();
  }
}
