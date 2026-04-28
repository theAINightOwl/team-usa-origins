import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { streamChat } from "../lib/sse.js";
import Markdown from "../lib/markdown.jsx";
import { useGeminiLive } from "../hooks/useGeminiLive.js";
import { renderFigure } from "../lib/plotly-render.js";

/*
 * ChatBot — "Ask the atlas" floating drawer (Plate XII).
 *
 * One conversation thread. The user types or speaks; the chat agent decides
 * whether to answer in prose or invoke a `request_chart` tool that fans out
 * to the viz agent. Voice and typed turns flow into the same messages array
 * so follow-ups can reference any prior turn — text, transcript, or figure.
 */

const STARTERS = [
  "Why does Park City UT produce so many olympians?",
  "Bar chart of medals by sport family, highlight the top family in rust.",
  "Which states have the highest paralympic share?",
  "Plot Olympians per 100k by state, top 10.",
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [pendingVoice, setPendingVoice] = useState(null); // { role, text } in-flight voice fragment
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const idCounter = useRef(0);
  const nextId = useCallback(() => `m-${++idCounter.current}`, []);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  // ── Voice hook callbacks — drive the same messages state ────────────
  const commitPending = useCallback(() => {
    setPendingVoice((p) => {
      if (p && p.text.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: p.role,
            kind: "text",
            text: p.text,
            via: "voice",
          },
        ]);
      }
      return null;
    });
  }, [nextId]);

  const liveOpts = useMemo(() => ({
    onUserFragment: (text) => {
      setPendingVoice((p) =>
        p && p.role === "user"
          ? { role: "user", text: p.text + text }
          : (p && p.role === "model" ? (commitPending(), { role: "user", text }) : { role: "user", text })
      );
    },
    onModelFragment: (text) => {
      setPendingVoice((p) =>
        p && p.role === "model"
          ? { role: "model", text: p.text + text }
          : (p && p.role === "user" ? (commitPending(), { role: "model", text }) : { role: "model", text })
      );
    },
    onTurnComplete: commitPending,
    onInterrupted: commitPending,
    onChart: ({ figures, narration, code }) => {
      commitPending();
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "model",
          kind: "chart",
          figures: figures || [],
          narration: narration || "",
          code: code || "",
          via: "voice",
        },
      ]);
    },
  }), [commitPending, nextId]);

  const live = useGeminiLive(liveOpts);

  const isLive = live.status === "connected";
  const isLiveBusy = live.status === "connecting" || live.status === "ending";

  // ── Auto-scroll on new content ─────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingVoice, sending]);

  // ── Focus textarea when drawer opens ───────────────────────────────
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => taRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [open]);

  // When the drawer closes, end any live session.
  useEffect(() => {
    if (!open && live.status !== "idle") live.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Send a typed message ───────────────────────────────────────────
  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // If a voice session is active, route the typed text through the live
    // channel so the agent answers out loud and stays in conversation.
    if (isLive) {
      // The hook mirrors the typed turn through onUserFragment + turn_complete.
      live.sendText(trimmed);
      setInput("");
      return;
    }

    const userMsg = { id: nextId(), role: "user", kind: "text", text: trimmed };
    const modelPlaceholderId = nextId();
    const modelPlaceholder = {
      id: modelPlaceholderId,
      role: "model",
      kind: "text",
      text: "",
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, modelPlaceholder]);
    setInput("");
    setSending(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Build the history sent to the server: every prior text + chart turn,
    // plus this user message. Voice transcript turns participate too — they
    // were committed as kind:text already.
    const history = [...messages, userMsg]
      .filter((m) => m.kind === "text" || m.kind === "chart")
      .map((m) =>
        m.kind === "chart"
          ? { role: "model", text: `[chart rendered] ${m.narration || ""}` }
          : { role: m.role, text: m.text }
      );

    let inFlightId = modelPlaceholderId;
    let acc = "";

    function patch(id, patchObj) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patchObj } : m)));
    }
    function dropEmpty(id) {
      setMessages((prev) => prev.filter((m) => !(m.id === id && (!m.text || !m.text.trim()))));
    }

    try {
      for await (const evt of streamChat({ messages: history, signal: ctrl.signal })) {
        if (evt.type === "text") {
          acc += evt.delta;
          patch(inFlightId, { text: acc, pending: true });
        } else if (evt.type === "sources") {
          patch(inFlightId, { sources: evt.sources || [] });
        } else if (evt.type === "chart_pending") {
          // Finalize whatever text we have, or drop the empty placeholder.
          if (acc.trim()) {
            patch(inFlightId, { text: acc, pending: false });
          } else {
            dropEmpty(inFlightId);
          }
          // Insert a chart bubble in pending state.
          const chartId = nextId();
          setMessages((prev) => [
            ...prev,
            { id: chartId, role: "model", kind: "chart", pending: true },
          ]);
          inFlightId = chartId;
          acc = "";
        } else if (evt.type === "chart") {
          patch(inFlightId, {
            kind: "chart",
            figures: evt.figures || [],
            narration: evt.narration || "",
            code: evt.code || "",
            pending: false,
          });
          // Prepare a new text bubble for the wrap-up the chat agent emits
          // after the functionResponse.
          const wrapUpId = nextId();
          setMessages((prev) => [
            ...prev,
            { id: wrapUpId, role: "model", kind: "text", text: "", pending: true },
          ]);
          inFlightId = wrapUpId;
          acc = "";
        } else if (evt.type === "done") {
          // If the last in-flight bubble is an empty text wrap-up, drop it.
          if (!acc.trim()) {
            dropEmpty(inFlightId);
          } else {
            patch(inFlightId, { text: acc, pending: false });
          }
          break;
        } else if (evt.type === "error") {
          patch(inFlightId, {
            text: (acc ? acc + "\n\n" : "") + `*Error: ${evt.message}*`,
            pending: false,
            error: true,
          });
          break;
        }
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        patch(inFlightId, {
          text: `*Network error: ${e.message || e}*`,
          pending: false,
          error: true,
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

  function onClickMic() {
    if (isLive) live.stop();
    else if (live.status === "idle") live.start();
  }

  // ── Render ──────────────────────────────────────────────────────────
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
              <p className="eyebrow">Plate XII · Ask the atlas</p>
              <h3>
                Type, talk, or <em>chart</em>.
              </h3>
            </div>
            <div className="chat-head-actions">
              <button className="close-btn" onClick={() => setOpen(false)}>close</button>
            </div>
          </header>

          {live.error && (
            <p className="live-error drawer">
              <b>Voice error</b> · {live.error}
            </p>
          )}

          <div className="chat-body" ref={scrollRef}>
            {messages.length === 0 && !pendingVoice ? (
              <div className="chat-empty">
                <p className="chat-lede">
                  Ask in plain English, paste a follow-up, or say it out loud
                  with the mic. The atlas will answer in prose, draw a chart,
                  or look something up — whichever fits.
                </p>
                <div className="starters">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      className="starter"
                      onClick={() => (isLive ? live.sendText(s) : send(s))}
                      disabled={sending}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => <Message key={m.id} m={m} />)}
                {pendingVoice && (
                  <Message
                    key="pending-voice"
                    m={{ ...pendingVoice, kind: "text", pending: true, via: "voice" }}
                  />
                )}
              </>
            )}
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <button
              type="button"
              className={`mic-btn ${isLive ? "on" : ""} ${isLiveBusy ? "busy" : ""}`}
              onClick={onClickMic}
              disabled={isLiveBusy}
              aria-label={isLive ? "End voice session" : "Start voice session"}
              title={isLive ? "End voice session" : "Start voice session"}
            >
              <span
                className="mic-ring"
                style={{ transform: `scale(${1 + live.micLevel * 1.1})` }}
              />
              <span className="mic-glyph" aria-hidden>{isLive ? "■" : "●"}</span>
            </button>
            <textarea
              ref={taRef}
              rows={2}
              placeholder={
                isLive
                  ? "voice live — type to send, or just speak"
                  : sending
                    ? "atlas is thinking…"
                    : "Ask, plot, or look something up…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending && !isLive}
            />
            <button type="submit" disabled={(sending && !isLive) || !input.trim()} className="send-btn">
              {sending && !isLive ? "…" : "send"}
            </button>
          </form>

          <p className={`chat-status s-${live.status}`}>
            {isLive
              ? "voice live · interrupt any time"
              : live.status === "connecting"
                ? "opening voice line…"
                : live.status === "ending"
                  ? "closing voice line…"
                  : sending
                    ? "atlas is thinking…"
                    : "type or tap the mic"}
          </p>
        </div>
      )}
    </>
  );
}

