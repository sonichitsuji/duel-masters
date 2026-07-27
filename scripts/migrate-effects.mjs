#!/usr/bin/env node
// 一度きりの移行スクリプト: cards.json を新しい effects 記法へ変換する。
//  - autoEffect: {type:"steps", steps:[...]} → {trigger, effects:[...]}
//  - triggers[].effect:{...} → triggers[].effects:[...]
//  - 単純効果(processEffect の type) → 対応する effects 要素へ
//  - 旧ステップ名 → 新名（ゾーン移動 <from>To<To> / 実行 playFromHand / 変数 count）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS = path.join(__dirname, "..", "public", "cards.json");

// 旧ステップ → 新 effects 配列（1つが複数に化けることがある）
function convertStep(s) {
  const t = s.type;
  const keep = (obj) => [{ ...stripCommon(s), ...obj }];
  switch (t) {
    // --- そのまま／改名のみ ---
    case "drawCards":      return keep({ type: "drawCards", amount: s.amount ?? 1 });
    case "revealDeckTop":  return keep({ type: "reveal", amount: s.amount ?? 1 });
    case "restRevealedToBottom": return keep({ type: "revealedToDeckBottom" });
    case "millTop":        return keep({ type: "topToGrave", amount: s.amount ?? 1 });
    case "millTopToMana":  return keep({ type: "topToMana", amount: s.amount ?? 1 });
    case "shieldizeTopDeck":   return keep({ type: "topToShield", amount: 1 });
    case "shieldizeFromHand":  return keep({ type: "handToShield" });
    case "shieldizeOpponentCreature": return keep({ type: "bzToShield", target: "opponent" });
    case "returnShieldToHand": return keep({ type: "shieldToHand", target: "self" });
    case "selectShieldToGrave":return keep({ type: "shieldToGrave", target: s.target || "self" });
    case "manaCreatureSelectToBZ": return keep({ type: "manaToBz", filter: { type: "creature" } });
    case "bzSelectToMana":     return keep({ type: "bzToMana", target: s.target || "opponent" });
    case "bounceSelectCreature": return keep({ type: "bzToHand", target: s.target || "opponent" });
    case "bounceElement":      return keep({ type: "bzToHand", target: "opponent", filter: { element: true } });
    case "bounceMaxCost":      return keep({ type: "bzToHand", target: "both", filter: { maxCost: s.maxCost ?? 999 } });
    case "handDiscard":        return keep({ type: "handToGrave", target: s.target || "self" });
    case "randomDiscardOpponent": return keep({ type: "handToGrave", target: "opponent", random: true, amount: 1 });
    case "destroyChooseAny":   return keep({ type: "destroy", target: "both" });
    case "destroyNonColor":    return keep({ type: "destroy", target: "both", all: true, filter: { civNot: s.color } });
    case "tapAllOpponent":     return keep({ type: "tap", target: "opponent", all: true });
    case "tapSelectCreature":  return keep({ type: "tap", target: s.target || "opponent" });
    case "tapNoUntapNextTurn": return keep({ type: "tap", target: "opponent", noUntapNextTurn: true });
    case "tapOrUntapSelectCreature": return keep({ type: "tapToggle", target: "both" });
    case "untapAllMana":       return keep({ type: "untapAllMana" });
    case "untapSelectCreature":return keep({ type: "untap", target: "self", ...(s.tempBuff ? { } : {}) });
    case "battleOpponentCreature":  return keep({ type: "battle", target: "opponent" });
    case "breakOpponentShieldChoice": return keep({ type: "breakShield", target: "opponent" });
    case "debuffOpponentPower":return keep({ type: "powerBuff", target: "opponent", amount: -(s.amount ?? 0), expires: "endOfTurn" });
    case "grantTempBuffToSelf":return keep({ type: "grant", target: "self", keywords: s.keywords, expires: s.expires || "endOfTurn" });
    case "setUntapAfterAttack":return keep({ type: "grant", target: "self", untapAfterAttack: true });
    case "grantSAUntapAfterAttack": return keep({ type: "grant", target: "self", keywords: ["speedAttacker"], untapAfterAttack: true });
    case "scheduleReviveSubjectEndOfTurn": return keep({ type: "scheduleReviveSubjectEndOfTurn" });
    case "putFilteredFromHand": return keep({ type: "handToBz", filter: s.filter, tempKeyword: s.tempKeyword, amount: s.maxSelect ?? s.amount });
    case "playLightCreatureFromHand": return keep({ type: "handToBz", filter: { civ: "light", type: "creature", maxCost: s.maxCost ?? 4 }, summoningSickness: true });
    case "reviveFilteredFromGrave": return keep({ type: "graveToBz", filter: { ...(s.filter || {}), type: "creature" }, tempKeywords: ["speedAttacker"], destroyAtEndOfTurn: true });
    case "reviveSelfFromGrave":  return keep({ type: "graveToBz", self: true, summoningSickness: true });
    case "reviveFromDestroyedOwnerGrave": return keep({ type: "graveToBz", owner: "destroyed", filter: { type: "creature" } });
    case "optionalReviveFromMilled": return keep({ type: "graveToBz", filter: { type: "creature" }, optional: true });
    case "castFilteredSpellFromHand": return keep({ type: "playFromHand", free: true, filter: { ...(s.filter || {}), type: "spell" } });
    case "castFreeSTriggerSpellFromHand": return keep({ type: "playFromHand", free: true, filter: { type: "spell", keyword: "sTrigger" } });
    case "searchSpellToTop":   return keep({ type: "search", destination: "deckTop", filter: { type: "spell" } });

    // --- 公開カードの行き先 ---
    case "chooseFromRevealed": {
      const dest = s.destination === "battle" ? "revealedToBz" : s.destination === "deckTop" ? "revealedToDeckTop" : "revealedToHand";
      return keep({ type: dest, filter: s.filter, takeAll: s.takeAll, amount: s.amount });
    }
    case "playFromRevealed":   return keep({ type: "revealedToBz", filter: s.filter });

    // --- 変数ステップで代替 ---
    case "drawPerFilter": {
      const f = s.filter || {};
      return [ { type: "count", zone: "bz", target: "self", filter: f, label: "対象の数を数える" },
               { ...stripCommon(s), type: "drawCards", amount: "count" } ];
    }
    case "drawCardsPerTappedOpponent":
      return [ { type: "count", zone: "bz", target: "opponent", filter: { tapped: true }, label: "相手のタップ数を数える" },
               { ...stripCommon(s), type: "drawCards", amount: "count" } ];
    case "discardHandDrawPlusOne":
      return [ { type: "count", zone: "hand", target: "self", label: "手札の枚数を数える" },
               { type: "handToGrave", target: "self", all: true, label: "手札をすべて捨てる" },
               { type: "drawCards", amount: "count", label: "捨てた枚数を引く" },
               { type: "drawCards", amount: 1, label: "さらに1枚引く" } ];
    case "putFromHandFreeUnderHandCount":
      // 手札の枚数以下のコストを持つ、クリーチャーではないカードを1枚、コストを支払わず実行
      return [ { type: "count", zone: "hand", target: "self", label: "手札の枚数を数える" },
               { ...stripCommon(s), type: "playFromHand", free: true, filter: { type: "nonCreature", maxCost: "count" } } ];
    case "millTopToManaIfDragon":
      return [ { type: "count", zone: "lastMoved", filter: { raceContains: "ドラゴン" }, label: "直前のカードがドラゴンか" },
               { type: "topToMana", amount: "count", label: "ドラゴンならもう1枚マナへ" } ];

    default:
      console.warn(`⚠ 未対応の旧ステップ: ${t}`);
      return keep({ type: t });
  }
}
function stripCommon(s) {
  const out = {};
  if (s.label) out.label = s.label;
  if (s.optional) out.optional = s.optional;
  return out;
}

