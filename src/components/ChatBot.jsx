import React, { useEffect, useMemo, useRef, useState } from "react";
import { streamChat } from "../lib/sse.js";
import Markdown from "../lib/markdown.jsx";
import { useGeminiLive } from "../hooks/useGeminiLive.js";

/*
 * ChatBot — "Ask the atlas" floating drawer (Plate XII).
 *
 * Two modes, toggled from the header:
 *   - text:  POST to /api/chat, Gemini streams markdown answers (SSE).
 *   - voice: WS to /live, Gemini Live speaks and listens in real time.
 */

const TEXT_STARTERS = [
  "Why does Park City UT produce so many olympians?",
  "What's special about Vermont's high-school pipeline?",
  "Which sports does the Sun Belt actually dominate?",
  "How do training-center halos affect medal counts?",
];

const VOICE_STARTERS = [
  "Which state produces the most Olympians per capita?",
  "Why is Park City such a factory town?",
  "How did Colorado's training-center investment pay off?",
  "What does the Paralympic map look like?",
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("text"); // "text" | "voice"

  const live = useGeminiLive();

  // When the drawer closes, stop any live session.
  useEffect(() => {
    if (!open && live.status !== "idle") live.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function switchMode(next) {
    if (next === mode) return;
    if (mode === "voice" && live.status !== "idle") live.stop();
    setMode(next);
  }

  return (
    <>
      {!open && (
        <button
          className="chat-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open Ask the atlas"
        >
          <span className="r">XII</span>
          <span className="s">Ask the atlas</span>
        </button>
      )}

      {open && (
        <div className="chat-drawer" role="dialog" aria-label="Ask the atlas">
          <header className="chat-head">
            <div>
              <p className="eyebrow">Plate XII · Conversation</p>
              <h3>
                Ask the <em>atlas</em>.
              </h3>
            </div>
            <div className="chat-head-actions">
              <button className="close-btn" onClick={() => setOpen(false)}>close</button>
            </div>
          </header>

          <div className="chat-mode-bar" role="tablist" aria-label="Chat mode">
            <button
              role="tab"
              aria-selected={mode === "text"}
              className={`mode-tab ${mode === "text" ? "on" : ""}`}
              onClick={() => switchMode("text")}
            >
              <span className="mt-ic" aria-hidden>✎</span>
              Text
            </button>
            <button
              role="tab"
              aria-selected={mode === "voice"}
              className={`mode-tab ${mode === "voice" ? "on" : ""}`}
              onClick={() => switchMode("voice")}
            >
              <span className="mt-ic" aria-hidden>◉</span>
              Voice
            </button>
          </div>

          {mode === "text" ? <TextChat /> : <VoiceChat live={live} />}
        </div>
      )}
    </>
  );
}

/* ── Text mode ─────────────────────────────────────────────────── */

function TextChat() {
  const [messages, setMessages] = useState([]); // {role, text, sources?, pending?, error?}
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    const id = setTimeout(() => taRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, []);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg = { role: "user", text: trimmed };
    const placeholder = { role: "model", text: "", sources: [], pending: true };
    const newHistory = [...messages, userMsg];
    setMessages([...newHistory, placeholder]);
    setInput("");
    setSending(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      let acc = "";
      let sources = [];
      for await (const evt of streamChat({
        messages: newHistory.map((m) => ({ role: m.role, text: m.text })),
        signal: ctrl.signal,
      })) {
        if (evt.type === "text") {
          acc += evt.delta;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "model", text: acc, sources, pending: true };
            return next;
          });
        } else if (evt.type === "sources") {
          sources = evt.sources || [];
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "model", text: acc, sources, pending: true };
            return next;
          });
        } else if (evt.type === "done") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "model", text: acc, sources, pending: false };
            return next;
          });
          break;
        } else if (evt.type === "error") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "model",
              text: (acc ? acc + "\n\n" : "") + `*Error: ${evt.message}*`,
              sources,
              pending: false,
              error: true,
            };
            return next;
          });
          break;
        }
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "model",
            text: `*Network error: ${e.message || e}*`,
            sources: [],
            pending: false,
            error: true,
          };
          return next;
        });
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      <div className="chat-body" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-lede">
              Ask anything about the data — small-town factories, training-center
              reach, climate patterns, sport pipelines. The atlas knows the
              numbers; the model can search the web for the rest.
            </p>
            <div className="starters">
              {TEXT_STARTERS.map((s) => (
                <button
                  key={s}
                  className="starter"
                  onClick={() => send(s)}
                  disabled={sending}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Message key={i} m={m} />)
        )}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={taRef}
          rows={2}
          placeholder={sending ? "atlas is thinking…" : "Ask about a state, a sport, a town…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="send-btn">
          {sending ? "…" : "send"}
        </button>
      </form>
    </>
  );
}

