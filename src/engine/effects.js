import { shuffle, extractFromBattle, extractManyFromBattle, getEffectivePower, getCardCivs, isElement, hasKeyword, isUnselectableByOpponent, hasPlayTrigger, isEvolutionCard, withJustDiver, spellDenyReason, addRestriction, cardHasRace, computeGrantedRaces, evolutionSpec, stackEvolutionBases } from "../gameLogic";
import { KEYWORD_LABELS, ZONE_LABELS } from "../constants";

// ===========================
// EFFECT ENGINE
// カード効果は effects:[ {type, ...} ] の並びとして上から順に解決する。
// 変数ステップ(count/pick)が ctx.vars に値を保存し、後続の amount 等が文字列で参照できる。
// ゾーン移動は <from>To<To>（topToMana 等）、「実行(プレイ)」は playFromHand と命名を分ける。
// ===========================

// ---- 変数解決 ----
// 数値ならそのまま、文字列なら ctx.vars を参照、
// { var:"c", plus:1 } なら変数に足し引きした値（「破壊したカードよりコストが1大きい」用）。
export function resolveAmount(ctx, val, fallback = 1) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const v = ctx?.vars?.[val];
    if (Array.isArray(v)) return v.length;
    if (typeof v === "number") return v;
    return 0;
  }
  if (val && typeof val === "object" && val.var != null) {
    return resolveAmount(ctx, val.var, 0) + (val.plus || 0);
  }
  return fallback;
}

// filter の中の数値項目を「いまの値」に固める。
// プレイヤー状態に保存されて後から matchCardFilter（ctx を持たない）で評価される
// filter に {var} 参照が入っている場合、保存する時点で数値にしておく必要がある。
const FILTER_NUMBER_KEYS = ["cost", "maxCost", "minCost", "maxPower", "minPower"];
export function freezeFilter(filter, ctx) {
  if (!filter) return filter;
  let out = null;
  for (const k of FILTER_NUMBER_KEYS) {
    const v = filter[k];
    if (v != null && typeof v !== "number") (out ||= { ...filter })[k] = resolveAmount(ctx, v, 0);
  }
  return out || filter;
}

// ---- ステップ単位の条件（onlyIf）----
// { count:"変数名", min, max } を満たさなければ、そのステップ「だけ」を飛ばす。
// ifPrevious（＝直前を実行したか）や shouldStopChain（＝以降すべて中止）とは別物。
export function stepConditionMet(step, ctx) {
  const cond = step?.onlyIf;
  if (!cond) return true;
  const n = resolveAmount(ctx, cond.count, 0);
  if (cond.min != null && n < cond.min) return false;
  if (cond.max != null && n > cond.max) return false;
  return true;
}

// ---- フィルタ ----
// civ / raceContains / nameContains / keyword / type は配列で書くと「いずれか」(OR) になる。
// 例: "civ": ["water", "darkness"] = 水または闇
const anyOf = (v, test) => (Array.isArray(v) ? v.some(test) : test(v));

// ツインパクトは「クリーチャーであり呪文でもある」ので、どちらの type にも一致する。
// プレイ中はどちらの面かが確定するので card.side("creature"/"spell") を見る。
function isCreatureSide(card) {
  if (card.side) return card.side === "creature";
  return card.type === "creature" || card.type === "evo_creature" || card.type === "twinpact";
}
function isSpellSide(card) {
  if (card.side) return card.side === "spell";
  return card.type === "spell" || card.type === "twinpact";
}
// playFromHand で「どちらの面としてプレイするか」。
// ツインパクトはクリーチャーでも呪文でもあるので、決め方を1箇所にまとめてある。
//   1) effect.side に書いてあればそれ
//   2) カードに side が付いていれば（プレイ中に確定済み）それ
//   3) filter.type が呪文/クリーチャーを指していればそれ（「呪文を1枚唱える」等）
//   4) それ以外は印刷された type（ツインパクトはクリーチャー面が既定）
function playSide(effect, card) {
  if (effect.side) return effect.side;
  if (card.side) return card.side;
  const t = effect.filter?.type;
  const types = t == null ? [] : (Array.isArray(t) ? t : [t]);
  if (types.length && types.every(x => x === "spell")) return "spell";
  if (types.length && types.every(x => x === "creature" || x === "nonEvoCreature" || x === "evo_creature")) return "creature";
  return card.type === "spell" ? "spell" : "creature";
}
// ツインパクトを呪文として唱える時の面。単体の呪文はそのまま返す。
function spellFace(card) {
  if (card.type !== "twinpact" || !card.spellSide) return card;
  return { ...card, ...card.spellSide, uid: card.uid, side: "spell" };
}

function matchesType(card, t) {
  if (t === "creature") return isCreatureSide(card);
  if (t === "nonCreature") return !isCreatureSide(card);
  if (t === "nonEvoCreature") return card.side ? card.side === "creature"
                                               : (card.type === "creature" || card.type === "twinpact");
  if (t === "spell") return isSpellSide(card);
  return card.type === t;
}

export function matchFilter(card, filter, ctx) {
  if (!filter) return true;
  const f = filter;
  // side: ツインパクトのどちらの面としてプレイしているか（"creature" / "spell"）
  if (f.side && card.side !== f.side) return false;
  const civs = getCardCivs(card);
  if (f.civ && !anyOf(f.civ, x => civs.includes(x))) return false;
  if (f.civNot && anyOf(f.civNot, x => civs.includes(x))) return false;
  if (f.raceContains && !anyOf(f.raceContains, x => cardHasRace(card, x))) return false;
  if (f.nameContains && !anyOf(f.nameContains, x => !!card.name?.includes(x))) return false;
  if (f.notNameSelf && ctx?.srcName && card.name === ctx.srcName) return false;
  // notSelf:「自分の**他の**〜」。この効果の持ち主（srcCardUid）自身を候補から除く
  if (f.notSelf && ctx?.srcCardUid && card.uid === ctx.srcCardUid) return false;
  if (f.keyword && !anyOf(f.keyword, x => hasKeyword(card, x))) return false;
  if (f.multiColor && !(Array.isArray(card.civ) && card.civ.length >= 2)) return false;
  if (f.element && !isElement(card)) return false;
  // uid:「今選んだそのカード」。選択の結果を保存する側（restrictions 等）が焼き込む
  if (f.uid && !anyOf(f.uid, u => u === card.uid)) return false;
  if (f.creatureOnly && !isCreatureSide(card)) return false;
  if (f.tapped != null && !!card.tapped !== !!f.tapped) return false;
  if (f.cost != null && card.cost !== resolveAmount(ctx, f.cost, f.cost)) return false;
  if (f.maxCost != null && !(card.cost <= resolveAmount(ctx, f.maxCost, f.maxCost))) return false;
  if (f.minCost != null && !(card.cost >= resolveAmount(ctx, f.minCost, f.minCost))) return false;
  if (f.maxPower != null && !((card.power || 0) <= resolveAmount(ctx, f.maxPower, f.maxPower))) return false;
  if (f.minPower != null && !((card.power || 0) >= resolveAmount(ctx, f.minPower, f.minPower))) return false;
  // hasCip: 「このクリーチャーが出た時」で始まる能力を持つ
  if (f.hasCip != null && hasPlayTrigger(card) !== !!f.hasCip) return false;
  // psychic: サイキック・クリーチャー（超次元ゾーンから出るクリーチャー）かどうか
  if (f.psychic != null && !!card.psychic !== !!f.psychic) return false;
  // evolution: 進化クリーチャーかどうか（type:"evo_creature" と NEO進化の両方）
  if (f.evolution != null && isEvolutionCard(card) !== !!f.evolution) return false;
  if (f.type && !anyOf(f.type, t => matchesType(card, t))) return false;
  // not: 「〜ではない」。中身は filter と同じ語彙で、1つでも一致したら弾く。
  // 配列を書けば「そのどれにも当てはまらない」＝ AND で否定する
  if (f.not && anyOf(f.not, sub => matchFilter(card, sub, ctx))) return false;
  return true;
}

// ---- ゾーン取得 ----
// ゾーン名 → プレイヤー状態のキー（カードを取り除く時に使う）
// eventCards は「その誘発の元になった出来事のカード」という疑似ゾーン（revealed / lastMoved と同じ枠）。
// 今この形で誘発するのは discard（捨てた直後なので実体は墓地にある）だけなので、
// 実際に取り除くゾーンは墓地。他の出来事に広げる時はここを見直すこと
// 盤面のゾーンではなく ctx から候補を取る疑似ゾーン
const PSEUDO_ZONES = new Set(["revealed", "lastMoved", "eventCards"]);
const ZONE_STATE_KEY = { hand: "hand", bz: "battle", battle: "battle", mana: "mana", grave: "grave", shield: "shields", deck: "deck", hyper: "hyper", eventCards: "grave" };

