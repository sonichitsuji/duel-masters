#!/usr/bin/env node
// public/cards.json の整形を壊さず、末尾にカードを追記する。
// 使い方:
//   node scripts/add-card.mjs cards-to-add.json     # 1枚 or 配列のJSONファイル
//   cat card.json | node scripts/add-card.mjs -      # 標準入力から
// id は省略/0/未指定なら (最大id+1) から自動採番。追記後に検証を促す。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS = path.join(__dirname, "..", "public", "cards.json");

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/add-card.mjs <file.json | ->");
  process.exit(2);
}
const rawInput = arg === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(arg, "utf8");

let incoming;
try { incoming = JSON.parse(rawInput); }
catch (e) { console.error("入力JSONが不正です:", e.message); process.exit(1); }
const newCards = Array.isArray(incoming) ? incoming : [incoming];

const txt = fs.readFileSync(CARDS, "utf8");
const existing = JSON.parse(txt);
const usedIds = new Set(existing.map(c => c.id));
let nextId = Math.max(0, ...existing.map(c => c.id)) + 1;
const existingNames = new Set(existing.map(c => c.name));

const added = [];
for (const card of newCards) {
  if (!card || typeof card !== "object") { console.error("カードはオブジェクトである必要があります"); process.exit(1); }
  if (!card.id) card.id = nextId++;
  while (usedIds.has(card.id)) card.id = nextId++;
  usedIds.add(card.id);
  if (existingNames.has(card.name)) console.warn(`⚠ 同名カードが既に存在: "${card.name}"（重複の可能性）`);
  existingNames.add(card.name);
  added.push(card);
}

// 既存の整形（2スペースインデント）に合わせてテキスト挿入（全文再整形しない）
const block = added
  .map(c => JSON.stringify(c, null, 2).split("\n").map(l => "  " + l).join("\n"))
  .join(",\n");
const idx = txt.lastIndexOf("]");
const head = txt.slice(0, idx).replace(/\s+$/, "");
const out = head + ",\n" + block + "\n]\n";

// 妥当性の最終確認
JSON.parse(out);
fs.writeFileSync(CARDS, out);

console.log(`✅ ${added.length}枚を追加: ${added.map(c => `${c.id}:${c.name}`).join(", ")}`);
console.log("→ 次に `npm run validate-cards` で検証してください。");
