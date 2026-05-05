/*
 * useGeminiLive — React wrapper around GeminiLiveClient + GeminiLiveMedia.
 *
 * Event-driven: callers pass callbacks for voice fragments / chart events
 * and own the messages state themselves. The hook is responsible for the
 * media pipeline + WebSocket lifecycle only.
 *
 * Exposed:
 *   { status, micLevel, error, start(), stop(), sendText(t) }
 *
 * Options (all optional callbacks):
 *   onUserFragment(text)     — partial transcript fragment from the user
 *   onModelFragment(text)    — partial transcript fragment from Gemini
 *   onTurnComplete()         — server signaled end of a turn
 *   onInterrupted()          — user interrupted the model mid-speech
 *   onChart({figures, narration, code}) — voice agent invoked request_chart
 *   onViewPatch(patch)       — voice agent invoked update_atlas; patch is the
 *                              raw tool args (validated client-side by App)
 *   onError(msg)
 *
 * status transitions: idle → connecting → connected → ending → idle
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { GeminiLiveClient } from "../lib/gemini-live-client.js";
import { GeminiLiveMedia } from "../lib/gemini-live-media.js";

export function useGeminiLive(opts = {}) {
  const [status, setStatus] = useState("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState(null);

  const clientRef = useRef(null);
  const mediaRef = useRef(null);
  const rafRef = useRef(null);

  // Refs for callbacks so consumers can pass inline lambdas without
  // re-triggering start().
  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; }, [opts]);

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
    setStatus("connecting");

    const media = new GeminiLiveMedia();
    mediaRef.current = media;

    const client = new GeminiLiveClient({
      onOpen: async () => {
        try {
          await media.startAudio((bytes) => client.send(bytes));
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
          const cb = cbRef.current || {};
          switch (evt.type) {
            case "user":
              cb.onUserFragment?.(evt.text || "");
              break;
            case "gemini":
              cb.onModelFragment?.(evt.text || "");
              break;
            case "turn_complete":
              cb.onTurnComplete?.();
              break;
            case "interrupted":
              media.stopAudioPlayback();
              cb.onInterrupted?.();
              break;
            case "chart":
              try {
                cb.onChart?.({
                  figures: evt.figures || [],
                  narration: evt.narration || "",
                  code: evt.code || "",
                });
              } catch (err) {
                console.warn("[live] onChart handler threw:", err);
              }
              break;
            case "view_patch":
              try {
                cb.onViewPatch?.(evt.patch || {});
              } catch (err) {
                console.warn("[live] onViewPatch handler threw:", err);
              }
              break;
            case "error":
              setError(evt.error || "live error");
              cb.onError?.(evt.error || "live error");
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
        const msg = "WebSocket error — is the live server running on :8765?";
        setError(msg);
        cbRef.current?.onError?.(msg);
      },
    });

    clientRef.current = client;
    client.connect();
  }, [cleanup]);

  const sendText = useCallback((text) => {
    clientRef.current?.sendText(text);
    // Mirror the typed turn through the same fragment pipeline so the consumer
    // can render it identically to spoken turns.
    cbRef.current?.onUserFragment?.(text);
    cbRef.current?.onTurnComplete?.();
  }, []);

  // Tear down on unmount
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { status, micLevel, error, start, stop, sendText };
}
