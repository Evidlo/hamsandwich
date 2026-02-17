/**
 * Plays encoded Feld-Hell audio samples through speakers.
 */
export class AudioPlayer {
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Play audio samples. Returns a promise that resolves when playback completes.
   */
  play(samples: Float32Array): Promise<void> {
    const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  }
}
