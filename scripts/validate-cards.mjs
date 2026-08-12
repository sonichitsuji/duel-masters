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
const TYPES = new Set(["creature","evo_creature","spell","twinpact","tamaseed","castle","field"]);
const CIVS = new Set(["light","water","darkness","fire","nature"]);
const KEYWORDS = new Set(["speedAttacker","wBreaker","tBreaker","blocker","cantAttack","sTrigger","drawOnPlay","revolutionChange","gStrike","charger","zRush","escape","slayer","guardman","unselectable","machFighter","worldBreaker","justDiver","unattackable"]);
const TRIGGER_ONS = new Set(["creaturePutBz","castSpell","leave","destroyed","battleDestroy","battleWin","attack","attackEnd","draw","discard","shieldAdded","shieldLeave","startOfTurn","endOfTurn"]);
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
  "handToBz","handToShield","handToGrave","handToHyper","playFromHand",
  // マナから
  "manaToBz","manaToHand","manaToGrave",
  // バトルゾーンから
  "destroy","bzToHand","bzToMana","bzToShield","tap","untap","tapToggle","untapAllMana","powerBuff","grant","battle",
  // 墓地・シールド
  "graveToBz","graveToHand","graveToDeck","graveToDeckBottom","shieldToHand","shieldToGrave","breakShield",
  // 呪文封じ
  "denySpell",
  // 山札操作
  "shuffleDeck",
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
  "keywords","triggers","activated","summonFrom","freeCast","replaceLose","replaceLeave","costReduce","condPower","grantKeywords","grantPowerBoost",
  "grantPowerBoostGrave","selfPowerBoostGrave","powerAttacker","poweredBreaker",
  "hyperKeywords","hyperPower",
]);
const SUMMON_ZONES = new Set(["grave","mana"]);
const COST_REDUCE_ZONES = new Set(["bz","shield","mana","grave","hand"]);
// 「〜1枚につき」の数え上げ対象ゾーン（countCardsInZone / count ステップ）
const COUNT_ZONES = new Set(["bz","shield","mana","grave","hand","deck"]);
// costReduce.amountPer 専用。「今回の召喚で重ねる進化元の枚数」を数える
const AMOUNT_PER_ZONES = new Set([...COUNT_ZONES, "evolutionBase"]);
const EVOLUTION_ZONES = new Set(["bz","grave","mana"]);
const METEOR_BURN_TO = new Set(["grave","mana","hand","shield","deck"]);
// count(数値)を要する condition。
const CONDITION_TYPES = new Set(["civicCount","stackCount"]);
// min/max で枚数の範囲を書く condition（count は取らない）。
const RANGE_CONDITION_TYPES = new Set(["shieldCount","shieldsBroken"]);
// 引数を取らない condition。
const COUNTLESS_CONDITION_TYPES = new Set(["oniEnd"]);
// 相手の盤面を見る condition は triggers / activated でしか書けない
// （継続能力の評価経路は otherState を受け取らないため）。
const CONDITION_WHO = ["self","opponent","any"];
const ACTIVATED_TIMINGS = new Set(["ownTurn","any"]);
const LOSE_CAUSES = new Set(["deckOut"]);
const LEAVE_TO = new Set(["mana","hand","shield","deck"]);
// playFromHand で唱えられる（＝出せる）元のゾーン
const PLAY_FROM_ZONES = new Set(["hand","grave"]);
// spellAfterCast: 唱えた後、墓地のかわりに置く場所と、その対象になる「唱えたゾーン」
const SPELL_AFTER_CAST_TO = new Set(["deckBottom","deckTop","hand","mana","shield"]);
const SPELL_AFTER_CAST_FROM = new Set(["hand","grave","any"]);
// denySpell の期限
const DENY_SPELL_UNTIL = new Set(["endOfNextTurn"]);
// staticDeny の種類
const STATIC_DENY_TYPES = new Set(["cantPutCreature","cantPutCreatureFromNonHand","cantCastSpell"]);

