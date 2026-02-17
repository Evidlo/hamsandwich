import { decode, samplesPerColumn } from '../hell/decoder.ts';
import { PIXEL_HEIGHT } from '../hell/constants.ts';
import { AudioCapture } from '../audio/input.ts';

const PIXEL_SIZE = 4;
const PAD = 5;
const CANVAS_WIDTH_COLUMNS = 300;
const LINE_HEIGHT = PIXEL_HEIGHT * PIXEL_SIZE;
const HALF_HEIGHT = Math.ceil(PIXEL_HEIGHT / 2) * PIXEL_SIZE;
/** Height of one triple-view section: bottom-half + complete + top-half */
const SECTION_HEIGHT = HALF_HEIGHT + LINE_HEIGHT + HALF_HEIGHT;
const SECTION_GAP = 8;

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

    const contentWidth = CANVAS_WIDTH_COLUMNS * PIXEL_SIZE;
    const canvasWidth = contentWidth + PAD * 2;
    // Two sections (active + previous) with padding
    const canvasHeight = PAD + SECTION_HEIGHT + SECTION_GAP + SECTION_HEIGHT + PAD;
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

  /** Y offset of the active (top) section */
  private get activeSectionY(): number {
    return PAD;
  }

  /** Y offset of the previous (bottom) section */
  private get prevSectionY(): number {
    return PAD + SECTION_HEIGHT + SECTION_GAP;
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
    // If cursor has reached the end, copy active section to previous and clear active
    if (this.columnPos >= CANVAS_WIDTH_COLUMNS) {
      const activeData = this.ctx.getImageData(
        PAD, this.activeSectionY,
        CANVAS_WIDTH_COLUMNS * PIXEL_SIZE, SECTION_HEIGHT,
      );
      // Clear previous section
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(PAD, this.prevSectionY, CANVAS_WIDTH_COLUMNS * PIXEL_SIZE, SECTION_HEIGHT);
      // Paste active to previous
      this.ctx.putImageData(activeData, PAD, this.prevSectionY);
      // Clear active section
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(PAD, this.activeSectionY, CANVAS_WIDTH_COLUMNS * PIXEL_SIZE, SECTION_HEIGHT);
      this.columnPos = 0;
    }

    const x = PAD + this.columnPos * PIXEL_SIZE;
    const sectionY = this.activeSectionY;

    // Clear this column across the entire active section
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x, sectionY, PIXEL_SIZE, SECTION_HEIGHT);

    // Draw triple view for this column:
    // 1. Bottom half (rows PIXEL_HEIGHT/2 .. PIXEL_HEIGHT-1) at top
    // 2. Complete line (rows 0 .. PIXEL_HEIGHT-1) in middle
    // 3. Top half (rows 0 .. PIXEL_HEIGHT/2-1) at bottom
    const halfRows = Math.ceil(PIXEL_HEIGHT / 2);

    // Bottom-half section (top of triple view)
    const bottomHalfStartRow = PIXEL_HEIGHT - halfRows;
    for (let r = 0; r < halfRows; r++) {
      const energy = column[bottomHalfStartRow + r]!;
      if (energy > 0) {
        const g = Math.round(Math.min(energy, 1) * 255);
        this.ctx.fillStyle = `rgb(0,${g},0)`;
        this.ctx.fillRect(x, sectionY + r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // Complete line (middle of triple view)
    const completeY = sectionY + HALF_HEIGHT;
    for (let r = 0; r < PIXEL_HEIGHT; r++) {
      const energy = column[r]!;
      if (energy > 0) {
        const g = Math.round(Math.min(energy, 1) * 255);
        this.ctx.fillStyle = `rgb(0,${g},0)`;
        this.ctx.fillRect(x, completeY + r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // Top-half section (bottom of triple view)
    const topHalfY = completeY + LINE_HEIGHT;
    for (let r = 0; r < halfRows; r++) {
      const energy = column[r]!;
      if (energy > 0) {
        const g = Math.round(Math.min(energy, 1) * 255);
        this.ctx.fillStyle = `rgb(0,${g},0)`;
        this.ctx.fillRect(x, topHalfY + r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    this.columnPos++;

    // Draw red cursor line at current position across active section
    this.drawCursor();
  }

  private drawCursor(): void {
    const x = PAD + this.columnPos * PIXEL_SIZE;
    this.ctx.strokeStyle = '#f00';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 0.5, this.activeSectionY);
    this.ctx.lineTo(x + 0.5, this.activeSectionY + SECTION_HEIGHT);
    this.ctx.stroke();
  }
}