function zoneCards(state, zone, ctx) {
  switch (zone) {
    case "hand": return state?.hand || [];
    case "bz": case "battle": return state?.battle || [];
    case "mana": return state?.mana || [];
    case "grave": return state?.grave || [];
    case "shield": return state?.shields || [];
    case "deck": return state?.deck || [];
    case "hyper": return state?.hyper || [];
    case "revealed": return ctx?.revealed || [];
    case "lastMoved": return ctx?.lastMoved || [];
    // その誘発の元になった出来事のカード（「捨てたその呪文」など）
    case "eventCards": return ctx?.subjectCards || [];
    // メテオバーン用。スナップショットではなく「今バトルゾーンにいる」カードの下を見る。
    // 革命チェンジ等で入れ替わっていれば空 = 不発になる。
    case "under": return (state?.battle || []).find(c => c.uid === ctx?.srcCardUid)?.evolutionBase || [];
    // 「このクリーチャーに含まれるカード」= 自身＋下に敷かれたカード
    case "stack": {
      const me = (state?.battle || []).find(c => c.uid === ctx?.srcCardUid);
      return me ? [me, ...(me.evolutionBase || [])] : [];
    }
    default: return [];
  }
}

// シールドゾーンにカードが置かれたことを ctx に控える。
// 置かれたカードそのものを載せるのは、BattleScreen 側が「シールドゾーンに置く時、かわりに〜」
// （replaceShieldAdd）の置換対象を特定するため。shieldAdded の誘発もここを起点に発火する。
function noteShieldAdd(ctx, ownerPid, cards) {
  ctx.shieldAdded = [...(ctx.shieldAdded || []), { ownerPid, cards }];
}

// 効果でバトルゾーンに出たクリーチャーは召喚酔いする（DMの通常ルール）。
// 「出したターンから攻撃できる」カードだけ summoningSickness:false を書く。
// スピードアタッカー持ちは攻撃可否の判定側で除外されるので、ここは一律 true でよい。
function entersSick(effect) { return effect.summoningSickness !== false; }

// target("self"|"opponent"|"both") を pid の配列へ
// 付与された種族（grantRace）をカードに載せた写しを返す。付与が無ければそのまま返す
function withGrantedRaces(card, ownerState) {
  const races = computeGrantedRaces(card, ownerState?.battle, ownerState);
  return races.length ? { ...card, grantedRaces: races } : card;
}

// 「〜できない」系の効果名 → restrictions の kind（→ gameLogic の restrictions）
const RESTRICTION_KIND = { denySpell: "spell", denyAttackBlock: "attackBlock", limitAttackBlock: "actionLimit" };
// 制限のログ文。どれも「いつまで／誰が／何をできない」という同じ形なので1か所で組む
function restrictionLog(rule, tgt) {
  const who = tgt === "self" ? "自分" : "相手";
  const cost = rule.filter?.cost != null ? `コスト${rule.filter.cost}の` : "";
  if (rule.kind === "spell") return `次の相手のターンの終わりまで、${who}は${cost}呪文を唱えられない`;
  if (rule.kind === "attackBlock") {
    const what = rule.mode === "attack" ? "攻撃" : rule.mode === "block" ? "ブロック" : "攻撃もブロックも";
    return `次の自分のターンのはじめまで、${cost}${who}のクリーチャーは${what}できない`;
  }
  return `次の自分のターンのはじめまで、${who}は各ターンに${rule.max}回しか、クリーチャーで攻撃もブロックもできない`;
}

// eventPlayer:「そのプレイヤー」＝この誘発を起こした側（百発人形マグナム）。
// target:"both" で誘発しつつ、効果は起こした側にだけ効かせたい時に使う。
// イベントの主体が分からない場合は能力の持ち主に落とす。
function targetPids(target, ownerPid, ctx) {
  const opp = ownerPid === "p1" ? "p2" : "p1";
  if (target === "eventPlayer") return [ctx?.eventPid || ownerPid];
  if (target === "opponent") return [opp];
  if (target === "both") return [ownerPid, opp];
  return [ownerPid];
}

// 効果ごとの「選択元ゾーン」と既定 target
const SOURCE = {
  handToBz:       { zone: "hand",     target: "self" },
  handToShield:   { zone: "hand",     target: "self" },
  handToGrave:    { zone: "hand",     target: "self" },
  handToDeck:     { zone: "hand",     target: "self" },
  handToHyper:    { zone: "hand",     target: "self" },
  playFromHand:   { zone: "hand",     target: "self" },
  manaToBz:       { zone: "mana",     target: "self" },
  manaToGrave:    { zone: "mana",     target: "self" },
  manaToHand:     { zone: "mana",     target: "self" },
  bzToMana:       { zone: "bz",       target: "opponent" },
  bzToHand:       { zone: "bz",       target: "opponent" },
  bzToShield:     { zone: "bz",       target: "opponent" },
  destroy:        { zone: "bz",       target: "opponent" },
  // 「相手のクリーチャーを1体選ぶ。そのクリーチャーは〜できない」。
  // all:true なら filter に一致するすべて（＝選ばない）。destroy 等と同じ all の規約に乗せてある
  denyAttackBlock: { zone: "bz",      target: "opponent" },
  tap:            { zone: "bz",       target: "opponent" },
  untap:          { zone: "bz",       target: "self" },
  tapToggle:      { zone: "bz",       target: "both" },
  graveToBz:      { zone: "grave",    target: "self" },
  zonesToBz:      { zone: "grave",    target: "self" },   // 実際の候補は effect.zones から集める
  graveToHand:    { zone: "grave",    target: "self" },
  graveToDeck:    { zone: "grave",    target: "self" },
  graveToDeckBottom: { zone: "grave", target: "self" },
  meteorBurn:     { zone: "under",    target: "self" },
  shieldToHand:   { zone: "shield",   target: "self" },
  shieldToGrave:  { zone: "shield",   target: "self" },
  battle:         { zone: "bz",       target: "opponent" },
  breakShield:    { zone: "shield",   target: "opponent" },
  powerBuff:      { zone: "bz",       target: "opponent" },
  grant:          { zone: "bz",       target: "self" },
  pick:           { zone: "bz",       target: "self" },
  search:         { zone: "deck",     target: "self" },
  revealedToHand:     { zone: "revealed", target: "self" },
  revealedToBz:       { zone: "revealed", target: "self" },
  revealedToMana:     { zone: "revealed", target: "self" },
  revealedToGrave:    { zone: "revealed", target: "self" },
  revealedToDeckTop:  { zone: "revealed", target: "self" },
};
// 選択を要さず自動実行される効果
const AUTO_TYPES = new Set(["drawCards","reveal","topToGrave","topToMana","topToShield","count",
  "revealedToDeckBottom","scheduleReviveSubjectEndOfTurn","untapAllMana","grantSummonFrom","denySpell","limitAttackBlock","winGame","shuffleDeck"]);
// 「数字を1つ選ぶ」。カードを選ばないので候補は空だが、選択は要る
const NUMBER_CHOICE_TYPES = new Set(["chooseNumber"]);

// バトルゾーンを離れる効果と、その行き先。実行前に置換（G-NEO の除去耐性など）を挟むために使う。
export const BZ_LEAVE_DEST = {
  destroy: "grave", bzToHand: "hand", bzToMana: "mana", bzToShield: "shield",
};
// バトルゾーンにカードを出す効果と、その出どころのゾーン。NEO進化を選ばせるために使う。
// playFromHand は zone を書き換えられるので、その時のゾーンを見る。
export const BZ_ENTER_FROM = {
  handToBz: "hand", manaToBz: "mana", graveToBz: "grave", zonesToBz: "zones", revealedToBz: "revealed",
  playFromHand: "*",
};

// このステップでバトルゾーンを離れるカードを、実行前に列挙する。
// all:true の全体除去でも個別選択でも同じ結果になるよう、executeEffect の判定と同じ式を使う。
// 戻り値は [{ card, ownerPid }]。
export function leavingBzCards(effect, selectedUids, ctx, p1, p2, ownerPid) {
  const type = effect?.type;
  if (!BZ_LEAVE_DEST[type]) return [];
  const stateOf = pidx => (pidx === "p1" ? p1 : p2);
  const c2 = { ...ctx };
  // destroy の self:true は「このクリーチャーを破壊する」＝能力の持ち主のものを見る
  const pids = type === "destroy" && effect.self ? [ownerPid]
    : effect.choosePlayer ? (ctx?.chosenPlayer ? [ctx.chosenPlayer] : [])
    : targetPids(effect.target || SOURCE[type]?.target || "self", ownerPid, ctx);
  const out = [];
  for (const pidx of pids) {
    const pool = stateOf(pidx)?.battle || [];
    const cards = type === "destroy" && effect.self ? pool.filter(c => c.uid === ctx?.srcCardUid)
      : effect.all ? pool.filter(c => matchFilter(c, effect.filter, c2))
      : pool.filter(c => (selectedUids || []).includes(c.uid));
    for (const card of cards) out.push({ card, ownerPid: pidx });
  }
  return out;
}

