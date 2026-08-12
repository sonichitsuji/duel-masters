#!/usr/bin/env node
// autoEffect を廃止し、triggers に一本化する移行スクリプト。
//   autoEffect{trigger:"play", …} → triggers に {on:"creaturePutBz", …} を先頭へ
//   autoEffect{trigger:"cast", …} → triggers に {on:"cast", …} を先頭へ
//   autoEffect: null             → キーごと削除
//   spellSide.autoEffect         → spellSide.triggers（呪文面なので必ず on:"cast"）
//
// 一度実行すれば済むが、履歴として残しておく（scripts/migrate-effects.mjs と同じ流儀）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsPath = path.join(__dirname, "..", "public", "cards.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));

const ON_OF = { play: "creaturePutBz", cast: "cast" };

// autoEffect を trigger 1件の形に変える。trigger 以外のキー（effects / optional /
// type:"chooseTimes" の count・templates）はそのまま持ち越す。
function toTrigger(auto, where) {
  const { trigger, ...rest } = auto;
  const on = ON_OF[trigger];
  if (!on) throw new Error(`${where}: 未知の autoEffect.trigger "${trigger}"`);
  return { on, ...rest };
}

let moved = 0, dropped = 0, sideMoved = 0;
for (const c of cards) {
  if ("autoEffect" in c) {
    if (c.autoEffect) {
      const tr = toTrigger(c.autoEffect, c.name);
      c.triggers = [tr, ...(c.triggers || [])];
      moved++;
    } else {
      dropped++;
    }
    delete c.autoEffect;
  }
  const side = c.spellSide;
  if (side && "autoEffect" in side) {
    if (side.autoEffect) {
      side.triggers = [toTrigger(side.autoEffect, `${c.name}.spellSide`), ...(side.triggers || [])];
      sideMoved++;
    }
    delete side.autoEffect;
  }
}

fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");
console.log(`✅ autoEffect → triggers: ${moved}枚を移行 / ${dropped}枚は null だったので削除 / 呪文面 ${sideMoved}面`);
console.log("→ 次に `npm run validate-cards` で検証してください。");
