import React from "react";

/*
 * Tiny markdown renderer used by ChatBot and PlateStory.
 *
 * Supports paragraphs, **bold**, *italic*, `code`, [text](url),
 * - bullets, 1. numbered, ## headings (max h6), --- horizontal rule,
 * and > blockquotes (single line, "> quoted text"). Tables are not supported.
 *
 * No HTML escaping concerns because everything passes through React text nodes.
 */
export default function Markdown({ text }) {
  const blocks = parseBlocks(text || "");
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "h") {
          const Tag = `h${Math.min(6, b.level + 2)}`;
          return <Tag key={i} className="md-h">{renderInline(b.text)}</Tag>;
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className="md-ul">
              {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="md-ol">
              {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
            </ol>
          );
        }
        if (b.type === "hr") return <hr key={i} className="md-hr" />;
        if (b.type === "bq") {
          return (
            <blockquote key={i} className="md-bq">
              {b.lines.map((l, j) => <p key={j}>{renderInline(l)}</p>)}
            </blockquote>
          );
        }
        if (b.type === "table") {
          return (
            <table key={i} className="md-table">
              <thead>
                <tr>{b.head.map((c, j) => <th key={j}>{renderInline(c)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((row, j) => (
                  <tr key={j}>{row.map((c, k) => <td key={k}>{renderInline(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          );
        }
        return <p key={i} className="md-p">{renderInline(b.text)}</p>;
      })}
    </>
  );
}

function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++; continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "h", level: h[1].length, text: h[2] });
      i++; continue;
    }
    if (/^\s*>\s+/.test(line)) {
      const lines2 = [];
      while (i < lines.length && /^\s*>\s+/.test(lines[i])) {
        lines2.push(lines[i].replace(/^\s*>\s+/, ""));
        i++;
      }
      blocks.push({ type: "bq", lines: lines2 });
      continue;
    }
    // Pipe table: header | sep | row...
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2; // skip separator
      const rows = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", head, rows });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    // paragraph
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|---|\s*[-*>]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }
  return blocks;
}

function splitRow(line) {
  return line
    .replace(/^\s*\|\s*/, "")
    .replace(/\s*\|\s*$/, "")
    .split(/\s*\|\s*/);
}

function renderInline(text) {
  const out = [];
  let rest = text;
  let key = 0;
  const patterns = [
    { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, render: (m) => <a key={key++} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a> },
    { re: /\*\*([^*]+)\*\*/, render: (m) => <strong key={key++}>{m[1]}</strong> },
    { re: /\*([^*\n]+)\*/, render: (m) => <em key={key++}>{m[1]}</em> },
    { re: /`([^`]+)`/, render: (m) => <code key={key++}>{m[1]}</code> },
  ];
  while (rest) {
    let earliest = null;
    for (const p of patterns) {
      const m = rest.match(p.re);
      if (m && (earliest === null || m.index < earliest.idx)) {
        earliest = { idx: m.index, m, p };
      }
    }
    if (!earliest) {
      out.push(rest);
      break;
    }
    if (earliest.idx > 0) out.push(rest.slice(0, earliest.idx));
    out.push(earliest.p.render(earliest.m));
    rest = rest.slice(earliest.idx + earliest.m[0].length);
  }
  return out;
}
