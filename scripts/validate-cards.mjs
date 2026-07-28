#!/usr/bin/env node
// cards.json とデッキの整合性を検証する。
//  - JSONの妥当性 / id・nameの重複 / type・keyword の未知値
//  - triggers[].on の未知値 / steps[].type・単純効果type の未知値（autoEffect/triggers/chooseTimes/finalRevolution/spellSide を再帰）
//  - decks.js の参照id が存在するか
// 語彙は src の実装に合わせて更新すること（出典はコメント参照）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// --- 実装済み語彙（出典: constants.js / engine/steps.js / engine/effects.js / screens/BattleScreen.jsx） ---
const TYPES = new Set(["creature","evo_creature","spell","twinpact","tamaseed","castle"]);
const KEYWORDS = new Set(["speedAttacker","wBreaker","tBreaker","blocker","cantAttack","sTrigger","drawOnPlay","revolutionChange","gStrike","charger","zRush","escape","slayer"]);
const TRIGGER_ONS = new Set(["creaturePutBz","castSpell","leave","destroyed","battleDestroy","attack","draw","discard","shieldAdded","shieldLeave","endOfTurn"]);
const TRIGGER_SCOPES = ["this","self","opponent","both"];
// 旧トリガー名（廃止済み）
const LEGACY_ONS = new Set(["selfCreaturePlay","opponentCreaturePlay","ownCreatureAttack","selfDraw","opponentDiscard",
  "selfCreatureLeave","opponentCreatureLeave","selfBattleDestroy","opponentBattleDestroy",
  "selfCreatureDestroyed","opponentCreatureDestroyed","creatureEnter"]);
const EFFECT_TYPES = new Set([
  // 変数ステップ
  "count","pick",
  // ドロー/山札
  "drawCards","reveal","search","topToGrave","topToMana","topToShield",
  // 公開カードの行き先
  "revealedToHand","revealedToBz","revealedToMana","revealedToGrave","revealedToDeckTop","revealedToDeckBottom",
  // 手札から
  "handToBz","handToShield","handToGrave","playFromHand",
  // マナから
  "manaToBz","manaToHand",
  // バトルゾーンから
  "destroy","bzToHand","bzToMana","bzToShield","tap","untap","tapToggle","untapAllMana","powerBuff","grant","battle",
  // 墓地・シールド
  "graveToBz","shieldToHand","shieldToGrave","breakShield",
  // 遅延
  "scheduleReviveSubjectEndOfTurn",
]);
// 旧記法（廃止済み）。見つかったらエラーにする
const LEGACY_TYPES = new Set(["draw","destroyUnder","handDestroy","sendToMana","bounce","manaReturn","deckSearch","tapAll","deckToMana",
  "revealDeckTop","chooseFromRevealed","restRevealedToBottom","millTop","millTopToMana","millTopToManaIfDragon","searchSpellToTop",
  "drawPerFilter","drawCardsPerTappedOpponent","discardHandDrawPlusOne","playFromRevealed","putFilteredFromHand","playLightCreatureFromHand",
  "castFilteredSpellFromHand","castFreeSTriggerSpellFromHand","putFromHandFreeUnderHandCount","reviveFilteredFromGrave","reviveSelfFromGrave",
  "reviveFromDestroyedOwnerGrave","optionalReviveFromMilled","bounceSelectCreature","bounceElement","bounceMaxCost","bzSelectToMana",
  "manaCreatureSelectToBZ","destroyChooseAny","destroyNonColor","tapAllOpponent","tapSelectCreature","tapNoUntapNextTurn",
  "tapOrUntapSelectCreature","untapSelectCreature","battleOpponentCreature","breakOpponentShieldChoice","debuffOpponentPower",
  "grantTempBuffToSelf","setUntapAfterAttack","grantSAUntapAfterAttack","shieldizeTopDeck","shieldizeFromHand","shieldizeOpponentCreature",
  "returnShieldToHand","selectShieldToGrave","handDiscard","randomDiscardOpponent"]);

const errors = [];
const warnings = [];

const cardsPath = path.join(root, "public", "cards.json");
let cards;
try { cards = JSON.parse(fs.readFileSync(cardsPath, "utf8")); }
catch (e) { console.error("❌ cards.json のJSONが不正:", e.message); process.exit(1); }