// 効果ステップに書けるキー。綴り違い（takeall / oneplayer など）を弾くために使う。
// 出典: src/engine/effects.js の effect.X 参照。新しいキーを実装したらここにも足すこと。
const EFFECT_KEYS = new Set([
  "type","label","target","zone","filter","amount","count","maxSelect",
  "all","any","takeAll","random","order","as","optional","ifPrevious","onlyIf","subject","selfFrom","onePlayer",
  "asCost","canUseTrigger","choosePlayer","side","until",
  "self","owner","destination","to","tapped","free","reason","timing","maxPerTurn",
  "perUnit","expires","keywords","tempKeyword","tempKeywords","summoningSickness",
  "destroyAtEndOfTurn","noUntapNextTurn","untapAfterAttack","untap",
]);
// filter に書けるキー（engine/effects.js の matchFilter ＋ gameLogic.js の matchCardFilter）
const FILTER_KEYS = new Set([
  "side","civ","civNot","raceContains","nameContains","notNameSelf","keyword","multiColor",
  "element","elementOnly","creatureOnly","notSelf","tapped","hasCip","type","self",
  "cost","maxCost","minCost","maxPower","minPower",
]);
function checkFilterKeys(filter, where) {
  if (!filter || typeof filter !== "object") return;
  for (const k of Object.keys(filter)) {
    if (!FILTER_KEYS.has(k)) errors.push(`${where}.filter: 未知のキー "${k}"（綴り違い？）`);
  }
}

const errors = [];
const warnings = [];

const cardsPath = path.join(root, "public", "cards.json");
let cards;
try { cards = JSON.parse(fs.readFileSync(cardsPath, "utf8")); }
catch (e) { console.error("❌ cards.json のJSONが不正:", e.message); process.exit(1); }

