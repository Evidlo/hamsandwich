import { decode, samplesPerColumn, DISPLAY_ROWS, SUB_PIXEL_FACTOR } from '../hell/decoder.ts';
import { AudioCapture } from '../audio/input.ts';

const PIXEL_SIZE = 4;
const RX_PIXEL_HEIGHT = PIXEL_SIZE / SUB_PIXEL_FACTOR;
const PAD = 5;
const CANVAS_WIDTH_COLUMNS = 200;
const LINE_HEIGHT = DISPLAY_ROWS * RX_PIXEL_HEIGHT;
const LINE_GAP = 8;

export class DecodePanel {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private getAudioContext: () => Promise<AudioContext>;
  private capture: AudioCapture | null = null;
  private toneHz: number;
  private contrast: number = 0.5;
  private listening = false;
  private listenButton: HTMLButtonElement;

  /** Buffer of undecoded samples from the mic */
  private sampleBuffer: Float32Array = new Float32Array(0);
  /** Current column position on the active (top) line */
  private columnPos = 0;
  /** Raw energy columns for the active and previous lines (for contrast redraw) */
  private activeData: number[][] = [];
  private prevData: number[][] = [];

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

    const contentWidth = CANVAS_WIDTH_COLUMNS * PIXEL_SIZE;
    const canvasWidth = contentWidth + PAD * 2;
    // Two lines (active + previous) with padding
    const canvasHeight = PAD + LINE_HEIGHT + LINE_GAP + LINE_HEIGHT + PAD;
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

  setContrast(contrast: number): void {
    this.contrast = contrast;
    this.redrawCanvas();
  }

  /** Y offset of the active (top) line */
  private get activeLineY(): number {
    return PAD;
  }

  /** Y offset of the previous (bottom) line */
  private get prevLineY(): number {
    return PAD + LINE_HEIGHT + LINE_GAP;
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
    this.activeData = [];
    this.prevData = [];
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
    // If cursor has reached the end, rotate lines
    if (this.columnPos >= CANVAS_WIDTH_COLUMNS) {
      this.prevData = this.activeData;
      this.activeData = [];
      this.columnPos = 0;
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(PAD, this.prevLineY, CANVAS_WIDTH_COLUMNS * PIXEL_SIZE, LINE_HEIGHT);
      this.ctx.fillRect(PAD, this.activeLineY, CANVAS_WIDTH_COLUMNS * PIXEL_SIZE, LINE_HEIGHT);
      this.renderLine(this.prevData, this.prevLineY);
    }

    this.activeData.push(column);
    this.renderColumn(column, PAD + this.columnPos * PIXEL_SIZE, this.activeLineY);
    this.columnPos++;
    this.drawCursor();
  }

  private renderColumn(column: number[], x: number, lineY: number): void {
    const c = (1 - this.contrast) / this.contrast;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x, lineY, PIXEL_SIZE, LINE_HEIGHT);
    for (let r = 0; r < DISPLAY_ROWS; r++) {
      const raw = Math.min(Math.max(column[r]!, 0), 1);
      if (raw > 0) {
        const mapped = raw / (raw + c * (1 - raw));
        const g = Math.round(mapped * 255);
        this.ctx.fillStyle = `rgb(0,${g},0)`;
        this.ctx.fillRect(x, lineY + r * RX_PIXEL_HEIGHT, PIXEL_SIZE, RX_PIXEL_HEIGHT);
      }
    }
  }

  private renderLine(data: number[][], lineY: number): void {
    for (let i = 0; i < data.length; i++) {
      this.renderColumn(data[i]!, PAD + i * PIXEL_SIZE, lineY);
    }
  }

  private redrawCanvas(): void {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderLine(this.prevData, this.prevLineY);
    this.renderLine(this.activeData, this.activeLineY);
    this.drawCursor();
  }

  private drawCursor(): void {
    const x = PAD + this.columnPos * PIXEL_SIZE;
    this.ctx.strokeStyle = '#f00';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 0.5, this.activeLineY);
    this.ctx.lineTo(x + 0.5, this.activeLineY + LINE_HEIGHT);
    this.ctx.stroke();
  }
}