// steps/effect の再帰検証
function checkOne(e, where) {
  if (!e || !e.type) { errors.push(`${where}: type の無い効果要素`); return; }
  if (LEGACY_TYPES.has(e.type)) errors.push(`${where}: 旧記法の効果 "${e.type}"（新語彙へ移行してください）`);
  else if (!EFFECT_TYPES.has(e.type)) errors.push(`${where}: 未知の効果type "${e.type}"`);
  if (e.target && !["self","opponent","both"].includes(e.target)) errors.push(`${where}: 未知のtarget "${e.target}"`);
}
function checkEffect(eff, where) {
  if (!eff || typeof eff !== "object") return;
  if (eff.type === "steps" || eff.steps) { errors.push(`${where}: 旧記法 type:"steps"/steps は廃止（effects へ）`); return; }
  if (eff.type === "chooseTimes") {
    for (const t of eff.templates || []) {
      if (t.steps) { errors.push(`${where}: templates 内が旧記法 steps`); continue; }
      for (const e of t.effects || []) checkOne(e, where);
    }
    return;
  }
  if (eff.effects) { for (const e of eff.effects) checkOne(e, where); return; }
  if (eff.type) errors.push(`${where}: 単純効果 "${eff.type}" は廃止（effects 配列へ）`);
}

const seenIds = new Map();
const seenNames = new Map();
for (const c of cards) {
  const tag = `id=${c.id}(${c.name})`;
  if (seenIds.has(c.id)) errors.push(`id重複: ${c.id}（${seenIds.get(c.id)} と ${c.name}）`);
  seenIds.set(c.id, c.name);
  if (seenNames.has(c.name)) warnings.push(`name重複: "${c.name}"（id ${seenNames.get(c.name)} と ${c.id}）`);
  seenNames.set(c.name, c.id);

  for (const k of ["id","name","type","civ","cost","power","keywords","effect"]) if (!(k in c)) errors.push(`${tag}: 必須フィールド欠落 "${k}"`);
  if (c.type && !TYPES.has(c.type)) errors.push(`${tag}: 未知のtype "${c.type}"`);
  for (const k of c.keywords || []) if (!KEYWORDS.has(k)) errors.push(`${tag}: 未知のkeyword "${k}"`);
  const civs = Array.isArray(c.civ) ? c.civ : [c.civ];
  for (const cv of civs) if (!["light","water","darkness","fire","nature"].includes(cv)) errors.push(`${tag}: 未知のciv "${cv}"`);

  // 超魂X(SSX): keywords は既知のもの、triggers は通常トリガーと同じ検証
  if (c.ssx) {
    if (typeof c.ssx !== "object" || Array.isArray(c.ssx)) errors.push(`${tag}.ssx: オブジェクトである必要があります`);
    for (const k of c.ssx.keywords || []) if (!KEYWORDS.has(k)) errors.push(`${tag}.ssx: 未知のkeyword "${k}"`);
    for (const tr of c.ssx.triggers || []) {
      if (LEGACY_ONS.has(tr.on)) errors.push(`${tag}.ssx: 旧トリガー名 "${tr.on}"`);
      else if (!TRIGGER_ONS.has(tr.on)) errors.push(`${tag}.ssx: 未知のtrigger on "${tr.on}"`);
      checkEffect(tr, `${tag}.ssx.triggers(${tr.on})`);
    }
    if (!c.ssx.keywords && !c.ssx.triggers) warnings.push(`${tag}.ssx: keywords も triggers もありません`);
  }
  checkEffect(c.autoEffect, `${tag}.autoEffect`);
  checkEffect(c.spellSide?.autoEffect, `${tag}.spellSide`);
  checkEffect(c.finalRevolution, `${tag}.finalRevolution`);
  for (const tr of c.triggers || []) {
    if (LEGACY_ONS.has(tr.on)) errors.push(`${tag}: 旧トリガー名 "${tr.on}"（on＋target 形式へ移行してください）`);
    else if (!TRIGGER_ONS.has(tr.on)) errors.push(`${tag}: 未知のtrigger on "${tr.on}"`);
    if (tr.target && !TRIGGER_SCOPES.includes(tr.target)) errors.push(`${tag}.triggers(${tr.on}): 未知のtarget "${tr.target}"`);
    if (tr.method && !["summon","put"].includes(tr.method)) errors.push(`${tag}.triggers(${tr.on}): 未知のmethod "${tr.method}"`);
    if (tr.effect) errors.push(`${tag}.triggers(${tr.on}): 旧記法 effect（effects へ）`);
    checkEffect(tr, `${tag}.triggers(${tr.on})`);
  }
}

// デッキ参照チェック
try {
  const decks = await import(path.join(root, "src", "decks.js"));
  const ids = new Set(cards.map(c => c.id));
  for (const [name, arr] of Object.entries(decks)) {
    if (!Array.isArray(arr)) continue;
    const missing = [...new Set(arr)].filter(id => !ids.has(id));
    if (missing.length) errors.push(`decks.js ${name}: 存在しないid ${missing.join(",")}`);
    if (arr.length !== 40) warnings.push(`decks.js ${name}: ${arr.length}枚（40枚でない）`);
  }
} catch (e) { warnings.push(`decks.js を検証できませんでした: ${e.message}`); }

for (const w of warnings) console.warn("⚠", w);
for (const e of errors) console.error("❌", e);
console.log(`\n${cards.length}枚を検証。エラー ${errors.length} / 警告 ${warnings.length}`);
process.exit(errors.length ? 1 : 0);
