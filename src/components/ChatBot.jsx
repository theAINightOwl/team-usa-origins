import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { streamChat } from "../lib/sse.js";
import Markdown from "../lib/markdown.jsx";
import { useGeminiLive } from "../hooks/useGeminiLive.js";
import { renderFigure } from "../lib/plotly-render.js";

/*
 * ChatBot — "Ask the Atlas" floating drawer.
 *
 * One conversation thread. The user types or speaks; the chat agent decides
 * whether to answer in prose or invoke a `request_chart` tool that fans out
 * to the viz agent. Voice and typed turns flow into the same messages array
 * so follow-ups can reference any prior turn — text, transcript, or figure.
 */

const STARTERS = [
  "Why does Park City UT produce so many olympians?",
  "Bar chart of medals by sport family.",
  "Which states have the highest paralympic share?",
  "Plot Team USA profiles per 100k by state, top 10.",
];

export default function ChatBot({ profileType = "olympic", onApplyPatch, embedded = false }) {
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState([]);
  const [pendingVoice, setPendingVoice] = useState(null); // { role, text } in-flight voice fragment
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const idCounter = useRef(0);
  const nextId = useCallback(() => `m-${++idCounter.current}`, []);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  // ── Voice fragment plumbing ─────────────────────────────────────────
  // pendingVoiceRef mirrors pendingVoice synchronously so role-transition
  // logic can branch on the *current* value without nesting setState calls
  // inside updater functions (which would lose work — that's what was making
  // the first voice user bubble vanish when the model started replying).
  const pendingVoiceRef = useRef(null);
  const setPending = useCallback((value) => {
    pendingVoiceRef.current = value;
    setPendingVoice(value);
  }, []);

  const commitPending = useCallback(() => {
    const p = pendingVoiceRef.current;
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
    pendingVoiceRef.current = null;
    setPendingVoice(null);
  }, [nextId]);

  const appendFragment = useCallback((role, text) => {
    if (!text) return;
    const p = pendingVoiceRef.current;
    if (p && p.role !== role) {
      // Role transition — flush the prior speaker's bubble first.
      commitPending();
    }
    const prev = pendingVoiceRef.current;
    const next = prev && prev.role === role
      ? { role, text: prev.text + text }
      : { role, text };
    setPending(next);
  }, [commitPending, setPending]);

  const liveOpts = useMemo(() => ({
    onUserFragment: (text) => appendFragment("user", text),
    onModelFragment: (text) => appendFragment("model", text),
    // Don't auto-commit on turn_complete: Gemini Live emits it on every
    // model pause and intermediate tool consideration, which was splitting
    // a single answer across multiple bubbles ("Did you" / "know tiny
    // Vermont…"). The role-transition check in appendFragment + the
    // explicit commit on interrupted / session-end covers the legitimate
    // commit moments.
    onTurnComplete: () => {},
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
    onViewPatch: (patch) => {
      // Flush whatever the model was speaking before the patch chip lands.
      commitPending();
      if (onApplyPatch) onApplyPatch(patch || {});
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "model",
          kind: "view_patch",
          patch: patch || {},
          via: "voice",
        },
      ]);
    },
  }), [appendFragment, commitPending, nextId, onApplyPatch]);

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

  // When the drawer closes, flush any pending voice bubble and end the session.
  useEffect(() => {
    if (!open) {
      if (pendingVoiceRef.current) commitPending();
      if (live.status !== "idle") live.stop();
    }
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
      .filter((m) => m.kind === "text" || m.kind === "chart" || m.kind === "view_patch")
      .map((m) => {
        if (m.kind === "chart") return { role: "model", text: `[chart rendered] ${m.narration || ""}` };
        if (m.kind === "view_patch") return { role: "model", text: `[atlas updated] ${JSON.stringify(m.patch || {})}` };
        return { role: m.role, text: m.text };
      });

    let inFlightId = modelPlaceholderId;
    let acc = "";

    function patch(id, patchObj) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patchObj } : m)));
    }
    function dropEmpty(id) {
      setMessages((prev) => prev.filter((m) => !(m.id === id && (!m.text || !m.text.trim()))));
    }

    try {
      for await (const evt of streamChat({ messages: history, profileType, signal: ctrl.signal })) {
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
        } else if (evt.type === "view_patch") {
          // Apply the patch to the live atlas immediately, and finalize / drop
          // any in-flight text bubble so the wrap-up sentence can land cleanly.
          if (onApplyPatch) onApplyPatch(evt.patch || {});
          if (acc.trim()) {
            patch(inFlightId, { text: acc, pending: false });
          } else {
            dropEmpty(inFlightId);
          }
          // Insert a small "atlas updated" bubble showing what changed.
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: "model", kind: "view_patch", patch: evt.patch || {} },
          ]);
          // Prepare a new text bubble for the model's confirmation sentence.
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
    if (isLive) {
      // Flush whatever's mid-stream before tearing the WS down.
      commitPending();
      live.stop();
    } else if (live.status === "idle") {
      live.start();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <>
      {!open && !embedded && (
        <button
          className="chat-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open Ask the Atlas"
        >
          <span className="chat-launcher-icon" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 32 32">
              {/* antenna */}
              <line x1="16" y1="3" x2="16" y2="7" stroke="#1a1410" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="16" cy="2.5" r="1.4" fill="#c63d2f" stroke="#1a1410" strokeWidth="0.8">
                <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
              </circle>
              {/* head */}
              <rect x="5.5" y="7" width="21" height="18" rx="3.5" fill="#f6e8c8" stroke="#1a1410" strokeWidth="1.2" />
              {/* screen panel */}
              <rect x="8.5" y="11" width="15" height="8" rx="1.5" fill="#1a1410" />
              {/* eyes */}
              <circle cx="12.5" cy="15" r="1.6" fill="#f6e8c8" />
              <circle cx="19.5" cy="15" r="1.6" fill="#f6e8c8" />
              <circle cx="12.7" cy="14.7" r="0.5" fill="#1a1410" />
              <circle cx="19.7" cy="14.7" r="0.5" fill="#1a1410" />
              {/* smile */}
              <path d="M12.5 22 Q16 23.6 19.5 22" fill="none" stroke="#1a1410" strokeWidth="1.1" strokeLinecap="round" />
              {/* ear bolts */}
              <circle cx="5" cy="16" r="1.1" fill="#c63d2f" stroke="#1a1410" strokeWidth="0.8" />
              <circle cx="27" cy="16" r="1.1" fill="#c63d2f" stroke="#1a1410" strokeWidth="0.8" />
            </svg>
          </span>
          <span className="chat-launcher-label">
            <span className="chat-launcher-eyebrow">Ask the Atlas</span>
            <span className="chat-launcher-sub">type · talk · chart</span>
          </span>
        </button>
      )}

      {open && (
        <div className={`chat-drawer ${embedded ? "embedded" : ""}`} role="dialog" aria-label="Ask the Atlas">
          <header className="chat-head">
            <div>
              <p className="eyebrow">Ask the Atlas</p>
              <h3>
                Type, talk, or <em>chart</em>.
              </h3>
            </div>
            {!embedded && (
              <div className="chat-head-actions">
                <button className="close-btn" onClick={() => setOpen(false)}>close</button>
              </div>
            )}
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
              <span className="mic-glyph" aria-hidden>
                {isLive ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="1.5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <path d="M12 18v3" />
                  </svg>
                )}
              </span>
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
  const isPatch = m.kind === "view_patch";
  if (isPatch) {
    return (
      <div className="chat-msg a patch">
        <div className="patch-bubble">
          <span className="patch-eyebrow">atlas updated</span>
          <PatchSummary patch={m.patch} />
        </div>
      </div>
    );
  }
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

/* ── view_patch summary chip ───────────────────────────────────────── */

const PLATE_LABEL = {
  ref: "Plate I — Reference",
  factories: "Plate II — Factories",
  concentration: "Plate III — Concentration",
  halos: "Plate IV — Halos",
  distance: "Plate V — Distance",
  climate: "Plate VI — Climate",
  per_capita: "Plate VII — Per Capita",
  colleges: "Plate VIII — Colleges",
  hs_conversion: "Plate IX — HS Slots",
  era: "Plate X — Era",
  altitude: "Plate XI — Altitude",
  you: "Plate XII — You",
};
const METRIC_LABEL = {
  none: "no shading",
  olympians: "Team USA profiles",
  medals: "total medals",
  income: "median income",
  nfhs: "HS participation",
  temp: "avg temperature",
  snow: "avg snowfall",
  elevation: "hometown elevation",
};

function PatchSummary({ patch = {} }) {
  const lines = [];
  if (patch.reset) lines.push("Reset all controls");
  if (patch.lens) lines.push(`Lens → ${patch.lens}`);
  if (patch.families === null) lines.push("Families → all");
  else if (Array.isArray(patch.families)) lines.push(`Families → ${patch.families.join(", ")}`);
  if (typeof patch.medalOnly === "boolean") lines.push(patch.medalOnly ? "Medalists only" : "All athletes");
  if (Number.isFinite(patch.eraStart) || Number.isFinite(patch.eraEnd)) {
    const s = Number.isFinite(patch.eraStart) ? patch.eraStart : "…";
    const e = Number.isFinite(patch.eraEnd) ? patch.eraEnd : "…";
    lines.push(`Era → ${s}–${e}`);
  }
  if (typeof patch.metric === "string") lines.push(`Choropleth → ${METRIC_LABEL[patch.metric] || patch.metric}`);
  if (patch.overlays && typeof patch.overlays === "object") {
    for (const [k, v] of Object.entries(patch.overlays)) {
      if (typeof v === "boolean") lines.push(`${k.charAt(0).toUpperCase() + k.slice(1)} overlay → ${v ? "on" : "off"}`);
    }
  }
  if (typeof patch.plate === "string") lines.push(`Open ${PLATE_LABEL[patch.plate] || patch.plate}`);
  if (typeof patch.state === "string") lines.push(patch.state ? `Zoom → ${patch.state}` : "Clear state selection");
  if (lines.length === 0) lines.push("(no-op)");
  return (
    <ul className="patch-list">
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}
