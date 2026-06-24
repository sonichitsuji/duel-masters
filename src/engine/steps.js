import { KEYWORD_LABELS } from "../constants";
import { shuffle, extractFromBattle, extractManyFromBattle, getEffectivePower, getCardCivs, isElement } from "../gameLogic";

// ===========================
// STEP EFFECT SYSTEM
// ===========================
export function getStepCandidates(step, selfState, otherState, context, p1, p2, srcCard) {
  switch (step.type) {
    case "revealDeckTop": case "restRevealedToBottom": case "millTop":
    case "untapAllMana": case "destroyNonColor":
      return { candidates: context.revealedCards || [], isAuto: true };
    case "optionalReviveFromMilled": {
      const cards = (context.milledCards || []).filter(c => c.type === "creature");
      return { candidates: cards, isAuto: cards.length === 0 };
    }
    case "destroyChooseAny": {
      const all = [...p1.battle, ...p2.battle];
      return { candidates: all, isAuto: all.length === 0 };
    }
    case "reviveFromDestroyedOwnerGrave": {
      if (!context.destroyedCreatureOwner) return { candidates: [], isAuto: true };
      const ownerState = context.destroyedCreatureOwner === "p1" ? p1 : p2;
      const cards = ownerState.grave.filter(c => c.type === "creature");
      return { candidates: cards, isAuto: cards.length === 0 };
    }
    case "selectShieldToGrave": {
      const tgt = step.target === "opponent" ? otherState : selfState;
      return { candidates: tgt.shields, isAuto: false };
    }
    case "putFilteredFromHand": {
      let cards = selfState.hand.filter(c => c.type === "creature");
      if (step.filter?.keyword)      cards = cards.filter(c => c.keywords?.includes(step.filter.keyword));
      if (step.filter?.civ)          cards = cards.filter(c => getCardCivs(c).includes(step.filter.civ));
      if (step.filter?.maxCost != null) cards = cards.filter(c => c.cost <= step.filter.maxCost);
      if (step.filter?.raceContains) cards = cards.filter(c => c.race && c.race.includes(step.filter.raceContains));
      return { candidates: cards, isAuto: cards.length === 0 };
    }
    case "bzSelectToMana": {
      const tgt = step.target === "opponent" ? otherState : selfState;
      return { candidates: tgt.battle, isAuto: false };
    }
    case "manaCreatureSelectToBZ": {
      const cards = selfState.mana.filter(c => c.type === "creature");
      return { candidates: cards, isAuto: cards.length === 0 };
    }
    case "tapSelectCreature": {
      const tgt = step.target === "opponent" ? otherState : selfState;
      return { candidates: tgt.battle, isAuto: tgt.battle.length === 0 };
    }
    case "bounceSelectCreature": {
      const tgt = step.target === "opponent" ? otherState : selfState;
      return { candidates: tgt.battle, isAuto: false };
    }
    case "handDiscard": {
      const tgt = step.target === "opponent" ? otherState : selfState;
      return { candidates: tgt.hand, isAuto: false };
    }
    case "bounceMaxCost": {
      const maxCost = step.maxCost ?? 999;
      return { candidates: [...p1.battle, ...p2.battle].filter(c => c.cost <= maxCost), isAuto: false };
    }
    case "tapOrUntapSelectCreature": {
      const srcUid = srcCard?.uid;
      const all = [...p1.battle, ...p2.battle].filter(c => !srcUid || c.uid !== srcUid);
      return { candidates: all, isAuto: all.length === 0 };
    }
    case "millTopToMana":
      return { candidates: [], isAuto: true };
    case "millTopToManaIfDragon":
      return { candidates: [], isAuto: true };
    case "tapAllOpponent":
      return { candidates: [], isAuto: true };
    case "chooseFromRevealed": {
      let cards = context.revealedCards || [];
      if (step.filter?.type === "spell")    cards = cards.filter(c => c.type === "spell");
      if (step.filter?.type === "creature") cards = cards.filter(c => c.type === "creature");
      if (step.filter?.multiColor)          cards = cards.filter(c => Array.isArray(c.civ) && c.civ.length >= 2);
      if (step.filter?.raceContains) cards = cards.filter(c => c.race && c.race.includes(step.filter.raceContains));
      if (step.filter?.nameContains) cards = cards.filter(c => c.name && c.name.includes(step.filter.nameContains));
      const isAuto2 = step.takeAll === true;
      return { candidates: cards, isAuto: isAuto2, maxSelect: step.takeAll ? cards.length : (step.amount || 1) };
    }
    case "playFromRevealed": {
      let cards = context.revealedCards || [];
      if (step.filter?.raceContains) cards = cards.filter(c => c.race && c.race.includes(step.filter.raceContains));
      if (step.filter?.notNameSelf) cards = cards.filter(c => c.name !== srcCard?.name);
      return { candidates: cards, isAuto: false, maxSelect: cards.length, optional: true };
    }
    case "battleOpponentCreature": {
      return { candidates: otherState.battle, isAuto: false, maxSelect: 1, optional: true };
    }
    case "breakOpponentShieldChoice": {
      return { candidates: otherState.shields, isAuto: false, maxSelect: 1, optional: true };
    }
    case "untapSelectCreature": case "grantTempBuffToSelf": case "setUntapAfterAttack": case "grantSAUntapAfterAttack": {
      return { candidates: selfState.battle, isAuto: selfState.battle.length === 0, maxSelect: 1 };
    }
    case "castFilteredSpellFromHand": {
      let cards = selfState.hand.filter(c => c.type === "spell");
      if (step.filter?.civs?.length) cards = cards.filter(c => getCardCivs(c).some(cv => step.filter.civs.includes(cv)));
      if (step.filter?.maxCost != null) cards = cards.filter(c => c.cost <= step.filter.maxCost);
      return { candidates: cards, isAuto: cards.length === 0, maxSelect: 1 };
    }
    case "searchSpellToTop": {
      const cards = selfState.deck.filter(c => c.type === "spell");
      return { candidates: cards, isAuto: cards.length === 0, maxSelect: 1 };
    }
    case "reviveFilteredFromGrave": {
      let cards = selfState.grave.filter(c => c.type === "creature");
      if (step.filter?.maxCost != null) cards = cards.filter(c => c.cost <= step.filter.maxCost);
      return { candidates: cards, isAuto: cards.length === 0, maxSelect: 1 };
    }
    case "randomDiscardOpponent": case "discardHandDrawPlusOne": case "drawCardsPerTappedOpponent": case "drawCards":
      return { candidates: [], isAuto: true };
    // --- 新規ステップ型 (基盤フェーズ) ---
    case "debuffOpponentPower":
      return { candidates: otherState.battle, isAuto: otherState.battle.length === 0, maxSelect: 1 };
    case "bounceElement": {
      const cands = otherState.battle.filter(isElement);
      return { candidates: cands, isAuto: cands.length === 0, maxSelect: 1 };
    }
    case "shieldizeTopDeck": case "drawPerFilter":
      return { candidates: [], isAuto: true };
    case "returnShieldToHand":
      return { candidates: selfState.shields, isAuto: selfState.shields.length === 0, maxSelect: 1 };
    case "shieldizeFromHand":
      return { candidates: selfState.hand, isAuto: selfState.hand.length === 0, maxSelect: 1 };
    case "putFromHandFreeUnderHandCount": {
      const thr = selfState.hand.length;
      const cards = selfState.hand.filter(c => c.type !== "creature" && c.type !== "evo_creature" && c.cost <= thr);
      return { candidates: cards, isAuto: cards.length === 0, maxSelect: 1 };
    }
    case "castFreeSTriggerSpellFromHand": {
      const cards = selfState.hand.filter(c => c.type === "spell" && c.keywords?.includes("sTrigger"));
      return { candidates: cards, isAuto: cards.length === 0, maxSelect: 1 };
    }
    case "tapNoUntapNextTurn":
      return { candidates: otherState.battle, isAuto: otherState.battle.length === 0, maxSelect: 1 };
    case "playLightCreatureFromHand": {
      const cards = selfState.hand.filter(c => (c.type === "creature" || c.type === "evo_creature") && getCardCivs(c).includes("light") && c.cost <= (step.maxCost ?? 4));
      return { candidates: cards, isAuto: cards.length === 0, maxSelect: 1 };
    }
    case "scheduleReviveSubjectEndOfTurn": case "reviveSelfFromGrave":
      return { candidates: [], isAuto: true };
    case "shieldizeOpponentCreature":
      return { candidates: otherState.battle, isAuto: otherState.battle.length === 0, maxSelect: 1 };
    default:
      return { candidates: [], isAuto: true };
  }
}

