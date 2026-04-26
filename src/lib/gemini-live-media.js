/*
 * Audio plumbing for the live voice plate.
 *
 * - Capture: getUserMedia → AudioWorklet (pcm-processor.js) → downsample
 *   to 16 kHz → Int16 → onAudioData(bytes).
 * - Playback: queued AudioBufferSources at 24 kHz, with barge-in support
 *   (stopAudioPlayback cancels anything still scheduled).
 */

export class GeminiLiveMedia {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.analyserNode = null;
    this.isRecording = false;
    this.nextStartTime = 0;
    this.scheduledSources = [];
  }

  async initializeAudio() {
    if (!this.audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new Ctor();
      await this.audioContext.audioWorklet.addModule("/pcm-processor.js");
    }
    // teardown() may have nulled audioContext while the await was pending
    if (!this.audioContext) return;
    if (this.audioContext.state === "suspended") await this.audioContext.resume();
  }

  async startAudio(onAudioData) {
    await this.initializeAudio();
    if (!this.audioContext) return;
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!this.audioContext) {
      // torn down during permission prompt
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
      return;
    }
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-processor");
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 512;

    this.workletNode.port.onmessage = (event) => {
      if (!this.isRecording) return;
      const down = this.#downsample(event.data, this.audioContext.sampleRate, 16000);
      onAudioData(this.#floatToInt16(down));
    };

    source.connect(this.workletNode);
    source.connect(this.analyserNode);
    // Route through a muted gain so the worklet actually pulls data.
    const mute = this.audioContext.createGain();
    mute.gain.value = 0;
    this.workletNode.connect(mute);
    mute.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  /** 0..1 RMS level from the mic analyser — cheap meter for a UI pulse. */
  micLevel() {
    if (!this.analyserNode) return 0;
    const buf = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  stopAudio() {
    this.isRecording = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch {}
      this.workletNode = null;
    }
    this.analyserNode = null;
  }

  playAudio(arrayBuffer) {
    if (!this.audioContext) return;
    if (this.audioContext.state === "suspended") this.audioContext.resume();

    const pcm = new Int16Array(arrayBuffer);
    const f32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 32768;

    const buf = this.audioContext.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);

    const src = this.audioContext.createBufferSource();
    src.buffer = buf;
    src.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    this.nextStartTime = Math.max(now, this.nextStartTime);
    src.start(this.nextStartTime);
    this.nextStartTime += buf.duration;

    this.scheduledSources.push(src);
    src.onended = () => {
      const i = this.scheduledSources.indexOf(src);
      if (i > -1) this.scheduledSources.splice(i, 1);
    };
  }

  stopAudioPlayback() {
    this.scheduledSources.forEach((s) => { try { s.stop(); } catch {} });
    this.scheduledSources = [];
    if (this.audioContext) this.nextStartTime = this.audioContext.currentTime;
  }

  async teardown() {
    this.stopAudio();
    this.stopAudioPlayback();
    if (this.audioContext) {
      try { await this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
  }

  #downsample(buffer, inRate, outRate) {
    if (outRate === inRate) return buffer;
    const ratio = inRate / outRate;
    const outLen = Math.round(buffer.length / ratio);
    const result = new Float32Array(outLen);
    let o = 0, b = 0;
    while (o < result.length) {
      const nextB = Math.round((o + 1) * ratio);
      let sum = 0, n = 0;
      for (let i = b; i < nextB && i < buffer.length; i++) { sum += buffer[i]; n++; }
      result[o++] = sum / (n || 1);
      b = nextB;
    }
    return result;
  }

  #floatToInt16(buffer) {
    const out = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      out[i] = Math.max(-1, Math.min(1, buffer[i])) * 0x7fff;
    }
    return out.buffer;
  }
}