// steps/effect の再帰検証
function checkOne(e, where) {
  if (!e || !e.type) { errors.push(`${where}: type の無い効果要素`); return; }
  for (const k of Object.keys(e)) {
    if (!EFFECT_KEYS.has(k)) errors.push(`${where}: 効果ステップの未知のキー "${k}"（綴り違い？）`);
  }
  checkFilterKeys(e.filter, where);
  if (LEGACY_TYPES.has(e.type)) errors.push(`${where}: 旧記法の効果 "${e.type}"（新語彙へ移行してください）`);
  else if (!EFFECT_TYPES.has(e.type)) errors.push(`${where}: 未知の効果type "${e.type}"`);
  if (e.target && !["self","opponent","both"].includes(e.target)) errors.push(`${where}: 未知のtarget "${e.target}"`);
  if (e.type === "grantSummonFrom" && !SUMMON_ZONES.has(e.zone)) errors.push(`${where}: grantSummonFrom の zone は ${[...SUMMON_ZONES].join("/")}`);
  if (e.order && !["shuffle", "choose"].includes(e.order)) errors.push(`${where}: order は "shuffle" か "choose"`);
  if (e.onlyIf != null) {
    if (typeof e.onlyIf !== "object" || Array.isArray(e.onlyIf)) errors.push(`${where}: onlyIf はオブジェクト`);
    else {
      for (const k of Object.keys(e.onlyIf)) if (!["count","min","max"].includes(k)) errors.push(`${where}.onlyIf: 未知のキー "${k}"`);
      if (e.onlyIf.count == null) errors.push(`${where}.onlyIf: count（変数名）が必要です`);
      if (e.onlyIf.min == null && e.onlyIf.max == null) errors.push(`${where}.onlyIf: min か max が必要です`);
    }
  }
  if (e.asCost != null && e.type !== "destroy") errors.push(`${where}: asCost は type:"destroy" でのみ使えます`);
  if (e.choosePlayer != null) {
    if (typeof e.choosePlayer !== "boolean") errors.push(`${where}: choosePlayer は真偽値`);
    else if (e.choosePlayer) {
      if (e.target !== "both") errors.push(`${where}: choosePlayer は target:"both" と一緒に使います（どちらのプレイヤーも選べるため）`);
      if (e.onePlayer) errors.push(`${where}: choosePlayer と onePlayer は併用できません（前者はプレイヤーを、後者はカードを選ばせる）`);
    }
  }
  if (e.canUseTrigger != null) {
    if (e.type !== "shieldToHand") errors.push(`${where}: canUseTrigger は type:"shieldToHand" でのみ使えます（他のゾーンへ動かす時はS・トリガーを使えません）`);
    else if (typeof e.canUseTrigger !== "boolean") errors.push(`${where}: canUseTrigger は真偽値`);
  }
  if (e.selfFrom != null) {
    if (e.type !== "battle") errors.push(`${where}: selfFrom は type:"battle" でのみ使えます`);
    else if (e.selfFrom !== "lastPut") errors.push(`${where}: selfFrom は "lastPut" のみ`);
  }
  if (e.side != null) {
    if (e.type !== "playFromHand") errors.push(`${where}: side は type:"playFromHand" でのみ使えます（ツインパクトのどちらの面で唱えるか）`);
    else if (!["creature","spell"].includes(e.side)) errors.push(`${where}: side は "creature" か "spell"`);
  }
  if (e.type === "playFromHand" && e.zone != null && !PLAY_FROM_ZONES.has(e.zone)) {
    errors.push(`${where}: playFromHand の zone は ${[...PLAY_FROM_ZONES].join("/")}`);
  }
  if (e.until != null && e.type !== "denySpell") errors.push(`${where}: until は type:"denySpell" でのみ使えます`);
  if (e.type === "denySpell" && e.until != null && !DENY_SPELL_UNTIL.has(e.until)) {
    errors.push(`${where}: denySpell の until は ${[...DENY_SPELL_UNTIL].join("/")}`);
  }
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
      // 「そうしたら」は直前のステップに依存するので、先頭には置けない
      if (e?.ifPrevious && i === 0) errors.push(`${where}: 先頭のステップに ifPrevious は指定できません（直前のステップがありません）`);
      if (e?.ifPrevious != null && typeof e.ifPrevious !== "boolean") errors.push(`${where}: ifPrevious は真偽値`);
    });
    return;
  }
  if (eff.type) errors.push(`${where}: 単純効果 "${eff.type}" は廃止（effects 配列へ）`);
}

// allowBothSides: 相手の盤面も見られる文脈か（triggers / activated）。
// who が "opponent"/"any" の条件は継続能力（condPower / grantKeywords）には書けない。
function checkCondition(cond, where, allowBothSides = false) {
  if (!cond || typeof cond !== "object") return;
  if (cond.flag) return; // 任意のプレイヤー状態フラグ
  if (!cond.type) { errors.push(`${where}: condition に type も flag もありません`); return; }
  const needsOpponent = cond.who === "opponent" || cond.who === "any" || COUNTLESS_CONDITION_TYPES.has(cond.type);
  if (needsOpponent && !allowBothSides) {
    errors.push(`${where}: 相手の盤面を見る condition は triggers / activated でのみ使えます`);
  }
  if (COUNTLESS_CONDITION_TYPES.has(cond.type)) return;
  if (RANGE_CONDITION_TYPES.has(cond.type)) {
    if (cond.who != null && !CONDITION_WHO.includes(cond.who)) errors.push(`${where}: condition の who は ${CONDITION_WHO.join("/")}`);
    if (cond.min == null && cond.max == null) errors.push(`${where}: condition "${cond.type}" に min か max が必要です`);
    for (const k of ["min","max"]) if (cond[k] != null && typeof cond[k] !== "number") errors.push(`${where}: condition の ${k} は数値`);
    return;
  }
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
  if (tr.lastCard != null) {
    if (typeof tr.lastCard !== "boolean") errors.push(`${where}(${tr.on}): lastCard は真偽値`);
    if (tr.on !== "draw") errors.push(`${where}(${tr.on}): lastCard は on:"draw" でのみ使えます`);
  }
  if (tr.oncePerGame != null && typeof tr.oncePerGame !== "boolean") errors.push(`${where}(${tr.on}): oncePerGame は真偽値`);
  if (tr.fromZone != null) {
    if (tr.on !== "castSpell") errors.push(`${where}(${tr.on}): fromZone は on:"castSpell" でのみ使えます`);
    else if (!PLAY_FROM_ZONES.has(tr.fromZone)) errors.push(`${where}(${tr.on}): fromZone は ${[...PLAY_FROM_ZONES].join("/")}`);
  }
  checkCondition(tr.condition, `${where}(${tr.on})`, true);
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
    checkCondition(ab.condition, w, true);
  });
}