// 単純効果 → effects 配列
function convertSimple(eff) {
  const t = eff.type, target = eff.target, amount = eff.amount;
  switch (t) {
    case "draw": {
      const arr = [{ type: "drawCards", amount: amount ?? 1 }];
      if (eff.thenDiscard > 0) arr.push({ type: "handToGrave", target: "self", amount: eff.thenDiscard, label: "手札を捨てる" });
      return arr;
    }
    case "destroy":      return [{ type: "destroy", target: target || "opponent", amount: amount ?? 1 }];
    case "destroyUnder": return [{ type: "destroy", target: target || "opponent", all: true, filter: { maxPower: eff.threshold } }];
    case "handDestroy":  return [{ type: "handToGrave", target: target || "opponent", amount: amount ?? 1 }];
    case "sendToMana":   return [{ type: "bzToMana", target: target || "opponent", amount: amount ?? 1 }];
    case "bounce":       return [{ type: "bzToHand", target: target || "opponent", amount: amount ?? 1 }];
    case "manaReturn":   return [{ type: "manaToHand", target: target || "self", amount: amount ?? 1, ...(eff.optional ? { optional: true } : {}) }];
    case "deckSearch":   return [{ type: "search", destination: "hand", amount: amount ?? 1 }];
    case "tapAll":       return [{ type: "tap", target: target || "opponent", all: true }];
    case "deckToMana":   return [{ type: "topToMana", amount: amount ?? 1 }];
    default:
      console.warn(`⚠ 未対応の単純効果: ${t}`);
      return [{ type: t }];
  }
}