/* ── Chart figure mount ────────────────────────────────────────────── */

function ChartFigure({ fig }) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!ref.current || !fig) return;
    renderFigure(ref.current, fig).catch((e) => {
      if (alive) setErr(e?.message || String(e));
    });
    return () => {
      alive = false;
    };
  }, [fig]);

  if (err) return <div className="viz-err">Plot failed: {err}</div>;
  return <div className="viz-fig" ref={ref} />;
}

/* ── Shared message bubble ─────────────────────────────────────────── */

function Message({ m }) {
  const isUser = m.role === "user";
  const isChart = m.kind === "chart";
  return (
    <div
      className={`chat-msg ${isUser ? "u" : "a"} ${m.error ? "err" : ""} ${m.via === "voice" ? "voice" : ""}`}
    >
      {isUser ? (
        <div className="bubble">{m.text}</div>
      ) : (
        <div className="bubble">
          {isChart && m.figures && m.figures.length > 0 && (
            <div className="viz-stack">
              {m.figures.map((fig, i) => (
                <ChartFigure key={i} fig={fig} />
              ))}
            </div>
          )}
          {isChart && m.narration ? (
            <Markdown text={m.narration} />
          ) : !isChart && m.text ? (
            <Markdown text={m.text} />
          ) : m.pending ? (
            <span className="thinking">
              <span /><span /><span />
            </span>
          ) : null}
          {isChart && m.code && (
            <details className="viz-code">
              <summary>Show generated Python</summary>
              <pre>{m.code}</pre>
            </details>
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
