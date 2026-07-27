import { shuffle, extractFromBattle, extractManyFromBattle, getEffectivePower, getCardCivs, isElement } from "../gameLogic";
import { KEYWORD_LABELS } from "../constants";

// ===========================
// EFFECT ENGINE
// カード効果は effects:[ {type, ...} ] の並びとして上から順に解決する。
// 変数ステップ(count/pick)が ctx.vars に値を保存し、後続の amount 等が文字列で参照できる。
// ゾーン移動は <from>To<To>（topToMana 等）、「実行(プレイ)」は playFromHand と命名を分ける。
// ===========================

// ---- 変数解決（数値ならそのまま、文字列なら ctx.vars を参照）----
export function resolveAmount(ctx, val, fallback = 1) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const v = ctx?.vars?.[val];
    if (Array.isArray(v)) return v.length;
    if (typeof v === "number") return v;
    return 0;
  }
  return fallback;
}

// ---- フィルタ ----
export function matchFilter(card, filter, ctx) {
  if (!filter) return true;
  const f = filter;
  if (f.civ && !getCardCivs(card).includes(f.civ)) return false;
  if (f.civNot && getCardCivs(card).includes(f.civNot)) return false;
  if (f.raceContains && !card.race?.includes(f.raceContains)) return false;
  if (f.nameContains && !card.name?.includes(f.nameContains)) return false;
  if (f.notNameSelf && ctx?.srcName && card.name === ctx.srcName) return false;
  if (f.keyword && !card.keywords?.includes(f.keyword)) return false;
  if (f.multiColor && !(Array.isArray(card.civ) && card.civ.length >= 2)) return false;
  if (f.element && !isElement(card)) return false;
  if (f.creatureOnly && !(card.type === "creature" || card.type === "evo_creature")) return false;
  if (f.tapped != null && !!card.tapped !== !!f.tapped) return false;
  if (f.maxCost != null && !(card.cost <= resolveAmount(ctx, f.maxCost, f.maxCost))) return false;
  if (f.minCost != null && !(card.cost >= resolveAmount(ctx, f.minCost, f.minCost))) return false;
  if (f.maxPower != null && !((card.power || 0) <= resolveAmount(ctx, f.maxPower, f.maxPower))) return false;
  if (f.type) {
    if (f.type === "creature") { if (!(card.type === "creature" || card.type === "evo_creature")) return false; }
    else if (f.type === "nonCreature") { if (card.type === "creature" || card.type === "evo_creature") return false; }
    else if (card.type !== f.type) return false;
  }
  return true;
}

// ---- ゾーン取得 ----
function zoneCards(state, zone, ctx) {
  switch (zone) {
    case "hand": return state?.hand || [];
    case "bz": case "battle": return state?.battle || [];
    case "mana": return state?.mana || [];
    case "grave": return state?.grave || [];
    case "shield": return state?.shields || [];
    case "deck": return state?.deck || [];
    case "revealed": return ctx?.revealed || [];
    case "lastMoved": return ctx?.lastMoved || [];
    default: return [];
  }
}

// target("self"|"opponent"|"both") を pid の配列へ
function targetPids(target, ownerPid) {
  const opp = ownerPid === "p1" ? "p2" : "p1";
  if (target === "opponent") return [opp];
  if (target === "both") return [ownerPid, opp];
  return [ownerPid];
}

// 効果ごとの「選択元ゾーン」と既定 target
const SOURCE = {
  handToBz:       { zone: "hand",     target: "self" },
  handToShield:   { zone: "hand",     target: "self" },
  handToGrave:    { zone: "hand",     target: "self" },
  playFromHand:   { zone: "hand",     target: "self" },
  manaToBz:       { zone: "mana",     target: "self" },
  manaToHand:     { zone: "mana",     target: "self" },
  bzToMana:       { zone: "bz",       target: "opponent" },
  bzToHand:       { zone: "bz",       target: "opponent" },
  bzToShield:     { zone: "bz",       target: "opponent" },
  destroy:        { zone: "bz",       target: "opponent" },
  tap:            { zone: "bz",       target: "opponent" },
  untap:          { zone: "bz",       target: "self" },
  tapToggle:      { zone: "bz",       target: "both" },
  graveToBz:      { zone: "grave",    target: "self" },
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
  "revealedToDeckBottom","scheduleReviveSubjectEndOfTurn","untapAllMana"]);

