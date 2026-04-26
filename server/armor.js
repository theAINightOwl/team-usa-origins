/*
 * armor.js — thin wrapper around @google-cloud/modelarmor for inbound
 * prompt screening. Used by both the text chat backend (server.js) and
 * the live-voice backend (live/server.mts).
 *
 * Feature-off when any of MODEL_ARMOR_{PROJECT,LOCATION,TEMPLATE} is
 * blank — sanitizePrompt() short-circuits to { ok: true, skipped: true }.
 *
 * Fails-open on transport errors so a Model Armor outage doesn't take
 * the chat down — we still have the system-prompt NIL/medal rules.
 */

import { ModelArmorClient } from "@google-cloud/modelarmor";

const PROJECT = process.env.MODEL_ARMOR_PROJECT?.trim() || "";
const LOCATION = process.env.MODEL_ARMOR_LOCATION?.trim() || "";
const TEMPLATE = process.env.MODEL_ARMOR_TEMPLATE?.trim() || "";

const enabled = Boolean(PROJECT && LOCATION && TEMPLATE);
const templateName = enabled
  ? `projects/${PROJECT}/locations/${LOCATION}/templates/${TEMPLATE}`
  : null;

let _client = null;
function client() {
  if (_client) return _client;
  // Model Armor is only exposed on regional endpoints (…rep.googleapis.com).
  _client = new ModelArmorClient({
    apiEndpoint: `modelarmor.${LOCATION}.rep.googleapis.com`,
  });
  return _client;
}

// Pull a short human label out of the first matched filter for error UX.
function firstMatchReason(sanitizationResult) {
  const fr = sanitizationResult?.filterResults;
  if (!fr) return "policy match";
  // filterResults can be a protobuf Map (entries) or a plain object depending on transport.
  const entries = typeof fr?.entries === "function"
    ? Array.from(fr.entries())
    : Object.entries(fr);

  for (const [name, result] of entries) {
    const inner = Object.values(result || {})[0];
    if (inner?.matchState === "MATCH_FOUND") {
      const label = {
        rai: "responsible-AI policy",
        pi_and_jailbreak: "prompt injection / jailbreak",
        sdp: "sensitive data",
        malicious_uris: "malicious URL",
        csam: "child safety",
      }[name] || name;
      const conf = inner.confidenceLevel ? ` (${inner.confidenceLevel})` : "";
      return `${label}${conf}`;
    }
  }
  return "policy match";
}

export function armorStatus() {
  return { enabled, project: PROJECT, location: LOCATION, template: TEMPLATE };
}

export function logArmorBanner(tag = "[armor]") {
  if (enabled) {
    console.log(`${tag} enabled  project=${PROJECT} template=${TEMPLATE} location=${LOCATION}`);
  } else {
    console.log(`${tag} disabled — set MODEL_ARMOR_{PROJECT,LOCATION,TEMPLATE} in .env to enable`);
  }
}

/**
 * @param {string} text  The user prompt (or voice turn transcript) to screen.
 * @returns {Promise<{ ok: true, skipped?: true } | { ok: false, reason: string, filters?: any }>}
 */
export async function sanitizePrompt(text) {
  if (!enabled) return { ok: true, skipped: true };
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: true, skipped: true };

  try {
    const [response] = await client().sanitizeUserPrompt({
      name: templateName,
      userPromptData: { text: trimmed },
    });
    const sr = response?.sanitizationResult;
    if (sr?.filterMatchState === "MATCH_FOUND") {
      return { ok: false, reason: firstMatchReason(sr), filters: sr.filterResults };
    }
    return { ok: true };
  } catch (err) {
    console.warn(`[armor] transport error — falling open (skipped): ${err?.message || err}`);
    return { ok: true, skipped: true, error: String(err?.message || err) };
  }
}
