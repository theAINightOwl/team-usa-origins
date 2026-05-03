// scripts/probe_codeexec_files.mjs
// Throwaway: verifies inline CSV is reachable from the executor's Python.
// Delete after the viz-data plan lands.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const csv = readFileSync("data/training_centers.csv");

const resp = await ai.models.generateContent({
  model: process.env.VIZ_MODEL || "gemini-3.1-pro-preview",
  contents: [{
    role: "user",
    parts: [
      { text: "File: training_centers.csv" },
      { inlineData: { mimeType: "text/csv", data: csv.toString("base64") } },
      { text: "Run Python: load training_centers.csv with pandas, print df.shape and df.columns.tolist(). Then return the literal string DONE." },
    ],
  }],
  config: { tools: [{ codeExecution: {} }] },
});

for (const part of resp.candidates?.[0]?.content?.parts ?? []) {
  if (part.executableCode?.code) console.log("--- CODE ---\n" + part.executableCode.code);
  if (part.codeExecutionResult?.output) console.log("--- STDOUT ---\n" + part.codeExecutionResult.output);
  if (part.text) console.log("--- TEXT ---\n" + part.text);
}
