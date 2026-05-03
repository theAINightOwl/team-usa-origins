/*
 * sse.js — POST JSON to a server-sent-events endpoint and yield parsed
 * event payloads via an async generator.
 *
 * Usage:
 *   for await (const evt of streamChat({ messages })) {
 *     if (evt.type === "text") appendText(evt.delta);
 *     else if (evt.type === "sources") setSources(evt.sources);
 *     else if (evt.type === "done") break;
 *     else if (evt.type === "error") setError(evt.message);
 *   }
 */

async function* streamSse(path, body, signal) {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok || !resp.body) {
    yield {
      type: "error",
      message: `HTTP ${resp.status} — ${resp.statusText || "no body"}`,
    };
    yield { type: "done" };
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        yield JSON.parse(json);
      } catch (e) {
        yield { type: "error", message: "Bad SSE frame: " + json.slice(0, 80) };
      }
    }
  }
}

export async function* streamChat({ messages, profileType, signal } = {}) {
  yield* streamSse("/api/chat", { messages, profileType }, signal);
}

export async function* streamPersonal({ hometown, residence, profileType, signal } = {}) {
  yield* streamSse("/api/personal", { hometown, residence, profileType }, signal);
}