// カード直下 / ssx 内の共通能力フィールド検証
function checkAbilityFields(obj, where) {
  for (const k of obj.keywords || []) if (!KEYWORDS.has(k)) errors.push(`${where}: 未知のkeyword "${k}"`);
  for (const k of obj.hyperKeywords || []) if (!KEYWORDS.has(k)) errors.push(`${where}: 未知のhyperKeyword "${k}"`);
  for (const tr of obj.triggers || []) checkTrigger(tr, where);
  if (obj.activated) checkActivated(obj.activated, where);
  if (obj.summonFrom) checkSummonFrom(obj.summonFrom, where);
  if (obj.replaceLose) {
    if (!Array.isArray(obj.replaceLose)) errors.push(`${where}.replaceLose: 配列である必要があります`);
    else obj.replaceLose.forEach((r, i) => {
      const w = `${where}.replaceLose[${i}]`;
      if (r.from != null && !LOSE_CAUSES.has(r.from)) errors.push(`${w}: 未知の from "${r.from}"（${[...LOSE_CAUSES].join("/")}）`);
      if (r.to != null && r.to !== "win") errors.push(`${w}: to は "win" のみ`);
    });
  }
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
  // replaceLeave: 「離れる時、かわりに〜へ置く」
  const rls = obj.replaceLeave == null ? [] : (Array.isArray(obj.replaceLeave) ? obj.replaceLeave : [obj.replaceLeave]);
  for (const rl of rls) {
    if (typeof rl !== "object" || rl == null) { errors.push(`${where}.replaceLeave: オブジェクトで書いてください`); continue; }
    if (!LEAVE_TO.has(rl.to || "mana")) errors.push(`${where}.replaceLeave: to は ${[...LEAVE_TO].join("/")}`);
    if (rl.filter != null && typeof rl.filter !== "object") errors.push(`${where}.replaceLeave: filter はオブジェクト`);
  }
  // oniEnd: 鬼エンド（手札から、コストを支払わずにプレイする）
  if (obj.oniEnd != null) {
    const oe = obj.oniEnd;
    if (typeof oe !== "object" || Array.isArray(oe)) errors.push(`${where}.oniEnd: オブジェクトで書いてください`);
    else {
      for (const k of Object.keys(oe)) {
        if (!["on", "target", "manaHas"].includes(k)) errors.push(`${where}.oniEnd: 未知のキー "${k}"（綴り違い？）`);
      }
      if (oe.on != null && !TRIGGER_ONS.has(oe.on)) errors.push(`${where}.oniEnd: 未知の on "${oe.on}"`);
      if (oe.target != null && !TRIGGER_SCOPES.includes(oe.target)) errors.push(`${where}.oniEnd: 未知の target "${oe.target}"`);
      if (oe.target === "this") errors.push(`${where}.oniEnd: 手札のカードなので target:"this" は使えません`);
      if (oe.manaHas != null) {
        if (!Array.isArray(oe.manaHas)) errors.push(`${where}.oniEnd.manaHas: 配列である必要があります`);
        else oe.manaHas.forEach((f, i) => checkFilterKeys(f, `${where}.oniEnd.manaHas[${i}]`));
      }
    }
  }
  // revolutionChangeCond: 革命チェンジの条件（PlayerBoard の判定に合わせる。raceContains ではなく race/races）
  if (obj.revolutionChangeCond != null) {
    const rc = obj.revolutionChangeCond;
    if (typeof rc !== "object" || Array.isArray(rc)) errors.push(`${where}.revolutionChangeCond: オブジェクトで書いてください`);
    else for (const k of Object.keys(rc)) {
      if (!["civs", "race", "races", "minCost", "minPower", "multiColor", "nameContains"].includes(k)) {
        errors.push(`${where}.revolutionChangeCond: 未知のキー "${k}"（種族は race / races）`);
      }
    }
  }
  // spellAfterCast: 唱えた後の行き先の置換（「墓地のかわりに山札の下に置く」）
  const sacs = obj.spellAfterCast == null ? [] : (Array.isArray(obj.spellAfterCast) ? obj.spellAfterCast : [obj.spellAfterCast]);
  for (const r of sacs) {
    if (typeof r !== "object" || r == null) { errors.push(`${where}.spellAfterCast: オブジェクトで書いてください`); continue; }
    for (const k of Object.keys(r)) {
      if (!["from", "to", "filter"].includes(k)) errors.push(`${where}.spellAfterCast: 未知のキー "${k}"（綴り違い？）`);
    }
    if (r.from != null && !SPELL_AFTER_CAST_FROM.has(r.from)) errors.push(`${where}.spellAfterCast: from は ${[...SPELL_AFTER_CAST_FROM].join("/")}`);
    if (!SPELL_AFTER_CAST_TO.has(r.to || "deckBottom")) errors.push(`${where}.spellAfterCast: to は ${[...SPELL_AFTER_CAST_TO].join("/")}`);
    checkFilterKeys(r.filter, `${where}.spellAfterCast`);
  }
  // staticDeny: 相手のプレイを止める常在型能力
  if (obj.staticDeny != null) {
    const d = obj.staticDeny;
    if (typeof d !== "object" || Array.isArray(d)) errors.push(`${where}.staticDeny: オブジェクトで書いてください`);
    else {
      for (const k of Object.keys(d)) {
        if (!["type", "filter", "label"].includes(k)) errors.push(`${where}.staticDeny: 未知のキー "${k}"（綴り違い？）`);
      }
      if (!STATIC_DENY_TYPES.has(d.type)) errors.push(`${where}.staticDeny: 未知の type "${d.type}"（${[...STATIC_DENY_TYPES].join("/")}）`);
      checkFilterKeys(d.filter, `${where}.staticDeny`);
    }
  }
  // ddd: D・D・D（手札から、指定のコストを支払ってプレイする）
  if (obj.ddd != null) {
    const d = obj.ddd;
    if (typeof d !== "object" || Array.isArray(d)) errors.push(`${where}.ddd: オブジェクトで書いてください`);
    else {
      for (const k of Object.keys(d)) {
        if (!["on", "target", "cost"].includes(k)) errors.push(`${where}.ddd: 未知のキー "${k}"（綴り違い？）`);
      }
      if (d.on != null && !TRIGGER_ONS.has(d.on)) errors.push(`${where}.ddd: 未知の on "${d.on}"`);
      if (d.target != null && !TRIGGER_SCOPES.includes(d.target)) errors.push(`${where}.ddd: 未知の target "${d.target}"`);
      if (d.target === "this") errors.push(`${where}.ddd: 手札のカードなので target:"this" は使えません`);
      // cost は alternateCost と同じ形（{cost, civs}）。支払いが本体なので必須にする
      if (typeof d.cost !== "object" || d.cost == null || Array.isArray(d.cost)) {
        errors.push(`${where}.ddd: cost（{cost, civs} のオブジェクト）が必要です`);
      } else {
        for (const k of Object.keys(d.cost)) {
          if (!["cost", "civs"].includes(k)) errors.push(`${where}.ddd.cost: 未知のキー "${k}"（綴り違い？）`);
        }
        if (typeof d.cost.cost !== "number") errors.push(`${where}.ddd.cost: cost（数値）が必要です`);
        if (d.cost.civs != null) {
          if (!Array.isArray(d.cost.civs)) errors.push(`${where}.ddd.cost.civs: 配列である必要があります`);
          else for (const cv of d.cost.civs) if (!CIVS.has(cv)) errors.push(`${where}.ddd.cost.civs: 未知のciv "${cv}"`);
        }
      }
    }
  }
  // freeCast: コストを支払わずにプレイできる許可（バトルゾーン／表向きシールドで有効）
  const fcs = obj.freeCast == null ? [] : (Array.isArray(obj.freeCast) ? obj.freeCast : [obj.freeCast]);
  for (const fc of fcs) {
    if (typeof fc !== "object" || fc == null) { errors.push(`${where}.freeCast: オブジェクトで書いてください`); continue; }
    if (fc.timing != null && !["ownTurn", "any"].includes(fc.timing)) errors.push(`${where}.freeCast: 未知のtiming "${fc.timing}"`);
    if (fc.filter != null && typeof fc.filter !== "object") errors.push(`${where}.freeCast: filter はオブジェクト`);
  }
  const cr = obj.costReduce;
  if (cr) {
    for (const z of cr.zones || []) if (!COST_REDUCE_ZONES.has(z)) errors.push(`${where}.costReduce: 未知のzone "${z}"`);
    if (cr.amount == null && cr.amountPer == null) errors.push(`${where}.costReduce: amount か amountPer が必要です`);
    if (cr.amount != null && typeof cr.amount !== "number") errors.push(`${where}.costReduce: amount は数値`);
    if (cr.amountPer && !AMOUNT_PER_ZONES.has(cr.amountPer.zone)) errors.push(`${where}.costReduce.amountPer: 未知のzone "${cr.amountPer.zone}"`);
    checkCondition(cr.condition, `${where}.costReduce`);
  }
}

