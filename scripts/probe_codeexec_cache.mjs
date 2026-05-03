// scripts/probe_codeexec_cache.mjs
// Throwaway: verifies cachedContent + codeExecution can be combined.
// Verifies inlineData CSV parts are accepted inside a cache.
// Delete after the caching plan lands.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.VIZ_MODEL || "gemini-3.1-pro-preview";
const csv = readFileSync("data/training_centers.csv");

// Gemini caches require >= 1024 tokens. training_centers.csv alone is ~659 tokens,
// so we attach a second larger CSV (nfhs_state_totals.csv) to clear the minimum.
// The probe still verifies its real question against training_centers.csv.
const csv2 = readFileSync("data/nfhs_state_totals.csv");

console.log("[probe] creating cache...");
let cache;
try {
  cache = await ai.caches.create({
    model: MODEL,
    config: {
      systemInstruction: "You answer using the attached CSVs via pandas in the code-execution sandbox. The files available are training_centers.csv and nfhs_state_totals.csv.",
      contents: [{
        role: "user",
        parts: [
          { text: "File: training_centers.csv" },
          { inlineData: { mimeType: "text/csv", data: csv.toString("base64") } },
          { text: "File: nfhs_state_totals.csv" },
          { inlineData: { mimeType: "text/csv", data: csv2.toString("base64") } },
        ],
      }],
      // Per Gemini error message, tools must live INSIDE the cache, not on generateContent.
      tools: [{ codeExecution: {} }],
      ttl: "300s",
    },
  });
  console.log("[probe] cache created:", cache.name);
} catch (err) {
  console.log("[probe] CACHE CREATE FAILED:", err?.message || err);
  process.exit(1);
}

console.log("[probe] calling generateContent with cachedContent + codeExecution...");
try {
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: "Run Python: load training_centers.csv with pandas, print df.shape and df.columns.tolist(). Then return the literal string DONE.",
    config: {
      cachedContent: cache.name,
    },
  });

  for (const part of resp.candidates?.[0]?.content?.parts ?? []) {
    if (part.executableCode?.code) console.log("--- CODE ---\n" + part.executableCode.code);
    if (part.codeExecutionResult?.output) console.log("--- STDOUT ---\n" + part.codeExecutionResult.output);
    if (part.text) console.log("--- TEXT ---\n" + part.text);
  }
  console.log("--- usageMetadata ---");
  console.log(JSON.stringify(resp.usageMetadata, null, 2));
} catch (err) {
  console.log("[probe] GENERATECONTENT FAILED:", err?.message || err);
} finally {
  console.log("[probe] deleting cache...");
  await ai.caches.delete({ name: cache.name }).catch((e) => console.log("[probe] delete error:", e?.message));
}