// ===========================
// 候補算出（選択UI用）
// ===========================
export function getEffectCandidates(effect, selfState, otherState, ctx, p1, p2, srcCard) {
  const type = effect.type;
  const c2 = { ...ctx, srcName: srcCard?.name };
  if (AUTO_TYPES.has(type)) {
    if (type === "revealedToDeckBottom") return { candidates: ctx?.revealed || [], isAuto: true };
    return { candidates: [], isAuto: true };
  }
  const spec = SOURCE[type];
  if (!spec) return { candidates: [], isAuto: true };
  const zone = effect.zone || spec.zone;
  const tgt = effect.target || spec.target;

  let cards = [];
  if (zone === "revealed" || zone === "lastMoved") {
    cards = zoneCards(null, zone, c2);
  } else {
    const states = tgt === "opponent" ? [otherState] : tgt === "both" ? [selfState, otherState] : [selfState];
    for (const st of states) cards.push(...zoneCards(st, zone, c2));
  }
  // 墓地から出す：破壊されたクリーチャーの持ち主 / 自分自身のみ
  if (type === "graveToBz") {
    if (effect.owner === "destroyed") {
      if (!ctx?.destroyedCreatureOwner) return { candidates: [], isAuto: true };
      cards = (ctx.destroyedCreatureOwner === "p1" ? p1 : p2).grave || [];
    }
    if (effect.self) cards = cards.filter(c => c.uid === srcCard?.uid);
  }
  cards = cards.filter(c => matchFilter(c, effect.filter, c2));
  // 一括処理（選択不要）
  if (effect.all || effect.random || effect.takeAll) return { candidates: cards, isAuto: true };
  const maxSelect = resolveAmount(c2, effect.amount, 1) || 1;
  return { candidates: cards, isAuto: cards.length === 0, maxSelect, optional: effect.optional };
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
  const type = effect.type;
  const spec = SOURCE[type] || {};
  const tgt = effect.target || spec.target || "self";
  const amount = resolveAmount(ctx, effect.amount, 1);

  const stateOf = pidx => (pidx === "p1" ? p1 : p2);
  const setOf   = pidx => (pidx === "p1" ? setP1 : setP2);
  const pids = targetPids(tgt, ownerPid);
  const pickSelected = (zone) => {
    const out = [];
    for (const pidx of pids) {
      const cards = zoneCards(stateOf(pidx), zone, ctx).filter(c => selectedUids.includes(c.uid));
      if (cards.length) out.push({ pidx, cards });
    }
    return out;
  };
  const markDestroyed = (card, pidx, viaBattle) => {
    ctx.destroyedThisStep = [...(ctx.destroyedThisStep || []), { card, ownerPid: pidx, viaBattle: !!viaBattle }];
  };

  switch (type) {
    // ---------- 変数ステップ ----------
    case "count": {
      const zone = effect.zone || "bz";
      let n = 0;
      if (zone === "revealed" || zone === "lastMoved") n = zoneCards(null, zone, ctx).filter(c => matchFilter(c, effect.filter, ctx)).length;
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
      const n = Math.min(amount, selfState.deck.length);
      if (n > 0) setSelf(s => ({ ...s, hand: [...s.hand, ...s.deck.slice(0, n)], deck: s.deck.slice(n) }));
      addLog(`${pid}: ${n}枚ドロー`);
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
        const moved = selfState.deck.slice(0, n).map(c => ({ ...c, tapped: effect.tapped !== false }));
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
        ctx.shieldAddedFor = [...(ctx.shieldAddedFor || []), ownerPid];
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
          if (dest === "bz")   b.battle = [...s.battle, ...take.map(c => ({ ...c, tapped: false, summonedThisTurn: true }))];
          if (dest === "mana") b.mana = [...s.mana, ...take.map(c => ({ ...c, tapped: true }))];
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
      const take = (type === "revealedToDeckBottom") ? pool
        : (effect.takeAll ? matched : matched.filter(c => selectedUids.includes(c.uid)));
      if (take.length > 0) {
        setSelf(s => {
          const b = { ...s };
          if (type === "revealedToHand")  b.hand   = [...s.hand, ...take.map(c => ({ ...c, tapped: false }))];
          if (type === "revealedToBz")    b.battle = [...s.battle, ...take.map(c => ({ ...c, tapped: false, summonedThisTurn: false }))];
          if (type === "revealedToMana")  b.mana   = [...s.mana, ...take.map(c => ({ ...c, tapped: true }))];
          if (type === "revealedToGrave") b.grave  = [...s.grave, ...take];
          if (type === "revealedToDeckTop")    b.deck = [...take, ...s.deck];
          if (type === "revealedToDeckBottom") b.deck = [...s.deck, ...take];
          return b;
        });
        const where = { revealedToHand:"手札", revealedToBz:"バトルゾーン", revealedToMana:"マナ", revealedToGrave:"墓地", revealedToDeckTop:"山札の上", revealedToDeckBottom:"山札の下" }[type];
        addLog(`${pid}: ${take.map(c => c.name).join(", ")} → ${where}`);
        ctx.lastMoved = take;
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
        setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => !uids.includes(c.uid)),
          battle: [...s.battle, ...cards.map(c => ({ ...c, tapped: false, summonedThisTurn: !!effect.summoningSickness,
            grantedKeywords: kw ? [...(c.grantedKeywords || []), kw] : c.grantedKeywords }))] }));
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} を手札からバトルゾーンへ`);
        ctx.lastMoved = cards;
      }
      break;
    }
    case "handToShield": {
      for (const { pidx, cards } of pickSelected("hand")) {
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => !uids.includes(c.uid)),
          shields: [...s.shields, ...cards.map(c => ({ ...c, tapped: false, faceUp: false }))], shieldAddedThisTurn: true }));
        ctx.shieldAddedFor = [...(ctx.shieldAddedFor || []), pidx];
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} をシールド化`);
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
        ctx.discardedBy = [...(ctx.discardedBy || []), pidx];
      }
      break;
    }
    case "playFromHand": {
      for (const { pidx, cards } of pickSelected("hand")) {
        for (const card of cards) {
          const uid = card.uid;
          if (card.type === "spell") {
            setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), grave: [...s.grave, card] }));
            addLog(`${pid}: 「${card.name}」を${effect.free ? "コストを支払わずに" : ""}唱えた`);
            ctx.castSpell = { card, ownerPid: pidx };
          } else if (card.type === "castle") {
            setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), shields: [...s.shields, { ...card, tapped: false, faceUp: true }], shieldAddedThisTurn: true }));
            ctx.shieldAddedFor = [...(ctx.shieldAddedFor || []), pidx];
            addLog(`${pid}: 城「${card.name}」を表向きシールド化`);
          } else {
            setOf(pidx)(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: true }] }));
            addLog(`${pid}: 「${card.name}」を${effect.free ? "コストを支払わずに" : ""}召喚`);
          }
        }
      }
      break;
    }

    // ---------- マナから ----------
    case "manaToBz": {
      for (const { pidx, cards } of pickSelected("mana")) {
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, mana: s.mana.filter(c => !uids.includes(c.uid)),
          battle: [...s.battle, ...cards.map(c => ({ ...c, tapped: false, summonedThisTurn: false }))] }));
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} マナ→バトルゾーン`);
        ctx.lastMoved = cards;
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

    // ---------- バトルゾーンから ----------
    case "destroy": {
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const targets = effect.all
          ? st.battle.filter(c => matchFilter(c, effect.filter, ctx))
          : st.battle.filter(c => selectedUids.includes(c.uid));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
        targets.forEach(c => { addLog(`${pid}: ${c.name} を破壊`); markDestroyed(c, pidx, false); });
        ctx.destroyedCreatureOwner = pidx;
      }
      break;
    }
    case "bzToHand": {
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const targets = effect.all ? st.battle.filter(c => matchFilter(c, effect.filter, ctx)) : st.battle.filter(c => selectedUids.includes(c.uid));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids);
          return { ...s, battle: newBattle, hand: [...s.hand, ...extracted.map(c => ({ ...c, tapped: false, hyperMode: false, cantAttackThisTurn: false, summonedThisTurn: false, tempBuff: undefined }))] }; });
        addLog(`${pid}: ${targets.map(c => c.name).join(", ")} を持ち主の手札へ`);
      }
      break;
    }
    case "bzToMana": {
      for (const pidx of pids) {
        const targets = stateOf(pidx).battle.filter(c => selectedUids.includes(c.uid));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids); return { ...s, battle: newBattle, mana: [...s.mana, ...extracted.map(c => ({ ...c, tapped: true }))] }; });
        addLog(`${pid}: ${targets.map(c => c.name).join(", ")} をマナゾーンへ`);
      }
      break;
    }
    case "bzToShield": {
      for (const pidx of pids) {
        const targets = stateOf(pidx).battle.filter(c => selectedUids.includes(c.uid));
        if (!targets.length) continue;
        const uids = targets.map(c => c.uid);
        setOf(pidx)(s => { const { newBattle, extracted } = extractManyFromBattle(s.battle, uids); return { ...s, battle: newBattle, shields: [...s.shields, ...extracted.map(c => ({ ...c, tapped: false, faceUp: false }))], shieldAddedThisTurn: true }; });
        ctx.shieldAddedFor = [...(ctx.shieldAddedFor || []), pidx];
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
    case "untapAllMana": {
      setSelf(s => ({ ...s, mana: s.mana.map(c => ({ ...c, tapped: false })) }));
      addLog(`${pid}: マナゾーンをすべてアンタップ`);
      break;
    }
    case "powerBuff": {
      for (const pidx of pids) {
        const st = stateOf(pidx);
        const targets = st.battle.filter(c => selectedUids.includes(c.uid));
        for (const card of targets) {
          const newBuff = { power: (card.tempBuff?.power || 0) + (effect.amount || 0), keywords: effect.keywords || card.tempBuff?.keywords, expires: effect.expires || "endOfTurn" };
          const projected = getEffectivePower({ ...card, tempBuff: newBuff }, st, st.battle);
          if (projected <= 0) {
            setOf(pidx)(s => { const { newBattle, extracted } = extractFromBattle(s.battle, card.uid); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
            addLog(`${pid}: ${card.name} のパワーを${effect.amount}（パワー0以下のため破壊）`);
            markDestroyed(card, pidx, false);
          } else {
            setOf(pidx)(s => ({ ...s, battle: s.battle.map(c => c.uid === card.uid ? { ...c, tempBuff: newBuff } : c) }));
            addLog(`${pid}: ${card.name} のパワーを${effect.amount > 0 ? "+" : ""}${effect.amount}`);
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
      const self = selfState.battle.find(c => c.uid === ctx.srcCardUid);
      if (!target || !self) break;
      const sEff = getEffectivePower(self, selfState, selfState.battle);
      const tEff = getEffectivePower(target, otherState, otherState.battle);
      addLog(`[VS] ${self.name}(${sEff}) vs ${target.name}(${tEff})`);
      if (tEff >= sEff) { setSelf(s => { const { newBattle, extracted } = extractFromBattle(s.battle, self.uid); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; }); addLog(`[LOST] ${self.name} 破壊`); markDestroyed(self, ownerPid, true); }
      if (sEff >= tEff) { setOther(s => { const { newBattle, extracted } = extractFromBattle(s.battle, target.uid); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; }); addLog(`[WIN] ${target.name} 破壊`); markDestroyed(target, oppPid, true); ctx.etbBattleWon = true; }
      break;
    }

    // ---------- 墓地・シールド ----------
    case "graveToBz": {
      const ownerOfGrave = effect.owner === "destroyed" ? ctx.destroyedCreatureOwner : ownerPid;
      if (!ownerOfGrave) break;
      const cards = stateOf(ownerOfGrave).grave.filter(c => selectedUids.includes(c.uid));
      if (!cards.length) break;
      const uids = cards.map(c => c.uid);
      setOf(ownerOfGrave)(s => ({ ...s, grave: s.grave.filter(c => !uids.includes(c.uid)),
        battle: [...s.battle, ...cards.map(c => ({ ...c, tapped: false, summonedThisTurn: !!effect.summoningSickness,
          ...(effect.tempKeywords ? { tempBuff: { keywords: effect.tempKeywords, expires: "endOfTurn" } } : {}),
          ...(effect.destroyAtEndOfTurn ? { endOfTurnEffect: { type: "destroySelf" } } : {}) }))] }));
      addLog(`${pid}: ${cards.map(c => c.name).join(", ")} を墓地からバトルゾーンへ`);
      break;
    }
    case "shieldToHand": {
      for (const pidx of pids) {
        const cards = stateOf(pidx).shields.filter(c => selectedUids.includes(c.uid));
        if (!cards.length) continue;
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, shields: s.shields.filter(c => !uids.includes(c.uid)), hand: [...s.hand, ...cards.map(c => ({ ...c, tapped: false, faceUp: false }))] }));
        addLog(`${pid}: シールド「${cards.map(c => c.name).join(", ")}」を手札へ（S・トリガー不使用）`);
        ctx.shieldLeftFor = [...(ctx.shieldLeftFor || []), pidx];
      }
      break;
    }
    case "shieldToGrave": {
      for (const pidx of pids) {
        const cards = stateOf(pidx).shields.filter(c => selectedUids.includes(c.uid));
        if (!cards.length) continue;
        const uids = cards.map(c => c.uid);
        setOf(pidx)(s => ({ ...s, shields: s.shields.filter(c => !uids.includes(c.uid)), grave: [...s.grave, ...cards] }));
        addLog(`${pid}: シールドを墓地へ`);
        ctx.shieldLeftFor = [...(ctx.shieldLeftFor || []), pidx];
      }
      break;
    }
    case "breakShield": {
      const targetPid = pids[0] === ownerPid && tgt !== "self" ? oppPid : pids[0];
      const shield = stateOf(targetPid).shields.find(c => selectedUids.includes(c.uid));
      if (!shield) break;
      setOf(targetPid)(s => ({ ...s, shields: s.shields.filter(c => c.uid !== shield.uid), hand: [...s.hand, { ...shield, tapped: false, faceUp: false }] }));
      addLog(`[BREAK] ${srcCard?.name}: シールドブレイク`);
      ctx.shieldLeftFor = [...(ctx.shieldLeftFor || []), targetPid];
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
  return ctx;
}