// カード直下に書けるキー。ABILITY_KEYS（ssx にも書ける能力）に、カード固有のものを足したもの。
// ここに無いキーはエラーにして、綴り違いが静かに無視されるのを防ぐ。
const CARD_KEYS = new Set([...ABILITY_KEYS,
  "id","name","race","cost","power","type","civ","effect","autoEffect",
  "evolution","ssx","spellSide","finalRevolution","revolutionChangeCond","gZero",
  "alternateCost","oniEnd","ddd","staticDeny","reactivePassive","spellAfterCast",
  // ハイパーモード関連
  "hyperMode","hyperOnAttack","hyperOnTargeted","hyperUnlock","zRush",
  // その他の常在・置換
  "cantAttackPlayer","faceUpLeaveTo","endOfTurnEffect",
]);

const seenIds = new Map();
const seenNames = new Map();
for (const c of cards) {
  const tag = `id=${c.id}(${c.name})`;
  if (seenIds.has(c.id)) errors.push(`id重複: ${c.id}（${seenIds.get(c.id)} と ${c.name}）`);
  seenIds.set(c.id, c.name);
  if (seenNames.has(c.name)) warnings.push(`name重複: "${c.name}"（id ${seenNames.get(c.name)} と ${c.id}）`);
  seenNames.set(c.name, c.id);

  // power を持たない種別（呪文・タマシード・城・フィールド）は power 必須から外す
  const NO_POWER = new Set(["spell", "tamaseed", "castle", "field"]);
  const required = ["id","name","type","civ","cost","keywords","effect"];
  if (!NO_POWER.has(c.type)) required.push("power");
  for (const k of required) if (!(k in c)) errors.push(`${tag}: 必須フィールド欠落 "${k}"`);
  for (const k of Object.keys(c)) if (!CARD_KEYS.has(k)) errors.push(`${tag}: カード直下の未知のキー "${k}"（綴り違い？）`);
  if (c.type && !TYPES.has(c.type)) errors.push(`${tag}: 未知のtype "${c.type}"`);
  if (c.type === "field" && c.power != null) warnings.push(`${tag}: フィールドにパワーはありません`);
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
