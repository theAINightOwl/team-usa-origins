#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, existsSync } from "fs";
import dotenv from "dotenv";

dotenv.config();

const DATA_DIR = "data";
const OUT_PATH = `${DATA_DIR}/school_multi_matches.json`;
const LEGACY_PATH = `${DATA_DIR}/school_matches.json`;
const BATCH_SIZE = 75;
const MODEL = "gemini-2.5-flash-lite";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = [];
  let cur = "", inQuote = false;
  for (const ch of lines[0]) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { headers.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  headers.push(cur.trim());

  return lines.slice(1).map((line) => {
    const vals = [];
    let v = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === "," && !q) { vals.push(v); v = ""; continue; }
      v += ch;
    }
    vals.push(v);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] ?? "").trim()));
    return obj;
  });
}

// ── Load inputs ──────────────────────────────────────────────────────
const athletes = parseCSV(readFileSync(`${DATA_DIR}/team_usa_athletes.csv`, "utf-8"));
const colleges = parseCSV(readFileSync(`${DATA_DIR}/eada_college_sports.csv`, "utf-8"));

const collegeNames = [...new Set(colleges.map((r) => r.institution_name))].sort();
const allEducation = [
  ...new Set(
    athletes
      .map((r) => r.education?.trim())
      .filter((e) => e && e !== "None" && e !== "NA" && e !== "null")
  ),
].sort();

console.log(
  `${allEducation.length} unique education strings, ${collegeNames.length} EADA colleges`
);

// ── Resume support ───────────────────────────────────────────────────
let results = {};
if (existsSync(OUT_PATH)) {
  results = JSON.parse(readFileSync(OUT_PATH, "utf-8"));
  console.log(`Resumed: ${Object.keys(results).length} already matched`);
} else if (existsSync(LEGACY_PATH)) {
  const legacy = JSON.parse(readFileSync(LEGACY_PATH, "utf-8"));
  results = Object.fromEntries(
    Object.entries(legacy).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [],
    ])
  );
  console.log(`Seeded ${Object.keys(results).length} entries from ${LEGACY_PATH}`);
}

const remaining = allEducation.filter((e) => !(e in results));
console.log(`${remaining.length} strings left to process`);

// ── Batch processing ─────────────────────────────────────────────────
const collegeList = collegeNames.join("\n");

const systemInstruction = `You are an entity-resolution assistant. You are given a fixed list of EADA college/university names. For each athlete education string, identify every EADA college/university the athlete attended. Return exact institution_name values from the list, or an empty array if none match. Only match colleges/universities, not high schools. If multiple colleges are listed, include each matched college once in reading order. Respond ONLY with a valid JSON object mapping each input string to an array of matched names. No markdown fences, no explanation.`;

for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
  const batch = remaining.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

  const numberedStrings = batch.map((s, j) => `${j + 1}. ${s}`).join("\n");

  const prompt = `EADA colleges:\n${collegeList}\n\nEducation strings:\n${numberedStrings}`;

  console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} strings)...`);

  let parsed = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        config: { systemInstruction },
        contents: prompt,
      });

      let text = response.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      // Strip control chars inside JSON string values that break JSON.parse
      text = text.replace(
        /"(?:[^"\\]|\\.)*"/g,
        (m) => m.replace(/[\x00-\x1f]/g, " ")
      );
      parsed = JSON.parse(text);
      break;
    } catch (err) {
      console.error(`  attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!parsed) {
    console.error(`  SKIPPING batch ${batchNum} after 3 failures`);
    continue;
  }

  // The model may use numbered keys ("1. ...") or raw strings — handle both
  for (const [key, value] of Object.entries(parsed)) {
    const clean = key.replace(/^\d+\.\s*/, "");
    if (batch.includes(clean)) {
      results[clean] = Array.isArray(value)
        ? value.filter((v) => typeof v === "string" && v.trim())
        : value
          ? [value]
          : [];
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(
    `  → ${Object.keys(results).length} total matched (${Object.values(results).filter((v) => Array.isArray(v) && v.length > 0).length} non-empty)`
  );
}

console.log(
  `\nDone. ${Object.keys(results).length} entries in ${OUT_PATH} (${Object.values(results).filter((v) => Array.isArray(v) && v.length > 0).length} matched to a college)`
);
