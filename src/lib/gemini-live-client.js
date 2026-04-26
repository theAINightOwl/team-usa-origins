/*
 * Thin WebSocket wrapper around the Python /live endpoint.
 *
 * - Binary frames = raw PCM16 bytes (in: 16kHz mic, out: 24kHz TTS).
 * - Text frames   = JSON events (transcripts, interrupts, errors).
 */

export class GeminiLiveClient {
  constructor({ onOpen, onMessage, onClose, onError } = {}) {
    this.ws = null;
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.onError = onError;
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    // /live is proxied by Vite → ws://127.0.0.1:8765/live
    this.ws = new WebSocket(`${proto}//${location.host}/live`);
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = () => this.onOpen?.();
    this.ws.onmessage = (e) => this.onMessage?.(e);
    this.ws.onclose = (e) => this.onClose?.(e);
    this.ws.onerror = (e) => this.onError?.(e);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
  }

  sendText(text) {
    this.send(JSON.stringify({ text }));
  }

  disconnect() {
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
