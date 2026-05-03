// server/viz_cache.js
//
// Gemini context-cache lifecycle for the viz agent. Holds the system
// instruction + reference file payload + tool config in a single named
// cache so the per-call generateContent only ships the user's question.
//
// Cache lifetime is process-local. On `compute_analytics.py` regen or any
// data refresh, restart the server to pick up new bytes — there's no
// content-hash-based invalidation here.
import { loadVizFiles } from "./viz_data.js";

const TTL = process.env.VIZ_CACHE_TTL || "79200s"; // 22h

let _cacheNamePromise = null;

/**
 * Lazily create (or reuse) a Gemini cache holding the system instruction,
 * code-execution tool config, and all reference file parts. Idempotent
 * within a process: subsequent calls return the same cache name. Call
 * `invalidateVizCache()` to clear the memo so the next call recreates.
 *
 * @param {GoogleGenAI} ai
 * @param {string} model
 * @param {string} systemInstruction
 * @returns {Promise<string>} cache name (e.g. "cachedContents/abc123")
 */
export async function getOrCreateVizCache(ai, model, systemInstruction) {
  if (_cacheNamePromise) return _cacheNamePromise;
  _cacheNamePromise = (async () => {
    const files = loadVizFiles();
    const fileParts = files.flatMap((f) => [
      { text: `File: ${f.name}` },
      { inlineData: { mimeType: f.mimeType, data: f.data } },
    ]);
    const cache = await ai.caches.create({
      model,
      config: {
        systemInstruction,
        tools: [{ codeExecution: {} }],
        contents: [{ role: "user", parts: fileParts }],
        ttl: TTL,
      },
    });
    console.log(`viz-cache: created ${cache.name} (ttl=${TTL}, ${files.length} files)`);
    return cache.name;
  })().catch((err) => {
    _cacheNamePromise = null; // allow retry on next call
    throw err;
  });
  return _cacheNamePromise;
}

export function invalidateVizCache() {
  _cacheNamePromise = null;
}