// 効果セット（autoEffect / triggers[].effect / finalRevolution.effect）を変換
function convertEffectSet(eff) {
  if (!eff || typeof eff !== "object") return eff;
  if (eff.type === "steps") {
    const out = { ...eff, effects: (eff.steps || []).flatMap(convertStep) };
    delete out.type; delete out.steps;
    return out;
  }
  if (eff.type === "chooseTimes") {
    return { ...eff, templates: (eff.templates || []).map(t => {
      const nt = { ...t, effects: (t.steps || []).flatMap(convertStep) };
      delete nt.steps; return nt;
    }) };
  }
  // 単純効果
  const out = { effects: convertSimple(eff) };
  if (eff.trigger) out.trigger = eff.trigger;
  return out;
}

const txt = fs.readFileSync(CARDS, "utf8");
const cards = JSON.parse(txt);
let countEffectsBefore = 0, countEffectsAfter = 0;
const countSet = (eff, key) => {
  if (!eff) return 0;
  if (key === "before") return eff.type === "steps" ? (eff.steps || []).length : eff.type === "chooseTimes" ? (eff.templates || []).reduce((a, t) => a + (t.steps || []).length, 0) : 1;
  return eff.effects ? eff.effects.length : eff.type === "chooseTimes" ? (eff.templates || []).reduce((a, t) => a + (t.effects || []).length, 0) : 0;
};

for (const c of cards) {
  countEffectsBefore += countSet(c.autoEffect, "before");
  if (c.autoEffect) c.autoEffect = convertEffectSet(c.autoEffect);
  if (c.spellSide?.autoEffect) c.spellSide.autoEffect = convertEffectSet(c.spellSide.autoEffect);
  if (c.finalRevolution?.effect) {
    const conv = convertEffectSet(c.finalRevolution.effect);
    c.finalRevolution = { ...c.finalRevolution, effects: conv.effects };
    delete c.finalRevolution.effect;
  }
  if (c.triggers) {
    c.triggers = c.triggers.map(tr => {
      const conv = convertEffectSet(tr.effect);
      const nt = { ...tr, effects: conv.effects };
      if (conv.templates) { nt.type = "chooseTimes"; nt.templates = conv.templates; delete nt.effects; }
      delete nt.effect;
      return nt;
    });
  }
  countEffectsAfter += countSet(c.autoEffect, "after");
}

fs.writeFileSync(CARDS, JSON.stringify(cards, null, 2) + "\n");
console.log(`✅ 移行完了: ${cards.length}枚`);
console.log(`   autoEffect の効果要素数: 変換前 ${countEffectsBefore} → 変換後 ${countEffectsAfter}（変数ステップ追加分だけ増えます）`);
