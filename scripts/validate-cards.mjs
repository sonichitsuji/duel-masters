#!/usr/bin/env node
// cards.json とデッキの整合性を検証する。
//  - JSONの妥当性 / id・nameの重複 / type・keyword の未知値
//  - triggers[].on / effects[].type の未知値（autoEffect/triggers/activated/chooseTimes/finalRevolution/spellSide を再帰）
//  - ssx に書けるのは能力フィールドのみ / activated の形 / condition の型
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
const TRIGGER_ONS = new Set(["creaturePutBz","castSpell","leave","destroyed","battleDestroy","attack","attackEnd","draw","discard","shieldAdded","shieldLeave","endOfTurn"]);
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
  "graveToBz","graveToHand","shieldToHand","shieldToGrave","breakShield",
  // 進化元を動かすコスト / 特殊勝利
  "meteorBurn","winGame",
  // 召喚元ゾーンの拡張
  "grantSummonFrom",
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

// 能力フィールド（カード直下にも ssx 内にも書ける）。ssx はこの集合だけを許可する。
const ABILITY_KEYS = new Set([
  "keywords","triggers","activated","summonFrom","costReduce","condPower","grantKeywords","grantPowerBoost",
  "grantPowerBoostGrave","selfPowerBoostGrave","powerAttacker","poweredBreaker",
  "hyperKeywords","hyperPower",
]);
const SUMMON_ZONES = new Set(["grave","mana"]);
const COST_REDUCE_ZONES = new Set(["bz","shield","mana","grave","hand"]);
// 「〜1枚につき」の数え上げ対象ゾーン（countCardsInZone / count ステップ）
const COUNT_ZONES = new Set(["bz","shield","mana","grave","hand","deck"]);
const EVOLUTION_ZONES = new Set(["bz","grave","mana"]);
const METEOR_BURN_TO = new Set(["grave","mana","hand","shield","deck"]);
const CONDITION_TYPES = new Set(["civicCount","stackCount"]);
const ACTIVATED_TIMINGS = new Set(["ownTurn","any"]);

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
  if (e.type === "grantSummonFrom" && !SUMMON_ZONES.has(e.zone)) errors.push(`${where}: grantSummonFrom の zone は ${[...SUMMON_ZONES].join("/")}`);
  if (e.type === "meteorBurn") {
    if (e.to && !METEOR_BURN_TO.has(e.to)) errors.push(`${where}: meteorBurn の to は ${[...METEOR_BURN_TO].join("/")}`);
    if (e.count != null && typeof e.count !== "number") errors.push(`${where}: meteorBurn の count は数値`);
  }
}

// 召喚元ゾーンの拡張（墓地・マナからの召喚許可）
function checkSummonFrom(list, where) {
  if (!Array.isArray(list)) { errors.push(`${where}.summonFrom: 配列である必要があります`); return; }
  list.forEach((p, i) => {
    const w = `${where}.summonFrom[${i}]`;
    if (!p || typeof p !== "object") { errors.push(`${w}: オブジェクトである必要があります`); return; }
    if (!SUMMON_ZONES.has(p.zone)) errors.push(`${w}: zone は ${[...SUMMON_ZONES].join("/")} のいずれか`);
    if (p.timing && !ACTIVATED_TIMINGS.has(p.timing)) errors.push(`${w}: 未知の timing "${p.timing}"`);
    if (p.maxPerTurn != null && typeof p.maxPerTurn !== "number") errors.push(`${w}: maxPerTurn は数値`);
  });
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
  if (eff.effects) {
    eff.effects.forEach((e, i) => {
      checkOne(e, where);
      // meteorBurn は支払えないと以降が打ち切られるので、先頭以外に置くのは意図しにくい
      if (e?.type === "meteorBurn" && i !== 0) warnings.push(`${where}: meteorBurn は effects の先頭に置いてください（以降のステップが打ち切られます）`);
    });
    return;
  }
  if (eff.type) errors.push(`${where}: 単純効果 "${eff.type}" は廃止（effects 配列へ）`);
}

function checkCondition(cond, where) {
  if (!cond || typeof cond !== "object") return;
  if (cond.flag) return; // 任意のプレイヤー状態フラグ
  if (!cond.type) { errors.push(`${where}: condition に type も flag もありません`); return; }
  if (!CONDITION_TYPES.has(cond.type)) errors.push(`${where}: 未知の condition.type "${cond.type}"`);
  else if (typeof cond.count !== "number") errors.push(`${where}: condition "${cond.type}" に count(数値) が必要です`);
}

function checkTrigger(tr, where) {
  if (LEGACY_ONS.has(tr.on)) errors.push(`${where}: 旧トリガー名 "${tr.on}"（on＋target 形式へ移行してください）`);
  else if (!TRIGGER_ONS.has(tr.on)) errors.push(`${where}: 未知のtrigger on "${tr.on}"`);
  if (tr.target && !TRIGGER_SCOPES.includes(tr.target)) errors.push(`${where}(${tr.on}): 未知のtarget "${tr.target}"`);
  if (tr.method && !["summon","put"].includes(tr.method)) errors.push(`${where}(${tr.on}): 未知のmethod "${tr.method}"`);
  if (tr.effect) errors.push(`${where}(${tr.on}): 旧記法 effect（effects へ）`);
  if (tr.oncePerTurn != null && typeof tr.oncePerTurn !== "boolean") errors.push(`${where}(${tr.on}): oncePerTurn は真偽値`);
  if (tr.oncePerGame != null && typeof tr.oncePerGame !== "boolean") errors.push(`${where}(${tr.on}): oncePerGame は真偽値`);
  checkCondition(tr.condition, `${where}(${tr.on})`);
  checkEffect(tr, `${where}(${tr.on})`);
}

