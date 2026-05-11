// server/atlas_tool.js
//
// Single source of truth for the `update_atlas` Gemini tool used by both the
// typed chat agent (server.js) and the voice agent (live/server.mts). Keeping
// the schema, allowlists, and "controls" instruction text together prevents
// drift between the two entry points — the React app validates patches the
// same way regardless of which agent emitted them.

export const ATLAS_FAMILIES = [
  "Aquatic", "Team Ball", "Combat", "Track & Field", "Endurance",
  "Gymnastics", "Winter", "Precision", "Equestrian", "Racket", "Strength", "Other",
];

export const ATLAS_METRICS = [
  "none", "olympians", "medals", "income", "nfhs", "temp", "snow", "elevation",
];

export const ATLAS_PLATES = [
  "ref", "factories", "concentration", "halos", "distance", "climate",
  "per_capita", "home_states", "altitude", "you",
];

export const ATLAS_STATE_ABBRS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

export const UPDATE_ATLAS_DECL = {
  name: "update_atlas",
  description:
    "Drive the Hometown Atlas dashboard the user is looking at. Call this whenever the user asks to filter, narrow, broaden, reset, switch lens, change the choropleth metric, toggle an overlay, open a different plate, or zoom to a state. Pass ONLY the keys you intend to change. After the dashboard updates, write ONE short sentence (≤ 20 words) confirming the change in plain English. If the user is just chatting and not asking for a view change, do NOT call this tool — answer in prose instead.",
  parameters: {
    type: "object",
    properties: {
      families: {
        type: "array",
        nullable: true,
        description: `Sport families to keep visible. Allowed values exactly: ${ATLAS_FAMILIES.join(", ")}. Pass null to mean "all families".`,
        items: { type: "string" },
      },
      eraStart: { type: "integer", description: "Lower bound of the era slider (>= 1896)." },
      eraEnd:   { type: "integer", description: "Upper bound of the era slider (<= 2026)." },
      medalOnly: { type: "boolean", description: "If true, hide athletes with zero career medals." },
      lens: {
        type: "string",
        enum: ["Olympic", "Paralympic"],
        description: "Switch the atlas lens. The atlas is strictly binary — there is no 'all' lens.",
      },
      metric: {
        type: "string",
        enum: ATLAS_METRICS,
        description: "Choropleth metric for state shading. 'none' = no shading.",
      },
      overlays: {
        type: "object",
        description: "Map overlay toggles. Pass only the keys you want to change.",
        properties: {
          dots:     { type: "boolean", description: "Athlete hometown dots." },
          centers:  { type: "boolean", description: "USOPC training-center stars." },
          colleges: { type: "boolean", description: "Feeder-college bubbles." },
        },
      },
      plate: {
        type: "string",
        enum: ATLAS_PLATES,
        description: "Switch the active plate (right-column panel).",
      },
      state: {
        type: "string",
        description: `Select a US state by 2-letter abbreviation (e.g. "CO"). Pass "" to clear the selection. Allowed: ${ATLAS_STATE_ABBRS.join(", ")}.`,
      },
      reset: {
        type: "boolean",
        description: "If true, reset every dashboard control to its default (all families, no medal filter, full era, dots+centers on, no choropleth, Plate I, no state selection). Lens is preserved.",
      },
    },
  },
};

export const ATLAS_CONTROLS_INSTRUCTIONS = [
  "**You can drive the dashboard directly via `update_atlas`.** The user is looking at a live atlas; calling `update_atlas` immediately changes what they see. Choose `update_atlas` when the user asks to filter, narrow, broaden, switch lens, change the choropleth metric, toggle an overlay, open a different plate, or zoom to a state. Examples:",
  '- *"show only winter sports"* → `{ families: ["Winter"] }`',
  '- *"paralympic since 2010"* → `{ lens: "Paralympic", eraStart: 2010 }`',
  '- *"shade states by elevation"* → `{ metric: "elevation" }`',
  '- *"open Plate XI"* / *"where do home states cluster?"* → `{ plate: "home_states" }`',
  '- *"zoom to Colorado"* → `{ state: "CO" }`',
  '- *"hide the training centers"* → `{ overlays: { centers: false } }`',
  '- *"reset everything"* → `{ reset: true }`',
  "",
  `Allowed values: families ∈ {${ATLAS_FAMILIES.join(", ")}}; metric ∈ {${ATLAS_METRICS.join(", ")}}; plate ∈ {${ATLAS_PLATES.join(", ")}}; state ∈ {2-letter US abbrs}.`,
  "Pass only the keys you intend to change. After the call, follow up with ONE short sentence (≤ 20 words) confirming what just happened. Don't call this tool when the user is asking a question — answer in prose instead. Don't combine `update_atlas` with `request_chart` in the same turn — pick whichever fits the user's actual ask.",
].join("\n");

/**
 * Build a short human-readable summary of a patch — used as the string the
 * tool implementation returns to the model so the model knows what was
 * applied (and can speak/write a tight confirmation back to the user).
 */
export function summarizePatch(patch = {}) {
  const parts = [];
  if (patch.reset) parts.push("reset all controls");
  if (patch.lens) parts.push(`lens=${patch.lens}`);
  if (patch.families === null) parts.push("families=all");
  else if (Array.isArray(patch.families)) parts.push(`families=[${patch.families.join(",")}]`);
  if (typeof patch.medalOnly === "boolean") parts.push(`medalOnly=${patch.medalOnly}`);
  if (Number.isFinite(patch.eraStart) || Number.isFinite(patch.eraEnd)) {
    const s = Number.isFinite(patch.eraStart) ? patch.eraStart : "…";
    const e = Number.isFinite(patch.eraEnd) ? patch.eraEnd : "…";
    parts.push(`era=${s}–${e}`);
  }
  if (typeof patch.metric === "string") parts.push(`metric=${patch.metric}`);
  if (patch.overlays && typeof patch.overlays === "object") {
    const ovs = Object.entries(patch.overlays)
      .filter(([, v]) => typeof v === "boolean")
      .map(([k, v]) => `${k}=${v}`);
    if (ovs.length) parts.push(`overlays{${ovs.join(",")}}`);
  }
  if (typeof patch.plate === "string") parts.push(`plate=${patch.plate}`);
  if (typeof patch.state === "string") parts.push(patch.state ? `state=${patch.state}` : "state=cleared");
  return parts.length ? parts.join(", ") : "no-op";
}
