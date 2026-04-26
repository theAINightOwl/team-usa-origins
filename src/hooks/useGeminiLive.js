/*
 * useGeminiLive — React wrapper around GeminiLiveClient + GeminiLiveMedia.
 *
 * Exposes the minimum the UI needs:
 *   { status, transcript, micLevel, error, start(), stop(), sendText(t) }
 *
 * status transitions: idle → connecting → connected → ending → idle
 *                     (any → error on failure; clearable via stop())
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { GeminiLiveClient } from "../lib/gemini-live-client.js";
import { GeminiLiveMedia } from "../lib/gemini-live-media.js";

export function useGeminiLive() {
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState([]); // [{ role: "user"|"model", text, final }]
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState(null);

  const clientRef = useRef(null);
  const mediaRef = useRef(null);
  const rafRef = useRef(null);

  // Append or extend the last turn for a given role. Live transcription
  // streams in fragments — we accumulate until turn_complete, then flush.
  const appendTranscript = useCallback((role, text) => {
    if (!text) return;
    setTranscript((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === role && !last.final) {
        next[next.length - 1] = { ...last, text: last.text + text };
      } else {
        next.push({ role, text, final: false });
      }
      return next;
    });
  }, []);

  const finalizeOpenTurns = useCallback(() => {
    setTranscript((prev) =>
      prev.map((t) => (t.final ? t : { ...t, final: true }))
    );
  }, []);

  const cleanup = useCallback(async () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try { clientRef.current?.disconnect(); } catch {}
    clientRef.current = null;
    try { await mediaRef.current?.teardown(); } catch {}
    mediaRef.current = null;
    setMicLevel(0);
  }, []);

  const stop = useCallback(async () => {
    setStatus("ending");
    await cleanup();
    setStatus("idle");
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setStatus("connecting");

    const media = new GeminiLiveMedia();
    mediaRef.current = media;

    const client = new GeminiLiveClient({
      onOpen: async () => {
        try {
          await media.startAudio((bytes) => client.send(bytes));
          // Bail if server closed / user stopped during startup — avoid
          // flipping status back to "connected" on a dead session.
          if (clientRef.current !== client) return;
          setStatus("connected");

          const tick = () => {
            if (clientRef.current !== client) return;
            setMicLevel(media.micLevel());
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        } catch (e) {
          if (clientRef.current !== client) return;
          setError(e?.message || String(e));
          await cleanup();
          setStatus("idle");
        }
      },
      onMessage: (e) => {
        // Binary = 24kHz PCM audio from Gemini
        if (e.data instanceof ArrayBuffer) {
          media.playAudio(e.data);
          return;
        }
        // JSON events
        try {
          const evt = JSON.parse(e.data);
          switch (evt.type) {
            case "user":
              appendTranscript("user", evt.text);
              break;
            case "gemini":
              appendTranscript("model", evt.text);
              break;
            case "turn_complete":
              finalizeOpenTurns();
              break;
            case "interrupted":
              media.stopAudioPlayback();
              finalizeOpenTurns();
              break;
            case "error":
              setError(evt.error || "live error");
              break;
            default:
              break;
          }
        } catch {
          /* ignore */
        }
      },
      onClose: async () => {
        await cleanup();
        setStatus((s) => (s === "ending" ? "idle" : "idle"));
      },
      onError: () => {
        setError("WebSocket error — is the live server running on :8765?");
      },
    });

    clientRef.current = client;
    client.connect();
  }, [appendTranscript, cleanup, finalizeOpenTurns]);

  const sendText = useCallback((text) => {
    clientRef.current?.sendText(text);
    appendTranscript("user", text);
    finalizeOpenTurns();
  }, [appendTranscript, finalizeOpenTurns]);

  // Ensure we tear down on unmount
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { status, transcript, micLevel, error, start, stop, sendText };
}
