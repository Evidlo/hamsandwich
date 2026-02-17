/**
 * Captures audio from the microphone and delivers chunks to a callback.
 */
export class AudioCapture {
  private context: AudioContext;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Start capturing audio from the microphone.
   * Calls onChunk with Float32Array buffers of audio data.
   */
  async start(onChunk: (samples: Float32Array) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.sourceNode = this.context.createMediaStreamSource(this.stream);

    // Try AudioWorklet first, fall back to ScriptProcessorNode
    if (this.context.audioWorklet) {
      try {
        await this.startWithWorklet(onChunk);
        return;
      } catch {
        // Fall through to ScriptProcessor
      }
    }

    this.startWithScriptProcessor(onChunk);
  }

  private async startWithWorklet(onChunk: (samples: Float32Array) => void): Promise<void> {
    // Create an inline AudioWorklet processor via Blob URL
    const processorCode = `
      class ChunkProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input[0] && input[0].length > 0) {
            this.port.postMessage(input[0]);
          }
          return true;
        }
      }
      registerProcessor('chunk-processor', ChunkProcessor);
    `;
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    await this.context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    this.workletNode = new AudioWorkletNode(this.context, 'chunk-processor');
    this.workletNode.port.onmessage = (event: MessageEvent) => {
      onChunk(event.data as Float32Array);
    };
    this.sourceNode!.connect(this.workletNode);
    this.workletNode.connect(this.context.destination);
  }

  private startWithScriptProcessor(onChunk: (samples: Float32Array) => void): void {
    const bufferSize = 4096;
    this.processorNode = this.context.createScriptProcessor(bufferSize, 1, 1);
    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      const data = event.inputBuffer.getChannelData(0);
      onChunk(new Float32Array(data));
    };
    this.sourceNode!.connect(this.processorNode);
    this.processorNode.connect(this.context.destination);
  }

  stop(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
}