// 起動型能力（プレイヤーが任意のタイミングで使う能力）
function checkActivated(list, where) {
  if (!Array.isArray(list)) { errors.push(`${where}.activated: 配列である必要があります`); return; }
  list.forEach((ab, i) => {
    const w = `${where}.activated[${i}]`;
    if (!ab || typeof ab !== "object") { errors.push(`${w}: オブジェクトである必要があります`); return; }
    if (!Array.isArray(ab.effects) || ab.effects.length === 0) errors.push(`${w}: effects(非空配列) が必要です`);
    else for (const e of ab.effects) checkOne(e, w);
    if (ab.steps) errors.push(`${w}: 旧記法 steps は廃止（effects へ）`);
    if (ab.timing && !ACTIVATED_TIMINGS.has(ab.timing)) errors.push(`${w}: 未知の timing "${ab.timing}"`);
    if (ab.oncePerTurn != null && typeof ab.oncePerTurn !== "boolean") errors.push(`${w}: oncePerTurn は真偽値`);
    if (ab.oncePerGame != null && typeof ab.oncePerGame !== "boolean") errors.push(`${w}: oncePerGame は真偽値`);
    if (!ab.label) warnings.push(`${w}: label が無いとUIに説明が出ません`);
    checkCondition(ab.condition, w);
  });
}

// カード直下 / ssx 内の共通能力フィールド検証
function checkAbilityFields(obj, where) {
  for (const k of obj.keywords || []) if (!KEYWORDS.has(k)) errors.push(`${where}: 未知のkeyword "${k}"`);
  for (const k of obj.hyperKeywords || []) if (!KEYWORDS.has(k)) errors.push(`${where}: 未知のhyperKeyword "${k}"`);
  for (const tr of obj.triggers || []) checkTrigger(tr, where);
  if (obj.activated) checkActivated(obj.activated, where);
  if (obj.summonFrom) checkSummonFrom(obj.summonFrom, where);
  if (obj.powerAttacker != null && typeof obj.powerAttacker !== "number") errors.push(`${where}: powerAttacker は数値`);
  if (obj.poweredBreaker != null && typeof obj.poweredBreaker !== "boolean") errors.push(`${where}: poweredBreaker は真偽値`);
  for (const cp of obj.condPower || []) {
    if (typeof cp.amount !== "number") errors.push(`${where}.condPower: amount(数値) が必要です`);
    checkCondition(cp.condition, `${where}.condPower`);
  }
  for (const rule of obj.grantKeywords || []) {
    if (!KEYWORDS.has(rule.keyword)) errors.push(`${where}.grantKeywords: 未知のkeyword "${rule.keyword}"`);
    checkCondition(rule.condition, `${where}.grantKeywords`);
  }
  const cr = obj.costReduce;
  if (cr) {
    for (const z of cr.zones || []) if (!COST_REDUCE_ZONES.has(z)) errors.push(`${where}.costReduce: 未知のzone "${z}"`);
    if (cr.amount == null && cr.amountPer == null) errors.push(`${where}.costReduce: amount か amountPer が必要です`);
    if (cr.amount != null && typeof cr.amount !== "number") errors.push(`${where}.costReduce: amount は数値`);
    if (cr.amountPer && !COUNT_ZONES.has(cr.amountPer.zone)) errors.push(`${where}.costReduce.amountPer: 未知のzone "${cr.amountPer.zone}"`);
    checkCondition(cr.condition, `${where}.costReduce`);
  }
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
  const civs = Array.isArray(c.civ) ? c.civ : [c.civ];
  for (const cv of civs) if (!["light","water","darkness","fire","nature"].includes(cv)) errors.push(`${tag}: 未知のciv "${cv}"`);

  // カード直下の能力フィールド（keywords / triggers / activated / condPower / costReduce ...）
  checkAbilityFields(c, tag);

  // 進化（進化元のゾーンと枚数）
  if (c.evolution) {
    const ev = c.evolution;
    if (c.type !== "evo_creature") warnings.push(`${tag}: evolution があるのに type が "evo_creature" ではありません`);
    if (ev.civFilter != null || ev.raceContains != null)
      errors.push(`${tag}.evolution: civFilter/raceContains の直書きは廃止（filter:{civ,raceContains,…} へ移行してください）`);
    if (ev.zone != null && !EVOLUTION_ZONES.has(ev.zone)) errors.push(`${tag}.evolution: 未知の zone "${ev.zone}"（${[...EVOLUTION_ZONES].join("/")}）`);
    if (ev.count != null && ev.min != null) errors.push(`${tag}.evolution: count と min は同時に指定できません`);
    for (const k of ["count", "min"]) if (ev[k] != null && typeof ev[k] !== "number") errors.push(`${tag}.evolution: ${k} は数値`);
  }

  // 超魂X(SSX): 任意の能力フィールドを持てる。中身の検証は通常の能力と同じ
  if (c.ssx) {
    if (typeof c.ssx !== "object" || Array.isArray(c.ssx)) {
      errors.push(`${tag}.ssx: オブジェクトである必要があります`);
    } else {
      for (const k of Object.keys(c.ssx)) {
        if (!ABILITY_KEYS.has(k)) errors.push(`${tag}.ssx: "${k}" は能力フィールドではありません（ssx に書けるのは ${[...ABILITY_KEYS].join("/")}）`);
      }
      checkAbilityFields(c.ssx, `${tag}.ssx`);
      if (Object.keys(c.ssx).length === 0) warnings.push(`${tag}.ssx: 中身が空です`);
    }
  }
  checkEffect(c.autoEffect, `${tag}.autoEffect`);
  checkEffect(c.spellSide?.autoEffect, `${tag}.spellSide`);
  checkEffect(c.finalRevolution, `${tag}.finalRevolution`);
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