export function executeStepAction(step, selectedUids, context, ownerPid, p1, setP1, p2, setP2, addLog, srcCard) {
  const selfState  = ownerPid === "p1" ? p1 : p2;
  const setSelf    = ownerPid === "p1" ? setP1 : setP2;
  const otherState = ownerPid === "p1" ? p2 : p1;
  const setOther   = ownerPid === "p1" ? setP2 : setP1;
  const pid = ownerPid === "p1" ? "P1" : "P2";
  const ctx = { ...context };

  switch (step.type) {
    case "revealDeckTop": {
      const n = Math.min(step.amount, selfState.deck.length);
      const revealed = selfState.deck.slice(0, n);
      setSelf(s => ({ ...s, deck: s.deck.slice(n) }));
      ctx.revealedCards = revealed;
      addLog(`${pid}: 山札の上から${n}枚を公開`);
      break;
    }
    case "chooseFromRevealed": {
      // If takeAll, auto-pick all filtered candidates
      let toTake;
      if (step.takeAll) {
        let candidates = context.revealedCards || [];
        if (step.filter?.nameContains) candidates = candidates.filter(c => c.name && c.name.includes(step.filter.nameContains));
        if (step.filter?.raceContains) candidates = candidates.filter(c => c.race && c.race.includes(step.filter.raceContains));
        if (step.filter?.type === "spell")    candidates = candidates.filter(c => c.type === "spell");
        if (step.filter?.type === "creature") candidates = candidates.filter(c => c.type === "creature");
        toTake = candidates;
      } else {
        toTake = (context.revealedCards || []).filter(c => selectedUids.includes(c.uid));
      }
      const dest = step.destination || "hand";
      const destLabel = dest === "hand" ? "手札" : dest === "battle" ? "BZ" : dest === "deckTop" ? "山札の上" : dest;
      if (toTake.length > 0) {
        if (dest === "hand")     setSelf(s => ({ ...s, hand: [...s.hand, ...toTake.map(c => ({ ...c, tapped: false }))] }));
        else if (dest === "battle")  setSelf(s => ({ ...s, battle: [...s.battle, ...toTake.map(c => ({ ...c, tapped: false, summonedThisTurn: false }))] }));
        else if (dest === "deckTop") setSelf(s => ({ ...s, deck: [...toTake, ...s.deck] }));
        addLog(`${pid}: ${toTake.map(c => c.name).join(", ")} → ${destLabel}`);
      }
      const takenUids = toTake.map(c => c.uid);
      ctx.revealedCards = (context.revealedCards || []).filter(c => !takenUids.includes(c.uid));
      break;
    }
    case "restRevealedToBottom": {
      const rem = context.revealedCards || [];
      if (rem.length > 0) { setSelf(s => ({ ...s, deck: [...s.deck, ...rem] })); addLog(`${pid}: 残り${rem.length}枚をデッキ下へ`); }
      ctx.revealedCards = [];
      break;
    }
    case "millTop": {
      const n = Math.min(step.amount, selfState.deck.length);
      const milled = selfState.deck.slice(0, n);
      setSelf(s => ({ ...s, deck: s.deck.slice(n), grave: [...s.grave, ...milled] }));
      ctx.milledCards = milled;
      addLog(`${pid}: 山札の上から${n}枚を墓地へ`);
      break;
    }
    case "optionalReviveFromMilled": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = (context.milledCards || []).find(c => c.uid === uid && c.type === "creature");
        if (card) {
          setSelf(s => ({ ...s, grave: s.grave.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: false }] }));
          addLog(`${pid}: ${card.name} 墓地→BZ`);
        }
      }
      break;
    }
    case "destroyChooseAny": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        let owner = null;
        setP1(s => { const {newBattle,extracted} = extractFromBattle(s.battle, uid); if (extracted.length) { owner = "p1"; return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; } return s; });
        setP2(s => { const {newBattle,extracted} = extractFromBattle(s.battle, uid); if (extracted.length) { owner = "p2"; return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; } return s; });
        const card = [...p1.battle, ...p2.battle].find(c => c.uid === uid);
        ctx.destroyedCreatureOwner = card ? (p1.battle.includes(card) ? "p1" : "p2") : null;
        if (card) addLog(`${pid}: ${card.name} 破壊`);
      } else {
        ctx.destroyedCreatureOwner = null;
      }
      break;
    }
    case "reviveFromDestroyedOwnerGrave": {
      const ownerPidC = context.destroyedCreatureOwner;
      if (!ownerPidC || selectedUids.length === 0) break;
      const setOwner = ownerPidC === "p1" ? setP1 : setP2;
      const uid = selectedUids[0];
      setOwner(s => {
        const card = s.grave.find(c => c.uid === uid);
        if (!card) return s;
        addLog(`${pid}: ${card.name} 墓地→BZ`);
        return { ...s, grave: s.grave.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: false }] };
      });
      break;
    }
    case "untapAllMana": {
      setSelf(s => ({ ...s, mana: s.mana.map(c => ({ ...c, tapped: false })) }));
      addLog(`${pid}: マナゾーンをすべてアンタップ`);
      break;
    }
    case "destroyNonColor": {
      const col = step.color;
      const colMatch = c => getCardCivs(c).includes(col);
      setP1(s => { const deadUids = s.battle.filter(c => !colMatch(c)).map(c=>c.uid); const {newBattle,extracted} = extractManyFromBattle(s.battle, deadUids); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
      setP2(s => { const deadUids = s.battle.filter(c => !colMatch(c)).map(c=>c.uid); const {newBattle,extracted} = extractManyFromBattle(s.battle, deadUids); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
      const total = [...p1.battle, ...p2.battle].filter(c => !colMatch(c)).length;
      addLog(`${pid}: ${col}以外のクリーチャーを${total}体破壊`);
      break;
    }
    case "selectShieldToGrave": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const setTgt = step.target === "opponent" ? setOther : setSelf;
        setTgt(s => { const c = s.shields.find(x => x.uid === uid); if (!c) return s; addLog(`${pid}: シールドを墓地へ`); return { ...s, shields: s.shields.filter(x => x.uid !== uid), grave: [...s.grave, c] }; });
      }
      break;
    }
    case "putFilteredFromHand": {
      if (selectedUids.length > 0) {
        const cards = selfState.hand.filter(c => selectedUids.includes(c.uid));
        const kw = step.tempKeyword;
        setSelf(s => ({ ...s, hand: s.hand.filter(c => !selectedUids.includes(c.uid)), battle: [...s.battle, ...cards.map(c => ({ ...c, tapped: false, summonedThisTurn: false, grantedKeywords: kw ? [...(c.grantedKeywords || []), kw] : c.grantedKeywords }))] }));
        addLog(`${pid}: ${cards.map(c => c.name).join(", ")} → BZ`);
      }
      break;
    }
    case "bzSelectToMana": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const setTgt = step.target === "opponent" ? setOther : setSelf;
        const tgtState = step.target === "opponent" ? otherState : selfState;
        const card = tgtState.battle.find(c => c.uid === uid);
        if (card) { setTgt(s => { const {newBattle,extracted} = extractFromBattle(s.battle, uid); return { ...s, battle: newBattle, mana: [...s.mana, ...extracted.map(c=>({...c,tapped:true}))] }; }); addLog(`${pid}: ${card.name} → マナ`); }
      }
      break;
    }
    case "manaCreatureSelectToBZ": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.mana.find(c => c.uid === uid);
        if (card) { setSelf(s => ({ ...s, mana: s.mana.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: false }] })); addLog(`${pid}: ${card.name} マナ→BZ`); }
      }
      break;
    }
    case "tapSelectCreature": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const setTgt = step.target === "opponent" ? setOther : setSelf;
        const tgtState = step.target === "opponent" ? otherState : selfState;
        const card = tgtState.battle.find(c => c.uid === uid);
        setTgt(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tapped: true } : c) }));
        if (card) addLog(`${pid}: ${card.name} タップ`);
      }
      break;
    }
    case "bounceSelectCreature": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const setTgt = step.target === "opponent" ? setOther : setSelf;
        const tgtState = step.target === "opponent" ? otherState : selfState;
        const card = tgtState.battle.find(c => c.uid === uid);
        if (card) { setTgt(s => { const {newBattle,extracted} = extractFromBattle(s.battle, uid); return { ...s, battle: newBattle, hand: [...s.hand, ...extracted.map(c=>({ ...c, tapped: false, hyperMode: false, cantAttackThisTurn: false, summonedThisTurn: false }))] }; }); addLog(`${pid}: ${card.name} → 手札`); }
      }
      break;
    }
    case "handDiscard": {
      const tgtState = step.target === "opponent" ? otherState : selfState;
      const setTgt   = step.target === "opponent" ? setOther   : setSelf;
      const cards = tgtState.hand.filter(c => selectedUids.includes(c.uid));
      if (cards.length > 0) { setTgt(s => ({ ...s, hand: s.hand.filter(c => !selectedUids.includes(c.uid)), grave: [...s.grave, ...cards] })); addLog(`${pid}: ${cards.map(c => c.name).join(", ")} 捨てる`); ctx.discardedBy = [...(ctx.discardedBy || []), step.target === "opponent" ? (ownerPid === "p1" ? "p2" : "p1") : ownerPid]; }
      break;
    }
    case "bounceMaxCost": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        setP1(s => { const c = s.battle.find(x => x.uid === uid); if (!c) return s; addLog(`${pid}: ${c.name} → P1手札`); const {newBattle,extracted} = extractFromBattle(s.battle, uid); return { ...s, battle: newBattle, hand: [...s.hand, ...extracted.map(c=>({ ...c, tapped: false, hyperMode: false, cantAttackThisTurn: false, summonedThisTurn: false }))] }; });
        setP2(s => { const c = s.battle.find(x => x.uid === uid); if (!c) return s; addLog(`${pid}: ${c.name} → P2手札`); const {newBattle,extracted} = extractFromBattle(s.battle, uid); return { ...s, battle: newBattle, hand: [...s.hand, ...extracted.map(c=>({ ...c, tapped: false, hyperMode: false, cantAttackThisTurn: false, summonedThisTurn: false }))] }; });
      }
      break;
    }
    case "tapOrUntapSelectCreature": {
      selectedUids.forEach(uid => {
        setP1(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tapped: !c.tapped } : c) }));
        setP2(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tapped: !c.tapped } : c) }));
      });
      if (selectedUids.length > 0) addLog(`${pid}: ${selectedUids.length}体をタップ/アンタップ`);
      break;
    }
    case "millTopToMana": {
      const n = Math.min(step.amount ?? 1, selfState.deck.length);
      if (n > 0) {
        const milled = selfState.deck.slice(0, n).map(c => ({ ...c, tapped: true }));
        setSelf(s => ({ ...s, deck: s.deck.slice(n), mana: [...s.mana, ...milled] }));
        ctx.milledToMana = [...(context.milledToMana || []), ...milled];
        addLog(`${pid}: ${milled.map(c => c.name).join(", ")} → マナ(タップ)`);
      }
      break;
    }
    case "millTopToManaIfDragon": {
      const lastMilled = (context.milledToMana || []).slice(-1)[0];
      if (lastMilled?.race?.includes("ドラゴン") && selfState.deck.length > 0) {
        const card2 = { ...selfState.deck[0], tapped: true };
        setSelf(s => ({ ...s, deck: s.deck.slice(1), mana: [...s.mana, card2] }));
        ctx.milledToMana = [...(context.milledToMana || []), card2];
        addLog(`${pid}: ${card2.name} → マナ(タップ)（ドラゴン追加）`);
      } else {
        addLog(`${pid}: ドラゴンでないためスキップ`);
      }
      break;
    }
    case "tapAllOpponent": {
      setOther(s => ({ ...s, battle: s.battle.map(c => ({ ...c, tapped: true })) }));
      addLog(`${pid}: 相手のクリーチャーをすべてタップ`);
      break;
    }
    case "playFromRevealed": {
      const toPlay = (context.revealedCards || []).filter(c => selectedUids.includes(c.uid));
      if (toPlay.length > 0) {
        setSelf(s => ({ ...s, battle: [...s.battle, ...toPlay.map(c => ({ ...c, tapped: false, summonedThisTurn: false }))] }));
        addLog(`${pid}: ${toPlay.map(c => c.name).join(", ")} → BZ（無償）`);
      }
      ctx.revealedCards = (context.revealedCards || []).filter(c => !selectedUids.includes(c.uid));
      break;
    }
    case "battleOpponentCreature": {
      if (selectedUids.length === 0) break;
      const target = otherState.battle.find(c => c.uid === selectedUids[0]);
      const self = selfState.battle.find(c => c.uid === context.srcCardUid);
      if (!target || !self) break;
      const sEff = getEffectivePower(self, selfState, selfState.battle);
      const tEff = getEffectivePower(target, otherState, otherState.battle);
      addLog(`[VS] ${self.name}(${sEff}) vs ${target.name}(${tEff}) [ETBバトル]`);
      const sWin = sEff >= tEff;
      const tWin = tEff >= sEff;
      if (tWin) {
        const { newBattle: nb1, extracted: ex1 } = extractFromBattle(selfState.battle, self.uid);
        setSelf(s => ({ ...s, battle: nb1, grave: [...s.grave, ...ex1] }));
        addLog(`[LOST] ${self.name} 破壊（ETBバトル）`);
      }
      if (sWin) {
        const { newBattle: nb2, extracted: ex2 } = extractFromBattle(otherState.battle, target.uid);
        setOther(s => ({ ...s, battle: nb2, grave: [...s.grave, ...ex2] }));
        addLog(`[WIN] ${target.name} 破壊（ETBバトル）`);
        ctx.etbBattleWon = true;
      }
      break;
    }
    case "breakOpponentShieldChoice": {
      if (selectedUids.length === 0) break;
      const uid = selectedUids[0];
      const shield = otherState.shields.find(c => c.uid === uid);
      if (!shield) break;
      setOther(s => ({ ...s, shields: s.shields.filter(c => c.uid !== uid), hand: [...s.hand, { ...shield, tapped: false }] }));
      addLog(`[BREAK] ${srcCard?.name}: シールドブレイク「${shield.name}」`);
      break;
    }
    case "untapSelectCreature": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const tb = step.tempBuff;
        const card = selfState.battle.find(c => c.uid === uid);
        setSelf(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tapped: false, tempBuff: tb ? { ...tb } : c.tempBuff } : c) }));
        if (card) addLog(`${pid}: ${card.name} をアンタップ${tb ? "・効果付与" : ""}`);
      }
      break;
    }
    case "castFilteredSpellFromHand": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const spellCard = selfState.hand.find(c => c.uid === uid);
        if (spellCard) {
          setSelf(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), grave: [...s.grave, spellCard] }));
          addLog(`${pid}: 「${spellCard.name}」をコストを支払わずに唱えた`);
          ctx.castSpell = { card: spellCard, ownerPid };
        }
      }
      break;
    }
    case "grantTempBuffToSelf": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.battle.find(c => c.uid === uid);
        setSelf(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tempBuff: { power: step.power, keywords: step.keywords, expires: step.expires || "endOfTurn" } } : c) }));
        if (card) addLog(`${pid}: ${card.name} に「${(step.keywords || []).map(k => KEYWORD_LABELS[k] || k).join("/")}」を付与`);
      }
      break;
    }
    case "setUntapAfterAttack": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.battle.find(c => c.uid === uid);
        setSelf(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, untapAfterAttack: true } : c) }));
        if (card) addLog(`${pid}: ${card.name} は最初の攻撃の終わりにアンタップする`);
      }
      break;
    }
    case "grantSAUntapAfterAttack": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.battle.find(c => c.uid === uid);
        setSelf(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tempBuff: { keywords: ["speedAttacker"], expires: "endOfTurn" }, untapAfterAttack: true } : c) }));
        if (card) addLog(`${pid}: ${card.name} に「スピードアタッカー」を付与し、最初の攻撃の終わりにアンタップする`);
      }
      break;
    }
    case "searchSpellToTop": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.deck.find(c => c.uid === uid);
        if (card) {
          setSelf(s => ({ ...s, deck: [card, ...shuffle(s.deck.filter(c => c.uid !== uid))] }));
          addLog(`${pid}: 「${card.name}」を山札の一番上に置いた`);
        }
      } else {
        setSelf(s => ({ ...s, deck: shuffle(s.deck) }));
        addLog(`${pid}: 山札をシャッフル`);
      }
      break;
    }
    case "reviveFilteredFromGrave": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.grave.find(c => c.uid === uid);
        if (card) {
          setSelf(s => ({ ...s, grave: s.grave.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: false, tempBuff: { keywords: ["speedAttacker"], expires: "endOfTurn" }, endOfTurnEffect: { type: "destroySelf" } }] }));
          addLog(`${pid}: ${card.name} を墓地からBZへ（スピードアタッカー付与、ターン終了時に破壊）`);
        }
      }
      break;
    }
    case "randomDiscardOpponent": {
      if (otherState.hand.length > 0) {
        const idx = Math.floor(Math.random() * otherState.hand.length);
        const card = otherState.hand[idx];
        setOther(s => ({ ...s, hand: s.hand.filter((_, i) => i !== idx), grave: [...s.grave, card] }));
        addLog(`${pid}: 相手の手札を見ないで1枚選び、捨てさせた`);
        ctx.discardedBy = [...(ctx.discardedBy || []), ownerPid === "p1" ? "p2" : "p1"];
      }
      break;
    }
    case "discardHandDrawPlusOne": {
      const n = selfState.hand.length;
      const drawN = Math.min(n + 1, selfState.deck.length);
      setSelf(s => ({ ...s, hand: s.deck.slice(0, drawN), grave: [...s.grave, ...s.hand], deck: s.deck.slice(drawN) }));
      addLog(`${pid}: 手札${n}枚を捨て、${drawN}枚ドロー`);
      break;
    }
    case "drawCardsPerTappedOpponent": {
      const tappedCount = otherState.battle.filter(c => c.tapped).length;
      const n = Math.min(tappedCount, selfState.deck.length);
      if (n > 0) setSelf(s => ({ ...s, hand: [...s.hand, ...s.deck.slice(0, n)], deck: s.deck.slice(n) }));
      addLog(`${pid}: 相手のタップしているクリーチャー${tappedCount}体につき、${n}枚ドロー`);
      break;
    }
    case "drawCards": {
      const n = Math.min(step.amount ?? 1, selfState.deck.length);
      if (n > 0) setSelf(s => ({ ...s, hand: [...s.hand, ...s.deck.slice(0, n)], deck: s.deck.slice(n) }));
      addLog(`${pid}: ${n}枚ドロー`);
      break;
    }
    // --- 新規ステップ型 (基盤フェーズ) ---
    case "debuffOpponentPower": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const amt = step.amount ?? 0;
        const card = otherState.battle.find(c => c.uid === uid);
        if (card) {
          const newBuff = { power: (card.tempBuff?.power || 0) - amt, keywords: card.tempBuff?.keywords, expires: "endOfTurn" };
          const projected = getEffectivePower({ ...card, tempBuff: newBuff }, otherState, otherState.battle);
          if (projected <= 0) {
            setOther(s => { const { newBattle, extracted } = extractFromBattle(s.battle, uid); return { ...s, battle: newBattle, grave: [...s.grave, ...extracted] }; });
            addLog(`${pid}: ${card.name} のパワーを-${amt}（パワー0以下のため破壊）`);
            const oppPid = ownerPid === "p1" ? "p2" : "p1";
            ctx.destroyedThisStep = [...(ctx.destroyedThisStep || []), { card, ownerPid: oppPid, viaBattle: false }];
          } else {
            setOther(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tempBuff: newBuff } : c) }));
            addLog(`${pid}: ${card.name} のパワーを-${amt}（このターン）`);
          }
        }
      }
      break;
    }
    case "bounceElement": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = otherState.battle.find(c => c.uid === uid);
        if (card) {
          setOther(s => { const { newBattle, extracted } = extractFromBattle(s.battle, uid); return { ...s, battle: newBattle, hand: [...s.hand, ...extracted.map(c => ({ ...c, tapped: false, summonedThisTurn: false, hyperMode: false, tempBuff: undefined }))] }; });
          addLog(`${pid}: 相手の${card.name} を持ち主の手札に戻した`);
        }
      }
      break;
    }
    case "shieldizeTopDeck": {
      setSelf(s => { if (s.deck.length === 0) return s; const [top, ...rest] = s.deck; addLog(`${pid}: 山札の上から1枚をシールド化`); return { ...s, deck: rest, shields: [...s.shields, { ...top, tapped: false, faceUp: false }], shieldAddedThisTurn: true }; });
      ctx.shieldAddedFor = [...(ctx.shieldAddedFor || []), ownerPid];
      break;
    }
    case "returnShieldToHand": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        setSelf(s => { const sh = s.shields.find(x => x.uid === uid); if (!sh) return s; addLog(`${pid}: シールド「${sh.name}」を手札へ（S・トリガー不使用）`); return { ...s, shields: s.shields.filter(x => x.uid !== uid), hand: [...s.hand, { ...sh, tapped: false, faceUp: false }] }; });
      }
      break;
    }
    case "shieldizeFromHand": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        setSelf(s => { const c = s.hand.find(x => x.uid === uid); if (!c) return s; addLog(`${pid}: ${c.name} をシールド化`); return { ...s, hand: s.hand.filter(x => x.uid !== uid), shields: [...s.shields, { ...c, tapped: false, faceUp: false }], shieldAddedThisTurn: true }; });
        ctx.shieldAddedFor = [...(ctx.shieldAddedFor || []), ownerPid];
      }
      break;
    }
    case "putFromHandFreeUnderHandCount": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.hand.find(c => c.uid === uid);
        if (card) {
          if (card.type === "spell") {
            setSelf(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), grave: [...s.grave, card] }));
            addLog(`${pid}: 「${card.name}」をコストを支払わず実行`);
            ctx.castSpell = { card, ownerPid };
          } else if (card.type === "castle") {
            setSelf(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), shields: [...s.shields, { ...card, tapped: false, faceUp: true }] }));
            addLog(`${pid}: 「${card.name}」を表向きシールド化`);
          } else {
            setSelf(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: false }] }));
            addLog(`${pid}: 「${card.name}」をバトルゾーンへ`);
          }
        }
      }
      break;
    }
    case "castFreeSTriggerSpellFromHand": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.hand.find(c => c.uid === uid);
        if (card) { setSelf(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), grave: [...s.grave, card] })); addLog(`${pid}: S・トリガー呪文「${card.name}」を無償で唱えた`); ctx.castSpell = { card, ownerPid }; }
      }
      break;
    }
    case "drawPerFilter": {
      const f = step.filter || {};
      const count = selfState.battle.filter(c => {
        if (f.element && !isElement(c)) return false;
        if (f.creatureOnly && !(c.type === "creature" || c.type === "evo_creature")) return false;
        if (f.civ && !getCardCivs(c).includes(f.civ)) return false;
        if (f.maxCost != null && !(c.cost <= f.maxCost)) return false;
        return true;
      }).length;
      const n = Math.min(count, selfState.deck.length);
      if (n > 0) setSelf(s => ({ ...s, hand: [...s.hand, ...s.deck.slice(0, n)], deck: s.deck.slice(n) }));
      addLog(`${pid}: 条件一致${count}につき${n}枚ドロー`);
      break;
    }
    case "tapNoUntapNextTurn": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = otherState.battle.find(c => c.uid === uid);
        setOther(s => ({ ...s, battle: s.battle.map(c => c.uid === uid ? { ...c, tapped: true, noUntapNextTurn: true } : c) }));
        if (card) addLog(`${pid}: 相手の${card.name} をタップ（次の相手ターンに起きない）`);
      }
      break;
    }
    case "playLightCreatureFromHand": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = selfState.hand.find(c => c.uid === uid);
        if (card) { setSelf(s => ({ ...s, hand: s.hand.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: true }] })); addLog(`${pid}: 光のクリーチャー「${card.name}」を手札から出した`); }
      }
      break;
    }
    case "scheduleReviveSubjectEndOfTurn": {
      // 「そのクリーチャー」をこのターンの終わりに墓地から出す（pendingRevive へ予約）
      const subj = context.subjectCard;
      if (subj) { setSelf(s => ({ ...s, pendingRevive: [...(s.pendingRevive || []), subj] })); addLog(`${pid}: ${subj.name} をこのターンの終わりに墓地から出す（予約）`); }
      break;
    }
    case "reviveSelfFromGrave": {
      // 墓地にいるこのカード自身（srcCard）をバトルゾーンへ
      const uid = srcCard?.uid;
      const card = uid && selfState.grave.find(c => c.uid === uid);
      if (card) { setSelf(s => ({ ...s, grave: s.grave.filter(c => c.uid !== uid), battle: [...s.battle, { ...card, tapped: false, summonedThisTurn: true }] })); addLog(`${pid}: ${card.name} を墓地からバトルゾーンへ`); }
      break;
    }
    case "shieldizeOpponentCreature": {
      if (selectedUids.length > 0) {
        const uid = selectedUids[0];
        const card = otherState.battle.find(c => c.uid === uid);
        if (card) { setOther(s => { const { newBattle, extracted } = extractFromBattle(s.battle, uid); return { ...s, battle: newBattle, shields: [...s.shields, ...extracted.map(c => ({ ...c, tapped: false, faceUp: false }))] }; }); addLog(`${pid}: 相手の${card.name} をシールド化`); ctx.shieldAddedFor = [...(ctx.shieldAddedFor || []), ownerPid === "p1" ? "p2" : "p1"]; }
      }
      break;
    }
    default: addLog(`[未実装ステップ] ${step.type}`);
  }
  return ctx;
}