/* ── Voice mode ────────────────────────────────────────────────── */

function VoiceChat({ live }) {
  const { status, transcript, micLevel, error, start, stop, sendText } = live;
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, status]);

  const isLive = status === "connected";
  const isBusy = status === "connecting" || status === "ending";

  const pillLabel = useMemo(() => {
    switch (status) {
      case "idle":       return "idle";
      case "connecting": return "connecting…";
      case "connected":  return "live";
      case "ending":     return "ending…";
      default:           return status;
    }
  }, [status]);

  function onClickMic() {
    if (isLive) stop();
    else if (status === "idle") start();
  }

  function onSubmitText(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !isLive) return;
    sendText(t);
    setText("");
  }

  return (
    <>
      <div className="voice-dock">
        <button
          className={`live-mic sm ${isLive ? "on" : ""} ${isBusy ? "busy" : ""}`}
          onClick={onClickMic}
          disabled={isBusy}
          aria-label={isLive ? "End voice session" : "Start voice session"}
        >
          <span
            className="live-mic-ring"
            style={{ transform: `scale(${1 + micLevel * 1.1})` }}
          />
          <span className="live-mic-glyph" aria-hidden>
            {isLive ? "■" : "●"}
          </span>
        </button>
        <div className="voice-dock-meta">
          <span className={`live-pill s-${status}`}>{pillLabel}</span>
          <span className="live-hint">
            {status === "idle" && "Tap the mic and speak"}
            {status === "connecting" && "Opening secure line…"}
            {isLive && "Interrupt any time by talking"}
            {status === "ending" && "Closing the line…"}
          </span>
        </div>
      </div>

      {error && (
        <p className="live-error drawer">
          <b>Error</b> · {error}
        </p>
      )}

      <div className="chat-body" ref={scrollRef}>
        {transcript.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-lede">
              A voice line to the atlas — powered by Gemini Live. Tap the
              microphone, speak in plain English, and Gemini answers out
              loud. The transcript appears here as you go.
            </p>
            <div className="starters">
              {VOICE_STARTERS.map((s) => (
                <button
                  key={s}
                  className="starter"
                  onClick={() => (isLive ? sendText(s) : null)}
                  disabled={!isLive}
                  title={isLive ? "Send as text" : "Start the session first"}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          transcript.map((m, i) => <Message key={i} m={m} />)
        )}
      </div>

      <form className="chat-input" onSubmit={onSubmitText}>
        <textarea
          rows={2}
          placeholder={isLive ? "…or type instead of speaking" : "Start the session to type or speak"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) onSubmitText(e);
          }}
          disabled={!isLive}
        />
        <button type="submit" className="send-btn" disabled={!isLive || !text.trim()}>
          send
        </button>
      </form>
    </>
  );
}

/* ── Shared message bubble ─────────────────────────────────────── */

function Message({ m }) {
  const isUser = m.role === "user";
  return (
    <div className={`chat-msg ${isUser ? "u" : "a"} ${m.error ? "err" : ""}`}>
      {isUser ? (
        <div className="bubble">{m.text}</div>
      ) : (
        <div className="bubble">
          {m.text ? (
            <Markdown text={m.text} />
          ) : (
            <span className="thinking">
              <span /><span /><span />
            </span>
          )}
          {m.sources && m.sources.length > 0 && (
            <div className="srcs">
              <div className="srcs-h">Sources</div>
              <ol>
                {m.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.uri} target="_blank" rel="noreferrer">{s.title}</a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
