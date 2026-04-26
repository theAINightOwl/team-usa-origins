// Thin wrapper around @google/genai's Live API session.
// Ported from gemini_live_toy_ts/gemini-live.mts.

import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

export type ToolFn = (args: any) => unknown | Promise<unknown>;

export interface GeminiLiveOpts {
  apiKey: string;
  model: string;
  voice?: string;
  systemInstruction: string;
  tools: any[];
  toolMapping?: Record<string, ToolFn>;
  onAudio: (bytes: Buffer) => void;
  onEvent: (event: Record<string, unknown>) => void;
}

export class GeminiLive {
  private session?: Session;

  constructor(private opts: GeminiLiveOpts) {}

  async start(): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: this.opts.apiKey });
    this.session = await ai.live.connect({
      model: this.opts.model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: this.opts.voice ?? "Puck" },
          },
        },
        systemInstruction: { parts: [{ text: this.opts.systemInstruction }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: this.opts.tools,
      },
      callbacks: {
        onopen: () => {},
        onmessage: (m: LiveServerMessage) => {
          this.handle(m).catch((e) =>
            this.opts.onEvent({ type: "error", error: String(e) }),
          );
        },
        onerror: (e: ErrorEvent) =>
          this.opts.onEvent({ type: "error", error: e.message }),
        onclose: () => this.opts.onEvent({ type: "closed" }),
      },
    });
  }

  sendAudio(pcm: Buffer): void {
    this.session?.sendRealtimeInput({
      audio: {
        data: pcm.toString("base64"),
        mimeType: "audio/pcm;rate=16000",
      },
    });
  }

  sendText(text: string): void {
    this.session?.sendRealtimeInput({ text });
  }

  close(): void {
    this.session?.close();
  }

  private async handle(m: LiveServerMessage): Promise<void> {
    const sc = m.serverContent;
    if (sc?.modelTurn?.parts) {
      for (const p of sc.modelTurn.parts) {
        if (p.inlineData?.data) {
          this.opts.onAudio(Buffer.from(p.inlineData.data, "base64"));
        }
      }
    }
    if (sc?.inputTranscription?.text) {
      this.opts.onEvent({ type: "user", text: sc.inputTranscription.text });
    }
    if (sc?.outputTranscription?.text) {
      this.opts.onEvent({ type: "gemini", text: sc.outputTranscription.text });
    }
    if (sc?.turnComplete) this.opts.onEvent({ type: "turn_complete" });
    if (sc?.interrupted) this.opts.onEvent({ type: "interrupted" });

    if (m.toolCall?.functionCalls) {
      const responses: any[] = [];
      for (const fc of m.toolCall.functionCalls) {
        const fn = this.opts.toolMapping?.[fc.name!];
        let result: unknown;
        try {
          result = fn ? await fn(fc.args ?? {}) : `Error: unknown tool ${fc.name}`;
        } catch (e: any) {
          result = `Error: ${e.message ?? e}`;
        }
        responses.push({ name: fc.name, id: fc.id, response: { result } });
        this.opts.onEvent({
          type: "tool_call",
          name: fc.name,
          args: fc.args ?? {},
          result,
        });
      }
      this.session?.sendToolResponse({ functionResponses: responses });
    }
  }
}