// このステップでバトルゾーンに出るカードを、実行前に列挙する。出すのは常に能力の持ち主。
export function enteringBzCards(effect, selectedUids, ctx, p1, p2, ownerPid) {
  const type = effect?.type;
  let from = BZ_ENTER_FROM[type];
  if (!from) return [];
  if (from === "*") from = effect.zone || "hand";
  // graveToBz の owner:"destroyed" は「破壊されたクリーチャーの持ち主の墓地から」
  const holder = type === "graveToBz" && effect.owner === "destroyed" ? ctx?.destroyedCreatureOwner : ownerPid;
  if (!holder) return [];
  const holderSt = holder === "p1" ? p1 : p2;
  const pool = from === "revealed" ? (ctx?.revealed || [])
    : from === "zones" ? (effect.zones || ["grave"]).flatMap(z => holderSt?.[ZONE_STATE_KEY[z] || z] || [])
    : (holderSt?.[ZONE_STATE_KEY[from] || from] || []);
  // 呪文として唱えるカードはバトルゾーンに出ないので除く（playFromHand はどちらもありうる）
  return pool.filter(c => (selectedUids || []).includes(c.uid))
    .filter(c => type !== "playFromHand" || playSide(effect, c) !== "spell")
    .map(card => ({ card, ownerPid: holder }));
}

// ===========================
// 候補算出（選択UI用）
// ===========================
// そのステップが「カードを選ぶ」ものかどうか。
// getEffectCandidates の isAuto は「候補が0」でも true になるため、
// 「対象が居ないから行えない」の判定にはこちらを併せて使う（置換を提示してよいかの判定など）。
export const stepSelectsCards = type => !!SOURCE[type];

export function getEffectCandidates(effect, selfState, otherState, ctx, p1, p2, srcCard) {
  const type = effect.type;
  const c2 = { ...ctx, srcName: srcCard?.name };
  // 「数字を1つ選ぶ」。カードは選ばないので候補は空だが、数字を決めるまで確定できない。
  // max を書かなければ上限なし（DMの「数字を1つ選ぶ」は好きな数字を宣言できる）
  if (NUMBER_CHOICE_TYPES.has(type)) {
    return { candidates: [], isAuto: false,
      chooseNumber: { min: effect.min ?? 0, max: effect.max ?? null } };
  }
  if (AUTO_TYPES.has(type)) {
    if (type === "revealedToDeckBottom") {
      const pool = ctx?.revealed || [];
      // 「残りを好きな順序で山札の下に置く」は、全部選び終えるまで確定できない順序付き選択
      if (effect.order === "choose" && pool.length > 1) {
        return { candidates: pool, isAuto: false, maxSelect: pool.length, ordered: true };
      }
      return { candidates: pool, isAuto: true };
    }
    return { candidates: [], isAuto: true };
  }
  const spec = SOURCE[type];
  if (!spec) return { candidates: [], isAuto: true };
  const zone = effect.zone || spec.zone;
  const tgt = effect.target || spec.target;

  // 「選ぶ」効果かどうか。全体除去やランダムは選ばないので「選ばれない」では防げない
  const selects = !(effect.all || effect.random || effect.takeAll);
  let cards = [];
  // 「プレイヤー1人の〜から」用に、候補がどちらのプレイヤーのものかを控えておく
  const owners = {};
  if (type === "zonesToBz") {
    // 「自分の墓地またはマナゾーンから」。候補を複数のゾーンから集める
    const ownerPid = selfState === p1 ? "p1" : "p2";
    for (const z of (effect.zones || ["grave"])) {
      const got = zoneCards(selfState, z, c2);
      for (const c of got) owners[c.uid] = ownerPid;
      cards.push(...got);
    }
  } else if (PSEUDO_ZONES.has(zone)) {
    cards = zoneCards(null, zone, c2);
  } else {
    const ownerPid = selfState === p1 ? "p1" : "p2";
    // 対象プレイヤーの決め方は実行時（executeEffect）と同じ targetPids に任せる。
    // ここで別に書くと、"eventPlayer" のような値を足した時に候補だけ取り残される
    const states = targetPids(tgt, ownerPid, c2).map(pidx => [pidx === "p1" ? p1 : p2, pidx]);
    for (const [st, stPid] of states) {
      let got = zoneCards(st, zone, c2);
      if (zone === "bz" || zone === "battle") {
        // 相手のバトルゾーンから「選ぶ」時だけ、「相手に選ばれない」カードを候補から外す
        if (selects && st === otherState) got = got.filter(c => !isUnselectableByOpponent(c, st));
        // 他のカードから足された種族（grantRace）を載せる。filter.raceContains は盤面を
        // 受け取らないので、候補を集めるここで実効の種族にしておく（→ cardHasRace）
        got = got.map(c => withGrantedRaces(c, st));
      }
      for (const c of got) owners[c.uid] = stPid;
      cards.push(...got);
    }
  }
  // 「このクリーチャーを破壊する」は選択不要
  if (type === "destroy" && effect.self) return { candidates: [], isAuto: true };
  // 「そのクリーチャー」＝誘発の主体。選ばせずに確認だけ出す
  if (effect.subject) {
    const subj = ctx?.subjectCard;
    return { candidates: subj ? [subj] : [], isAuto: true };
  }
  // 墓地から出す：破壊されたクリーチャーの持ち主 / 自分自身のみ
  if (type === "graveToBz") {
    if (effect.owner === "destroyed") {
      if (!ctx?.destroyedCreatureOwner) return { candidates: [], isAuto: true };
      cards = (ctx.destroyedCreatureOwner === "p1" ? p1 : p2).grave || [];
    }
    if (effect.self) cards = cards.filter(c => c.uid === srcCard?.uid);
  }
  // playFromHand は「唱える／出す面」で filter を判定する。
  // ツインパクトは呪文面のコストが違うので、カード全体の cost で見ると「コスト4以下の呪文」を取りこぼす。
  const faceFor = c => (type === "playFromHand" && playSide(effect, c) === "spell") ? spellFace(c) : c;
  cards = cards.filter(c => matchFilter(faceFor(c), effect.filter, c2));
  // 呪文を唱えられない状態なら、唱える候補から呪文を外す（見せてから弾かない）
  if (type === "playFromHand") {
    cards = cards.filter(c => !spellDenyReason(faceFor(c), selfState, otherState));
  }
  // 「好きな順序で置く」は選んだ順がそのまま並び順になるので、all 指定でも必ず選択させる
  if (effect.order === "choose") {
    const n = resolveAmount(c2, effect.amount, cards.length) || cards.length;
    return { candidates: cards, owners, isAuto: cards.length === 0, maxSelect: Math.min(n, cards.length), ordered: true, optional: effect.optional };
  }
  // choosePlayer:「プレイヤーを1人選ぶ」。誰を選ぶか決めるまで進めないので、all でも選択扱いにする
  if (effect.choosePlayer) return { candidates: cards, owners, isAuto: false, choosePlayer: true, optional: effect.optional };
  // 一括処理（選択不要）
  if (effect.all || effect.random || effect.takeAll) return { candidates: cards, owners, isAuto: true };
  // 「好きな枚数」: 0枚〜候補すべてから好きなだけ選ぶ（0枚も選べるので必ず任意）
  if (effect.any) {
    return { candidates: cards, owners, isAuto: cards.length === 0, maxSelect: cards.length, optional: true };
  }
  // 選択枚数は通常 amount。ただし powerBuff の amount は「パワー増減値」なので count で指定する（既定1体）
  const countSpec = type === "powerBuff" ? (effect.count ?? 1) : (effect.count ?? effect.amount);
  const maxSelect = Math.max(1, resolveAmount(c2, countSpec, 1) || 1);
  return { candidates: cards, owners, isAuto: cards.length === 0, maxSelect, optional: effect.optional };
}

// ===========================
// 「そうしたら」「そうした場合」
// 直前のステップを実際に行わなかった場合、そこから後ろのステップは実行しない。
//   - 後続ステップに ifPrevious:true を書くと、その手前のステップに依存する
//   - meteorBurn は「コスト」なので、支払わなければ常に以降を打ち切る（ifPrevious 不要）
// ===========================
export function shouldStopChain(steps, doneIdx, ctx) {
  if (ctx?.stepDone !== false) return false;
  const cur = steps?.[doneIdx];
  const next = steps?.[doneIdx + 1];
  return cur?.type === "meteorBurn" || !!next?.ifPrevious;
}

// ===========================
// 実行
// ===========================
export function executeEffect(effect, selectedUids, context, ownerPid, p1, setP1, p2, setP2, addLog, srcCard) {
  const selfState  = ownerPid === "p1" ? p1 : p2;
  const otherState = ownerPid === "p1" ? p2 : p1;
  const setSelf    = ownerPid === "p1" ? setP1 : setP2;
  const setOther   = ownerPid === "p1" ? setP2 : setP1;
  const oppPid     = ownerPid === "p1" ? "p2" : "p1";
  const pid = ownerPid === "p1" ? "P1" : "P2";
  const ctx = { ...context, vars: { ...(context?.vars || {}) }, srcName: srcCard?.name };
  // 「そうしたら」判定用。このステップを実際に行ったか。各 case が明示しなければ末尾で既定値を入れる
  ctx.stepDone = undefined;
  // subject:true =「そのクリーチャー」。誘発の主体そのものを対象にする（選択させない）
  if (effect.subject) selectedUids = ctx.subjectCard ? [ctx.subjectCard.uid] : [];
  const type = effect.type;
  const spec = SOURCE[type] || {};
  const tgt = effect.target || spec.target || "self";
  const amount = resolveAmount(ctx, effect.amount, 1);

  const stateOf = pidx => (pidx === "p1" ? p1 : p2);
  const setOf   = pidx => (pidx === "p1" ? setP1 : setP2);
  // 「プレイヤーを1人選ぶ」。選ばれた側だけを対象にする。
  // pid は selectedUids に混ぜず ctx で受け渡す（selectedUids は「uid の配列」という契約があり、
  // case "battle" は先頭要素を uid とみなし、stepDone は配列長で「行ったか」を判定するため）。
  // 誰も選ばれていなければ何もしない（all と併用するので、両者が対象になる事故を防ぐ）
  const pids = effect.choosePlayer
    ? (ctx.chosenPlayer ? [ctx.chosenPlayer] : [])
    : targetPids(tgt, ownerPid, ctx);
  // 選ばれたカードを対象プレイヤーごとにまとめる。
  // all:true なら選択の代わりに filter 一致すべてを対象にする（「すべて〜する」）。
  const pickSelected = (zone) => {
    const out = [];
    for (const pidx of pids) {
      const pool = zoneCards(stateOf(pidx), zone, ctx);
      const cards = effect.all ? pool.filter(c => matchFilter(c, effect.filter, ctx))
                               : pool.filter(c => selectedUids.includes(c.uid));
      if (cards.length) out.push({ pidx, cards });
    }
    return out;
  };
  // シールドの選択。all:true なら「すべて」（filter があれば一致するものすべて）
  const pickShields = pidx => {
    const pool = stateOf(pidx).shields;
    return effect.all ? pool.filter(c => matchFilter(c, effect.filter, ctx))
                      : pool.filter(c => selectedUids.includes(c.uid));
  };
  const markDestroyed = (card, pidx, viaBattle) => {
    ctx.destroyedThisStep = [...(ctx.destroyedThisStep || []), { card, ownerPid: pidx, viaBattle: !!viaBattle }];
  };
  // 置換効果（G-NEO の除去耐性）で「離れない」ことが決まったカード。
  // all:true の全体除去でも効くように、選択の有無に関わらずここで除く。
  const leaveExempt = new Set(ctx.leaveExempt || []);
  const notExempt = list => (leaveExempt.size ? list.filter(c => !leaveExempt.has(c.uid)) : list);
  // 効果でバトルゾーンに出す時に選んだ NEO進化の進化元（{ カードのuid: 進化元のuid[] }）
  const neoBases = ctx.neoBases || null;
  // 出すカードに NEO進化の進化元を重ねる。重ねた進化元はそのゾーンから取り除かれるので、
  // 呼び出し側は返ってきた state を使って続きを組み立てる。
  const withNeoBases = (state, cards) => {
    if (!neoBases) return { state, cards };
    let st = state;
    const out = cards.map(c => {
      const uids = neoBases[c.uid];
      if (!uids?.length) return c;
      const r = stackEvolutionBases(st, evolutionSpec(c) || { zone: "bz" }, uids);
      st = r.state;
      return { ...c, evolutionBase: r.bases };
    });
    return { state: st, cards: out };
  };

  switch (type) {
    // ---------- 変数ステップ ----------
    // 「ターンの残りをとばす」。この時点で待機している効果と、このターンの残りのステップ
    // （ターンの終わりを含む）をすべて消して次のターンへ進む。実際の処理は BattleScreen 側
    case "skipRestOfTurn":
      ctx.skipRestOfTurn = true;
      ctx.stepDone = true;
      addLog(`${pid}: ターンの残りをとばす`);
      break;
    // 「次のうちいずれか1つを選ぶ」。どれを選ぶかは UI（BattleScreen）が受け取り、
    // 選んだテンプレートの effects をこの位置に差し込む。ここまで来ることは無いが、
    // 万一来ても何も起こさない（差し込みだけが仕事のステップなので）
    case "chooseMode":
      ctx.stepDone = true;
      break;
    // 「数字を1つ選ぶ」。選んだ数は変数に入れて、以降のステップから {var} で参照する
    case "chooseNumber": {
      const n = ctx.chosenNumber;
      if (typeof n !== "number") { ctx.stepDone = false; break; }
      ctx.vars[effect.as || "number"] = n;
      addLog(`${pid}: ${effect.label || "数字を選ぶ"} → ${n}`);
      ctx.stepDone = true;
      break;
    }
    case "count": {
      const zone = effect.zone || "bz";
      let n = 0;
      if (PSEUDO_ZONES.has(zone)) n = zoneCards(null, zone, ctx).filter(c => matchFilter(c, effect.filter, ctx)).length;
      else for (const pidx of pids) n += zoneCards(stateOf(pidx), zone, ctx).filter(c => matchFilter(c, effect.filter, ctx)).length;
      ctx.vars[effect.as || "count"] = n;
      addLog(`${pid}: ${effect.label || "カウント"} = ${n}`);
      break;
    }
    case "pick": {
      const zone = effect.zone || "bz";
      const chosen = [];
      for (const pidx of pids) chosen.push(...zoneCards(stateOf(pidx), zone, ctx).filter(c => selectedUids.includes(c.uid)));
      ctx.vars[effect.as || "picked"] = chosen;
      if (chosen.length) addLog(`${pid}: ${chosen.map(c => c.name).join(", ")} を選択`);
      break;
    }

    // ---------- ドロー / 山札 ----------
    case "drawCards": {
      // target を書かなければ自分（既定）。「相手はカードを5枚引く」も同じステップで書ける
      let drew = 0;
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const n = Math.min(amount, st.deck.length);
        if (n <= 0) continue;
        drew += n;
        setOf(pidx)(s => ({ ...s, hand: [...s.hand, ...s.deck.slice(0, n)], deck: s.deck.slice(n) }));
        addLog(`${pidx === ownerPid ? pid : (pidx === "p1" ? "P1" : "P2")}: ${n}枚ドロー`);
        // 効果によるドローでも draw トリガーを誘発させる（lastCard は山札が0枚になったか）
        ctx.drewCards = [...(ctx.drewCards || []), { pid: pidx, lastCard: st.deck.length - n === 0 }];
      }
      ctx.stepDone = drew > 0;
      break;
    }
    case "reveal": {
      const n = Math.min(amount, selfState.deck.length);
      const revealed = selfState.deck.slice(0, n);
      setSelf(s => ({ ...s, deck: s.deck.slice(n) }));
      ctx.revealed = revealed;
      addLog(`${pid}: 山札の上から${n}枚を公開`);
      break;
    }
    case "topToGrave": {
      const n = Math.min(amount, selfState.deck.length);
      const moved = selfState.deck.slice(0, n);
      setSelf(s => ({ ...s, deck: s.deck.slice(n), grave: [...s.grave, ...moved] }));
      ctx.lastMoved = moved;
      addLog(`${pid}: 山札の上から${n}枚を墓地へ`);
      break;
    }
    case "topToMana": {
      const n = Math.min(amount, selfState.deck.length);
      if (n > 0) {
        const moved = selfState.deck.slice(0, n).map(c => ({ ...c, tapped: !!effect.tapped }));
        setSelf(s => ({ ...s, deck: s.deck.slice(n), mana: [...s.mana, ...moved] }));
        ctx.lastMoved = moved;
        addLog(`${pid}: ${moved.map(c => c.name).join(", ")} → マナ`);
      } else ctx.lastMoved = [];
      break;
    }
    case "topToShield": {
      const n = Math.min(amount, selfState.deck.length);
      if (n > 0) {
        const moved = selfState.deck.slice(0, n).map(c => ({ ...c, tapped: false, faceUp: false }));
        setSelf(s => ({ ...s, deck: s.deck.slice(n), shields: [...s.shields, ...moved], shieldAddedThisTurn: true }));
        ctx.lastMoved = moved;
        noteShieldAdd(ctx, ownerPid, moved);
        addLog(`${pid}: 山札の上から${n}枚をシールド化`);
      }
      break;
    }
    case "search": {
      const dest = effect.destination || "hand";
      const matched = selfState.deck.filter(c => matchFilter(c, effect.filter, ctx));
      const take = effect.takeAll ? matched : matched.filter(c => selectedUids.includes(c.uid));
      if (take.length > 0) {
        const uids = take.map(c => c.uid);
        setSelf(s => {
          const rest = s.deck.filter(c => !uids.includes(c.uid));
          const b = { ...s, deck: dest === "deckTop" ? [...take, ...shuffle(rest)] : shuffle(rest) };
          if (dest === "hand") b.hand = [...s.hand, ...take.map(c => ({ ...c, tapped: false }))];
          if (dest === "bz")   b.battle = [...s.battle, ...take.map(c => withJustDiver({ ...c, tapped: false, enteredThisTurn: true, summonedThisTurn: entersSick(effect) }))];
          if (dest === "mana") b.mana = [...s.mana, ...take.map(c => ({ ...c, tapped: !!effect.tapped }))];
          return b;
        });
        const where = dest === "deckTop" ? "山札の上" : dest === "hand" ? "手札" : dest === "bz" ? "バトルゾーン" : "マナ";
        addLog(`${pid}: 山札から ${take.map(c => c.name).join(", ")} を${where}へ`);
      } else {
        setSelf(s => ({ ...s, deck: shuffle(s.deck) }));
        addLog(`${pid}: 山札をシャッフル`);
      }
      break;
    }

    // ---------- 公開カードの行き先 ----------
    case "revealedToHand": case "revealedToBz": case "revealedToMana":
    case "revealedToGrave": case "revealedToDeckTop": case "revealedToDeckBottom": {
      const pool = ctx.revealed || [];
      const matched = pool.filter(c => matchFilter(c, effect.filter, ctx));
      // revealedToDeckBottom は「残りをすべて」戻すのが既定。
      // order:"choose"（好きな順序で置く）なら、選んだ順がそのまま並び順になる。
      const take = (type === "revealedToDeckBottom")
        ? (effect.order === "choose" ? selectedUids.map(uid => pool.find(c => c.uid === uid)).filter(Boolean) : pool)
        : (effect.takeAll ? matched : matched.filter(c => selectedUids.includes(c.uid)));
      if (take.length > 0) {
        setSelf(s => {
          const b = { ...s };
          if (type === "revealedToHand")  b.hand   = [...s.hand, ...take.map(c => ({ ...c, tapped: false }))];
          if (type === "revealedToBz") {
            const r = withNeoBases(s, take);
            Object.assign(b, r.state);
            b.battle = [...r.state.battle, ...r.cards.map(c => withJustDiver({ ...c, tapped: false, enteredThisTurn: true, summonedThisTurn: entersSick(effect) }))];
          }
          if (type === "revealedToMana")  b.mana   = [...s.mana, ...take.map(c => ({ ...c, tapped: !!effect.tapped }))];
          if (type === "revealedToGrave") b.grave  = [...s.grave, ...take];
          if (type === "revealedToDeckTop")    b.deck = [...take, ...s.deck];
          if (type === "revealedToDeckBottom") b.deck = [...s.deck, ...take];
          return b;
        });
        const where = { revealedToHand:"手札", revealedToBz:"バトルゾーン", revealedToMana:"マナ", revealedToGrave:"墓地", revealedToDeckTop:"山札の上", revealedToDeckBottom:"山札の下" }[type];
        addLog(`${pid}: ${take.map(c => c.name).join(", ")} → ${where}`);
        ctx.lastMoved = take;
        if (type === "revealedToBz") {
          ctx.creatureEnteredBz = [...(ctx.creatureEnteredBz || []), ...take.map(c => ({ card: c, ownerPid, method: "put" }))];
          ctx.lastPutBz = take.map(c => ({ card: c, ownerPid }));
        }
      }
      const takenUids = take.map(c => c.uid);
      ctx.revealed = pool.filter(c => !takenUids.includes(c.uid));
      break;
    }

    // ---------- 手札から ----------
    case "handToBz": {
      for (const { pidx, cards } of pickSelected("hand")) {
        const uids = cards.map(c => c.uid);
        const kw = effect.tempKeyword;
        setOf(pidx)(s => { const r = withNeoBases({ ...s, hand: s.hand.filter(c => !uids.includes(c.uid)) }, cards);
          return { ...r.state,
            battle: [...r.state.battle, ...r.cards.map(c => withJustDiver({ ...c, tapped: false, enteredThisTurn: true, summonedThisTurn: entersSick(effect),
              grantedKeywords: kw ? [...(c.grantedKeywords || []), kw] : c.grantedKeywords }))] }; });
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} を手札からバトルゾーンへ`);
        ctx.lastMoved = cards;
        ctx.creatureEnteredBz = [...(ctx.creatureEnteredBz || []), ...cards.map(c => ({ card: c, ownerPid: pidx, method: "put" }))];
        ctx.lastPutBz = cards.map(c => ({ card: c, ownerPid: pidx }));
      }
      break;
    }
    case "handToShield": {
      for (const { pidx, cards } of pickSelected("hand")) {
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => !uids.includes(c.uid)),
          shields: [...s.shields, ...cards.map(c => ({ ...c, tapped: false, faceUp: false }))], shieldAddedThisTurn: true }));
        noteShieldAdd(ctx, pidx, cards);
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} をシールド化`);
      }
      break;
    }
    // 超次元ゾーンへ。ゲーム外の公開領域なので、置かれたカードは戻ってこない
    case "handToHyper": {
      for (const { pidx, cards } of pickSelected("hand")) {
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => !uids.includes(c.uid)),
          hyper: [...(s.hyper || []), ...cards.map(c => ({ ...c, tapped: false, faceUp: true }))] }));
        addLog(`${pidx.toUpperCase()}: 手札${cards.length}枚を超次元ゾーンへ`);
        ctx.lastMoved = cards;
      }
      break;
    }
    case "handToGrave": {
      for (const pidx of pids) {
        const st = stateOf(pidx);
        let cards;
        if (effect.all) cards = [...st.hand];
        else if (effect.random) {
          const pool = [...st.hand];
          cards = [];
          for (let i = 0; i < amount && pool.length; i++) cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        } else cards = st.hand.filter(c => selectedUids.includes(c.uid));
        if (!cards.length) continue;
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => !uids.includes(c.uid)), grave: [...s.grave, ...cards] }));
        addLog(`${pid}: ${pidx === ownerPid ? "自分" : "相手"}の手札を${effect.random ? `${cards.length}枚（見ないで）` : cards.map(c => c.name).join(", ")}捨てた`);
        // asCost:「捨てたカードと同じコスト」を控える（destroy の asCost と同じ規約）
        if (effect.asCost) ctx.vars[effect.asCost] = Math.max(...cards.map(c => c.cost || 0));
        // 捨てたカード自体を誘発に渡す（「捨てたその呪文を唱える」用）。
        // カードはこの時点で墓地にあるので、zone:"eventCards" から取り出せる
        ctx.discardedBy = [...(ctx.discardedBy || []), { pid: pidx, cards }];
      }
      break;
    }
    case "playFromHand": {
      // 型名は playFromHand のままだが、zone で唱える場所を選べる（既定 "hand"、"grave" など）
      const fromZone = effect.zone || "hand";
      const key = ZONE_STATE_KEY[fromZone] || "hand";
      for (const { pidx, cards } of pickSelected(fromZone)) {
        for (const card of cards) {
          const uid = card.uid;
          const take = s => ({ ...s, [key]: s[key].filter(c => c.uid !== uid) });
          const zoneLabel = fromZone === "hand" ? "" : `${ZONE_LABELS[fromZone] || fromZone}から`;
          const freeLabel = effect.free ? "コストを支払わずに" : "";
          if (playSide(effect, card) === "spell") {
            // ツインパクトは呪文面に差し替えて唱える（効果も呪文面のものを使う）
            const face = spellFace(card);
            // 唱えている間、呪文はどのゾーンにもいない。元のゾーンから取り除くだけにして、
            // 解決しきった時に墓地へ置くのは BattleScreen 側（ctx.castSpell を受けて後始末する）
            setOf(pidx)(take);
            addLog(`${pid}: 「${face.name}」を${zoneLabel}${freeLabel}唱えた`);
            // card = 実際に動かす元のカード（ツインパクトなら本体）、face = 唱えている面
            // afterCast =「そうしたら、唱えた後、墓地に置くかわりに〜」。この1回の cast にだけ乗る
            // 一度きりの置換で、カード直下の spellAfterCast（継続能力）とは別物
            // 効果で唱えるぶんはマナゾーンを一切タップしない（manaTapped は常に 0）
            ctx.castSpell = { card: face, origCard: card, ownerPid: pidx, fromZone, paid: !effect.free, manaTapped: 0,
              afterCast: effect.afterCast || null, afterCastSource: effect.afterCast ? srcCard : null };
          } else if (card.type === "castle") {
            setOf(pidx)(s => { const t = take(s); return { ...t, shields: [...t.shields, { ...card, tapped: false, faceUp: true }], shieldAddedThisTurn: true }; });
            noteShieldAdd(ctx, pidx, [card]);
            addLog(`${pid}: 城「${card.name}」を${zoneLabel}表向きシールド化`);
          } else {
            setOf(pidx)(s => { const r = withNeoBases(take(s), [card]);
              return { ...r.state, battle: [...r.state.battle, withJustDiver({ ...r.cards[0], tapped: false, enteredThisTurn: true, summonedThisTurn: true })] }; });
            addLog(`${pid}: 「${card.name}」を${zoneLabel}${freeLabel}召喚`);
            // 効果による「召喚」。free:true なら「コストを支払わずに」なので paid:false。
            // どちらにせよマナゾーンはタップしない（manaTapped は常に 0）
            ctx.creatureEnteredBz = [...(ctx.creatureEnteredBz || []), { card, ownerPid: pidx, method: "summon", paid: !effect.free, manaTapped: 0 }];
            ctx.lastPutBz = [{ card, ownerPid: pidx }];
          }
        }
      }
      break;
    }

    // ---------- マナから ----------
    case "manaToBz": {
      for (const { pidx, cards } of pickSelected("mana")) {
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => { const r = withNeoBases({ ...s, mana: s.mana.filter(c => !uids.includes(c.uid)) }, cards);
          return { ...r.state,
            battle: [...r.state.battle, ...r.cards.map(c => withJustDiver({ ...c, tapped: false, enteredThisTurn: true, summonedThisTurn: entersSick(effect) }))] }; });
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} マナ→バトルゾーン`);
        ctx.lastMoved = cards;
        ctx.creatureEnteredBz = [...(ctx.creatureEnteredBz || []), ...cards.map(c => ({ card: c, ownerPid: pidx, method: "put" }))];
        ctx.lastPutBz = cards.map(c => ({ card: c, ownerPid: pidx }));
      }
      break;
    }
    case "manaToHand": {
      for (const { pidx, cards } of pickSelected("mana")) {
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, mana: s.mana.filter(c => !uids.includes(c.uid)), hand: [...s.hand, ...cards.map(c => ({ ...c, tapped: false }))] }));
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} マナ→手札`);
      }
      break;
    }
    case "manaToGrave": {
      let moved = 0;
      for (const { pidx, cards } of pickSelected("mana")) {
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, mana: s.mana.filter(c => !uids.includes(c.uid)), grave: [...s.grave, ...cards.map(c => ({ ...c, tapped: false }))] }));
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} マナ→墓地`);
        ctx.lastMoved = cards;
        moved += cards.length;
      }
      // as で枚数を控えておくと、後続ステップの amount から名前で参照できる（「同じ枚数」）
      if (effect.as) ctx.vars[effect.as] = moved;
      ctx.stepDone = moved > 0;
      break;
    }

    // ---------- バトルゾーンから ----------
    case "destroy": {
      // self:true =「このクリーチャーを破壊する」。target の既定(opponent)ではなく能力の持ち主を見る
      for (const pidx of (effect.self ? [ownerPid] : pids)) {
        const st = stateOf(pidx);
        const targets = notExempt(effect.self
          ? st.battle.filter(c => c.uid === ctx.srcCardUid)
          : effect.all
            ? st.battle.filter(c => matchFilter(c, effect.filter, ctx))
            : st.battle.filter(c => selectedUids.includes(c.uid)));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
        targets.forEach(c => { addLog(`${pid}: ${c.name} を破壊`); markDestroyed(c, pidx, false); });
        // 「破壊したカードよりコストが1大きい〜」用に、破壊したカードのコストを控える。
        // ctx.destroyedThisStep は次のステップに進む前に消費されるので、ここで変数に写す。
        if (effect.asCost) ctx.vars[effect.asCost] = Math.max(...targets.map(c => c.cost || 0));
        ctx.destroyedCreatureOwner = pidx;
      }
      break;
    }
    case "bzToHand": {
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const targets = notExempt(effect.all ? st.battle.filter(c => matchFilter(c, effect.filter, ctx)) : st.battle.filter(c => selectedUids.includes(c.uid)));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids);
          return { ...s, battle: newBattle, hand: [...s.hand, ...extracted.map(c => ({ ...c, tapped: false, hyperMode: false, cantAttackThisTurn: false, enteredThisTurn: false, summonedThisTurn: false, tempBuff: undefined }))] }; });
        addLog(`${pid}: ${targets.map(c => c.name).join(", ")} を持ち主の手札へ`);
      }
      break;
    }
    case "bzToMana": {
      for (const pidx of pids) {
        const targets = notExempt(stateOf(pidx).battle.filter(c => selectedUids.includes(c.uid)));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids); return { ...s, battle: newBattle, mana: [...s.mana, ...extracted.map(c => ({ ...c, tapped: !!effect.tapped }))] }; });
        addLog(`${pid}: ${targets.map(c => c.name).join(", ")} をマナゾーンへ`);
      }
      break;
    }
    case "bzToShield": {
      for (const pidx of pids) {
        const targets = notExempt(stateOf(pidx).battle.filter(c => selectedUids.includes(c.uid)));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids); return { ...s, battle: newBattle, shields: [...s.shields, ...extracted.map(c => ({ ...c, tapped: false, faceUp: false }))], shieldAddedThisTurn: true }; });
        noteShieldAdd(ctx, pidx, targets);
        addLog(`${pid}: ${targets.map(c => c.name).join(", ")} をシールド化`);
      }
      break;
    }
    case "tap": case "untap": case "tapToggle": {
      const wantTap = type === "tap";
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const zone = effect.zone || "bz";
        const pool = zoneCards(st, zone, ctx);
        const targets = effect.all ? pool.filter(c => matchFilter(c, effect.filter, ctx)) : pool.filter(c => selectedUids.includes(c.uid));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        const key = zone === "mana" ? "mana" : "battle";
        setOf(pidx)(s => ({ ...s, [key]: s[key].map(c => uids.includes(c.uid)
          ? { ...c, tapped: type === "tapToggle" ? !c.tapped : wantTap, ...(effect.noUntapNextTurn ? { noUntapNextTurn: true } : {}) } : c) }));
        addLog(`${pid}: ${targets.map(c => c.name).join(", ")} を${type === "tapToggle" ? "タップ/アンタップ" : wantTap ? "タップ" : "アンタップ"}${effect.noUntapNextTurn ? "（次の相手ターンに起きない）" : ""}`);
      }
      break;
    }
    // EXWIN: ダイレクトアタック以外の特殊勝利。executeEffect は setWinner を持たないので
    // ctx フラグを立て、BattleScreen 側（advanceStep）で勝敗を確定させる。
    case "winGame": {
      const winner = tgt === "opponent" ? oppPid : ownerPid;
      ctx.winGame = { pid: winner, reason: effect.reason || "exwin" };
      addLog(`${pid}: [EXWIN] ${winner.toUpperCase()} はゲームに勝利する`);
      break;
    }
    case "untapAllMana": {
      setSelf(s => ({ ...s, mana: s.mana.map(c => ({ ...c, tapped: false })) }));
      addLog(`${pid}: マナゾーンをすべてアンタップ`);
      break;
    }
    // 「〜できない」系の期限付き制限（→ gameLogic の restrictions）。
    //   denySpell        「次の、相手のターンの終わりまで、相手は呪文を唱えられない」（ラフルル・ラブ）
    //   denyAttackBlock  「次の自分のターンのはじめまで、〜のクリーチャーは攻撃もブロックもできない」
    //   limitAttackBlock 「各ターンに一度しか、クリーチャーで攻撃もブロックもできない」
    // どれも「縛られる側のプレイヤー状態に積み、その側のターンが終わると切れる」同じ形なので、
    // 積む処理は1か所にまとめてある（期限の管理も BattleScreen の advanceToNextTurn 1か所）。
    case "denySpell":
    case "denyAttackBlock":
    case "limitAttackBlock": {
      // filter は状態に保存され、あとで matchCardFilter（ctx 無し）で評価されるので、
      // {var} 参照はここで数値に固めておく（「選んだ数字と同じコストの呪文」用）
      const rule = { kind: RESTRICTION_KIND[type], filter: freezeFilter(effect.filter, ctx), label: effect.label };
      if (type === "denyAttackBlock") {
        rule.mode = effect.mode || "both";
        // 「1体選ぶ」形（all を書かない）は、選んだカードを uid で焼き込む。
        // filter は保存されてから matchCardFilter で評価されるので、ここで固めておくのは
        // {var} を数値にするのと同じ理屈（→ freezeFilter）
        if (!effect.all) rule.filter = { ...rule.filter, uid: selectedUids };
      }
      if (type === "limitAttackBlock") rule.max = effect.maxPerTurn ?? 1;
      for (const pidx of pids) setOf(pidx)(s => addRestriction(s, rule));
      addLog(`${pid}: ${restrictionLog(rule, tgt)}`);
      break;
    }
    // 「そのエレメントの能力を無視する」。バトルゾーンのカードに印を付けるだけで、
    // 能力の読み出し（effectiveCard）がその印を見て能力を落とす。
    // 期限は denySpell と同じ規則で、印を付けられた側のターンが終わると切れる
    // （＝この効果を使った側の「次の自分のターンのはじめ」）。
    case "ignoreAbilities": {
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const targets = effect.all ? st.battle.filter(c => matchFilter(c, effect.filter, ctx))
                                   : st.battle.filter(c => selectedUids.includes(c.uid));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, battle: s.battle.map(c => uids.includes(c.uid) ? { ...c, ignoreAbilities: true } : c) }));
        addLog(`${pid}: ${targets.map(c => c.name).join(", ")} の能力を無視する`);
      }
      // 対象がいなくても「行った」扱い（この後に出たカードには掛からないのが正しい）
      ctx.stepDone = true;
      break;
    }
    // そのターン限り、指定ゾーンからの召喚を許可する（例: 蛇手の親分ゴエモンキー！）
    case "grantSummonFrom": {
      const perm = { zone: effect.zone, filter: effect.filter, maxPerTurn: effect.maxPerTurn,
                     timing: effect.timing, label: effect.label };
      for (const pidx of pids) setOf(pidx)(s => ({ ...s, turnSummonFrom: [...(s.turnSummonFrom || []), perm] }));
      addLog(`${pid}: このターン、${effect.zone === "mana" ? "マナゾーン" : "墓地"}からクリーチャーを召喚できる`);
      break;
    }
    case "powerBuff": {
      // amount は数値でも変数参照でもよい。perUnit を付けると「1つにつき N」（例: 墓地のクリーチャー1体につき-1000）
      const delta = resolveAmount(ctx, effect.amount, 0) * (effect.perUnit ?? 1);
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const targets = st.battle.filter(c => selectedUids.includes(c.uid));
        for (const card of targets) {
          const newBuff = { power: (card.tempBuff?.power || 0) + delta, keywords: effect.keywords || card.tempBuff?.keywords, expires: effect.expires || "endOfTurn" };
          const projected = getEffectivePower({ ...card, tempBuff: newBuff }, st, st.battle);
          if (projected <= 0) {
            setOf(pidx)(s => { const { newBattle, extracted } = extractFromBattle(s.battle, card.uid); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
            addLog(`${pid}: ${card.name} のパワーを${delta}（パワー0以下のため破壊）`);
            markDestroyed(card, pidx, false);
          } else {
            setOf(pidx)(s => ({ ...s, battle: s.battle.map(c => c.uid === card.uid ? { ...c, tempBuff: newBuff } : c) }));
            addLog(`${pid}: ${card.name} のパワーを${delta > 0 ? "+" : ""}${delta}`);
          }
        }
      }
      break;
    }
    case "grant": {
      const targets = selfState.battle.filter(c => selectedUids.includes(c.uid));
      for (const card of targets) {
        setSelf(s => ({ ...s, battle: s.battle.map(c => c.uid === card.uid ? {
          ...c,
          tempBuff: effect.keywords ? { ...(c.tempBuff || {}), keywords: effect.keywords, expires: effect.expires || "endOfTurn" } : c.tempBuff,
          ...(effect.untapAfterAttack ? { untapAfterAttack: true } : {}),
          ...(effect.untap ? { tapped: false } : {}),
        } : c) }));
        addLog(`${pid}: ${card.name} に ${(effect.keywords || []).map(k => KEYWORD_LABELS[k] || k).join("/")}${effect.untapAfterAttack ? "（攻撃後アンタップ）" : ""} を付与`);
      }
      break;
    }
    case "battle": {
      const target = otherState.battle.find(c => c.uid === selectedUids[0]);
      // selfFrom:"lastPut" … 直前にこの効果でバトルゾーンに出たクリーチャーがバトルする。
      // （呪文には「このクリーチャー」がいないので、出したクリーチャーを自分側にする用。
      //   subject:true は「そのクリーチャー＝誘発の主体」で意味が違うので別キーにしている）
      const selfUid = effect.selfFrom === "lastPut"
        ? ctx.lastPutBz?.[ctx.lastPutBz.length - 1]?.card?.uid
        : ctx.srcCardUid;
      const self = selfState.battle.find(c => c.uid === selfUid);
      if (!target || !self) break;
      const sEff = getEffectivePower(self, selfState, selfState.battle);
      const tEff = getEffectivePower(target, otherState, otherState.battle);
      addLog(`[VS] ${self.name}(${sEff}) vs ${target.name}(${tEff})`);
      if (tEff >= sEff) { setSelf(s => { const { newBattle, extracted } = extractFromBattle(s.battle, self.uid); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; }); addLog(`[LOST] ${self.name} 破壊`); markDestroyed(self, ownerPid, true); }
      if (sEff >= tEff) {
        setOther(s => { const { newBattle, extracted } = extractFromBattle(s.battle, target.uid); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
        addLog(`[WIN] ${target.name} 破壊`); markDestroyed(target, oppPid, true); ctx.etbBattleWon = true;
        // 「バトルに勝った時」は、相手を破壊して自分は生き残った時だけ（相打ちは勝ちではない）
        if (sEff > tEff) ctx.battleWonBy = { pid: ownerPid, card: self };
      }
      break;
    }

    // ---------- 墓地・シールド ----------
    // graveToBz は墓地から、zonesToBz は zones で指定した複数のゾーン（「自分の墓地または
    // マナゾーンから」）から出す。選ばれたカードは、それがあったゾーンからだけ取り除く。
    case "graveToBz": case "zonesToBz": {
      const zones = type === "zonesToBz" ? (effect.zones || ["grave"]) : ["grave"];
      const owner = effect.owner === "destroyed" ? ctx.destroyedCreatureOwner : ownerPid;
      if (!owner) break;
      const st = stateOf(owner);
      const picked = zones.map(z => ({ z, key: ZONE_STATE_KEY[z] || z }))
        .map(({ z, key }) => ({ z, key, cards: (st[key] || []).filter(c => selectedUids.includes(c.uid)) }))
        .filter(x => x.cards.length);
      const cards = picked.flatMap(x => x.cards);
      if (!cards.length) break;
      setOf(owner)(s => {
        let b = { ...s };
        for (const { key, cards: cs } of picked) {
          const uids = cs.map(c => c.uid);
          b[key] = (b[key] || []).filter(c => !uids.includes(c.uid));
        }
        const r = withNeoBases(b, cards);
        return { ...r.state,
          battle: [...r.state.battle, ...r.cards.map(c => withJustDiver({ ...c, tapped: false, enteredThisTurn: true, summonedThisTurn: entersSick(effect),
            ...(effect.tempKeywords ? { tempBuff: { keywords: effect.tempKeywords, expires: "endOfTurn" } } : {}),
            ...(effect.destroyAtEndOfTurn ? { endOfTurnEffect: { type: "destroySelf" } } : {}) }))] };
      });
      const fromLabel = picked.map(x => ZONE_LABELS[x.z] || x.z).join("／");
      addLog(`${pid}: ${cards.map(c => c.name).join(", ")} を${fromLabel}からバトルゾーンへ`);
      ctx.lastMoved = cards;
      ctx.creatureEnteredBz = [...(ctx.creatureEnteredBz || []), ...cards.map(c => ({ card: c, ownerPid: owner, method: "put" }))];
      ctx.lastPutBz = cards.map(c => ({ card: c, ownerPid: owner }));
      break;
    }
    // メテオバーン: このクリーチャーの下のカードを指定数、指定ゾーンへ動かす「コスト」。
    // 支払えなければ ctx.stepDone=false を立て、呼び出し側が以降のステップを打ち切る（＝「そうしたら」）。
    case "meteorBurn": {
      const need = resolveAmount(ctx, effect.count, 1) || 1;
      const live = selfState.battle.find(c => c.uid === ctx.srcCardUid);
      const under = live?.evolutionBase || [];
      const picked = under.filter(c => selectedUids.includes(c.uid));
      if (!live || under.length < need || picked.length < need) {
        ctx.stepDone = false;
        addLog(`${pid}: メテオバーン不発（${!live ? "クリーチャーがバトルゾーンにいない" : "下のカードが足りない/支払わなかった"}）`);
        break;
      }
      const uids = new Set(picked.map(c => c.uid));
      // filter で抜くので残りの順序は保たれ、抜けた場所は自然に詰まる
      const rest = under.filter(c => !uids.has(c.uid));
      const moved = picked.map(c => {
        const m = { ...c, tapped: false, faceUp: false };
        delete m.evolutionBase; delete m.tempBuff;
        return m;
      });
      const to = effect.to || "grave";
      setSelf(s => {
        const battle = s.battle.map(c => c.uid === live.uid ? { ...c, evolutionBase: rest } : c);
        if (to === "mana")   return { ...s, battle, mana:   [...s.mana,   ...moved.map(c => ({ ...c, tapped: !!effect.tapped }))] };
        if (to === "hand")   return { ...s, battle, hand:   [...s.hand,   ...moved] };
        if (to === "shield") return { ...s, battle, shields:[...s.shields,...moved], shieldAddedThisTurn: true };
        if (to === "deck")   return { ...s, battle, deck:   [...s.deck,   ...moved] };  // 山札の下
        return { ...s, battle, grave: [...s.grave, ...moved] };
      });
      if (to === "shield") noteShieldAdd(ctx, ownerPid, moved);
      const ZONE_JP = { grave:"墓地", mana:"マナゾーン", hand:"手札", shield:"シールドゾーン", deck:"山札の下" };
      addLog(`${pid}: [メテオバーン] ${live.name} の下から「${picked.map(c => c.name).join("、")}」を${ZONE_JP[to] || "墓地"}へ`);
      ctx.lastMoved = moved;
      ctx.stepDone = true;
      break;
    }
    // 墓地から山札の下へ。order:"shuffle"(既定)=シャッフルしてから置く / "choose"=選んだ順に置く
    // 「（それらを）自身の山札に加えてシャッフルする」。山札の下に置く graveToDeckBottom とは別物で、
    // 加えたあとその持ち主の山札全体をシャッフルする。
    case "graveToDeck": {
      let moved = 0;
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const cards = (effect.all || effect.takeAll)
          ? st.grave.filter(c => matchFilter(c, effect.filter, ctx))
          : st.grave.filter(c => selectedUids.includes(c.uid));
        if (!cards.length) continue;
        const uids = new Set(cards.map(c => c.uid));
        setOf(pidx)(s => ({ ...s, grave: s.grave.filter(c => !uids.has(c.uid)),
          deck: shuffle([...s.deck, ...cards]) }));
        addLog(`${pidx.toUpperCase()}: 墓地の${cards.length}枚を山札に加えてシャッフル`);
        ctx.lastMoved = cards;
        moved += cards.length;
      }
      ctx.stepDone = moved > 0;
      break;
    }
    // 手札を山札へ。「好きな順序で山札の上に置く」（極智秘伝ローゼス・チューン）用。
    // order:"choose" なら選んだ順がそのまま並び順になる（先に選んだものが上）
    case "handToDeck": {
      const toTop = effect.to !== "bottom";   // 既定は「山札の上」
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const cards = effect.order === "choose"
          ? selectedUids.map(uid => st.hand.find(c => c.uid === uid)).filter(Boolean)
          : st.hand.filter(c => selectedUids.includes(c.uid));
        if (!cards.length) continue;
        const uids = new Set(cards.map(c => c.uid));
        setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => !uids.has(c.uid)),
          deck: toTop ? [...cards, ...s.deck] : [...s.deck, ...cards] }));
        addLog(`${pid}: 手札の${cards.length}枚を${effect.order === "choose" ? "好きな順序で" : ""}山札の${toTop ? "上" : "下"}へ`);
        ctx.lastMoved = cards;
      }
      break;
    }
    case "graveToDeckBottom": {
      for (const pidx of pids) {
        const st = stateOf(pidx);
        let cards;
        if (effect.order === "choose") {
          cards = selectedUids.map(uid => st.grave.find(c => c.uid === uid)).filter(Boolean); // 選んだ順＝上から
        } else {
          const pool = (effect.all || effect.takeAll)
            ? st.grave.filter(c => matchFilter(c, effect.filter, ctx))
            : st.grave.filter(c => selectedUids.includes(c.uid));
          cards = shuffle(pool);
        }
        if (!cards.length) continue;
        const uids = new Set(cards.map(c => c.uid));
        setOf(pidx)(s => ({ ...s, grave: s.grave.filter(c => !uids.has(c.uid)), deck: [...s.deck, ...cards] }));
        addLog(`${pid}: 墓地の${cards.length}枚を${effect.order === "choose" ? "好きな順序で" : "シャッフルして"}山札の下へ`);
        ctx.lastMoved = cards;
      }
      break;
    }
    case "shuffleDeck": {
      for (const pidx of pids) setOf(pidx)(s => ({ ...s, deck: shuffle(s.deck) }));
      addLog(`${pid}: ${tgt === "opponent" ? "相手の" : tgt === "both" ? "おたがいの" : ""}山札をシャッフルした`);
      break;
    }
    case "graveToHand": {
      for (const pidx of pids) {
        const cards = stateOf(pidx).grave.filter(c => selectedUids.includes(c.uid));
        if (!cards.length) continue;
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, grave: s.grave.filter(c => !uids.includes(c.uid)), hand: [...s.hand, ...cards.map(c => ({ ...c, tapped: false }))] }));
        addLog(`${pid}: 墓地から「${cards.map(c => c.name).join(", ")}」を手札へ`);
        ctx.lastMoved = cards;
      }
      break;
    }
    // シールドを手札に加える。既定では「S・トリガー」を使える。
    // カードテキストに「ただし、その『S・トリガー』は使えない」とあるものだけ
    // canUseTrigger:false を書く。誘発は ctx 経由で BattleScreen が解決する。
    case "shieldToHand": {
      for (const pidx of pids) {
        const cards = pickShields(pidx);
        if (!cards.length) continue;
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, shields: s.shields.filter(c => !uids.includes(c.uid)), hand: [...s.hand, ...cards.map(c => ({ ...c, tapped: false, faceUp: false }))] }));
        const canUse = effect.canUseTrigger !== false;
        addLog(`${pid}: シールド「${cards.map(c => c.name).join(", ")}」を手札へ${canUse ? "" : "（S・トリガー不使用）"}`);
        if (canUse) {
          ctx.shieldTriggerCards = [...(ctx.shieldTriggerCards || []), ...cards.map(c => ({ card: c, ownerPid: pidx }))];
        }
      }
      break;
    }
    case "shieldToGrave": {
      for (const pidx of pids) {
        const cards = pickShields(pidx);
        if (!cards.length) continue;
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, shields: s.shields.filter(c => !uids.includes(c.uid)), grave: [...s.grave, ...cards] }));
        addLog(`${pid}: シールドを墓地へ`);
      }
      break;
    }
    case "breakShield": {
      const targetPid = pids[0] === ownerPid && tgt !== "self" ? oppPid : pids[0];
      const shield = stateOf(targetPid).shields.find(c => selectedUids.includes(c.uid));
      if (!shield) break;
      setOf(targetPid)(s => ({ ...s, shields: s.shields.filter(c => c.uid !== shield.uid), hand: [...s.hand, { ...shield, tapped: false, faceUp: false }] }));
      addLog(`[BREAK] ${srcCard?.name}: シールドブレイク`);
      break;
    }

    // ---------- 遅延 ----------
    case "scheduleReviveSubjectEndOfTurn": {
      const subj = ctx.subjectCard;
      if (subj) { setSelf(s => ({ ...s, pendingRevive: [...(s.pendingRevive || []), subj] })); addLog(`${pid}: ${subj.name} をこのターンの終わりに墓地から出す（予約）`); }
      break;
    }

    default: addLog(`[未実装効果] ${type}`);
  }
  // 既定: 自動実行のステップは「行った」、選択が要るステップは1枚以上選ばれていれば「行った」
  if (ctx.stepDone === undefined) ctx.stepDone = AUTO_TYPES.has(type) || selectedUids.length > 0
    || !!(effect.choosePlayer && ctx.chosenPlayer);
  // このステップ限りの決定なので、次のステップへ持ち越さない
  delete ctx.leaveExempt; delete ctx.gNeoAsked; delete ctx.neoBases;
  return ctx;
}
