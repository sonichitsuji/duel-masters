import { useState, useCallback, useEffect, useRef } from "react";
import { initPlayerState, tapManaByUids, getEffectivePower, extractFromBattle, computeGrantedKeywords, checkGrantCondition, getCardTriggers, getCardActivated, hasKeyword, getBreakCount, evolutionSpec, findLoseReplacement, findLeaveReplacement, sTriggerSide, isCreatureSide, isUnselectableByOpponent } from "../gameLogic";
import { executeEffect, matchFilter, shouldStopChain } from "../engine/effects";
import { CARD_TYPE_LABELS, ZONE_LABELS } from "../constants";
import { CutIn, HyperModeCutIn } from "../components/CutIn";
import { HandoffScreen } from "./HandoffScreen";
import { EffectStepModal } from "../components/modals/EffectStepModal";
import { TemplateChoiceModal } from "../components/modals/TemplateChoiceModal";
import { TriggerOrderModal } from "../components/modals/TriggerOrderModal";
import { BlockerModal } from "../components/modals/BlockerModal";
import { ActivatedAbilityModal } from "../components/modals/ActivatedAbilityModal";
import { FinalRevolutionModal } from "../components/modals/FinalRevolutionModal";
import { GStrikeModal } from "../components/modals/GStrikeModal";
import { HyperUntapModal, HyperTargetedModal } from "../components/modals/HyperModals";
import { ReplacementModal } from "../components/modals/ReplacementModal";
import { PlayerBoard } from "../components/PlayerBoard";
import { StepIndicator } from "../components/BoardWidgets";

// 誘発の宣言と発生イベントのマッチング
// tr.on: イベント名 / tr.target: "this"(このカード自身) | "self"(自分の) | "opponent"(相手の) | "both"
// tr.filter: 主体カードの条件（効果と同じ filter 語彙） / tr.method: creaturePutBz の "summon"|"put"
// ev: { sourcePid, subjectCard?, method?, firstThisTurn? }
const DEFAULT_TRIGGER_SCOPE = {
  creaturePutBz:"this", leave:"this", destroyed:"this", battleDestroy:"this", attack:"this", attackEnd:"this",
  battleWin:"this",
  castSpell:"self", draw:"self", discard:"self", shieldAdded:"self", shieldLeave:"self",
  startOfTurn:"self", endOfTurn:"self",
};
// 主体カードがバトルゾーンに残っている時だけ、その主体自身の能力が誘発するイベント
// （攻撃の終わり: 戦闘で破壊された攻撃クリーチャーの「攻撃の終わりに」は誘発しない）
const SUBJECT_MUST_BE_IN_BZ = new Set(["attackEnd", "battleWin"]);
// この誘発が「自分自身に起きた出来事」を見るのか、プレイヤーのイベントを見張るのか
function triggerScope(tr, event){ return tr.target || DEFAULT_TRIGGER_SCOPE[event] || "self"; }

function matchTrigger(tr, event, watcherPid, watcherCard, ev){
  if(tr.on !== event) return false;
  const scope = triggerScope(tr, event);
  const subj = ev.subjectCard;
  if(scope === "this"){
    if(!subj || !watcherCard || subj.uid !== watcherCard.uid) return false;
  } else if(scope === "self"){
    if(ev.sourcePid !== watcherPid) return false;
  } else if(scope === "opponent"){
    if(ev.sourcePid === watcherPid) return false;
  }
  if(tr.method && ev.method && tr.method !== ev.method) return false;
  if(tr.firstEachTurn && !ev.firstThisTurn) return false;
  if(tr.filter && subj && !matchFilter(subj, tr.filter, {})) return false;
  return true;
}

// #3 常在型能力の事前適用（枠組み）。例: 相手の「クリーチャーを出せない」常在型を、
// クリーチャーを出す処理に先んじてチェックして中止する。現状は該当カードが無いため常に false。
// データ形: カードに staticDeny:{ type:"cantPutCreature", filter? } を持たせ、その支配者の「相手」に効く。
// 判定対象は「出るクリーチャー自身の出所(fromZone)」だけ。進化元のゾーンは一切見ない
// （進化元はバトルゾーンに出たことにならないため）。
function checkStaticDeny(state, targetPid, type, fromZone="hand"){
  for(const pid of ["p1","p2"]){
    if(pid===targetPid) continue; // 自分の常在型は自分のプレイを止めない（「相手は〜できない」想定）
    const st=state?.[pid]; if(!st) continue;
    const sources=[...(st.battle||[]),...((st.shields||[]).filter(s=>s.faceUp))];
    if(sources.some(c=>{
      const d=c.staticDeny;
      if(d?.type!==type) return false;
      // 「手札以外からバトルゾーンに出せない」は手札から出す場合には効かない
      if(type==="cantPutCreatureFromNonHand") return fromZone!=="hand";
      return true;
    })) return true;
  }
  return false;
}

// ===========================
// BATTLE SCREEN
// ===========================
export function BattleScreen({p1DeckIds,p2DeckIds,cardDb,onBackToMenu}){
  const [p1,setP1]=useState(()=>initPlayerState(p1DeckIds,cardDb));
  const [p2,setP2]=useState(()=>initPlayerState(p2DeckIds,cardDb));
  const [active,setActive]=useState("p1");
  const [drewThisTurn,setDrewThisTurn]=useState(true);
  const [chargedThisTurn,setChargedThisTurn]=useState(false);
  const [attackingUid,setAttackingUid]=useState(null);
  const [logs,setLogs]=useState(["ゲーム開始！P1のターンです。"]);
  const [message,setMessage]=useState("P1: マナチャージorカードをプレイ");
  const [winner,setWinner]=useState(null);
  const [winReason,setWinReason]=useState(null); // "direct" | "deckout" | "exwin"
  const [handoff,setHandoff]=useState(null);
  const [turn,setTurn]=useState(1);
  const [cutin,setCutin]=useState(null);
  const [hyperModeCutIn,setHyperModeCutIn]=useState(null);
  const [usedFinalRevThisTurn,setUsedFinalRevThisTurn]=useState(false);
  const [finalRevModal,setFinalRevModal]=useState(false);
  const [activeSteps,setActiveSteps]=useState(null);
  const [pendingEffects,setPendingEffects]=useState([]);
  const [triggerOrderModal,setTriggerOrderModal]=useState(null);
  const [gStrikeModal,setGStrikeModal]=useState(null);
  const [hyperUntapModal,setHyperUntapModal]=useState(null);
  const [hyperTargetedModal,setHyperTargetedModal]=useState(null);
  const [templateChoiceModal,setTemplateChoiceModal]=useState(null);

  const addLog=useCallback(msg=>setLogs(p=>[...p,msg]),[]);
  const [isPC,setIsPC]=useState(()=>window.innerWidth>=768);
  useEffect(()=>{const fn=()=>setIsPC(window.innerWidth>=768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  const showCutIn=useCallback(data=>setCutin(data),[]);

  const otherPid=active==="p1"?"p2":"p1";
  const activeState=active==="p1"?p1:p2;
  const otherState=active==="p1"?p2:p1;
  const setActiveState=active==="p1"?setP1:setP2;
  const setOtherState=active==="p1"?setP2:setP1;
  // 汎用トリガー/置換が常に最新の盤面を読めるよう ref に保持
  const stateRef=useRef({p1,p2});
  stateRef.current={p1,p2};
  const fireTriggerRef=useRef();
  const onTargetedRef=useRef();
  const enqueueEffectRef=useRef();
  const pendingIdRef=useRef(0);
  const [replacementModal,setReplacementModal]=useState(null);
  const [attackedThisTurn,setAttackedThisTurn]=useState(false);
  const [hyperUnlockModal,setHyperUnlockModal]=useState(null);
  const [blockerModal,setBlockerModal]=useState(null);
  // 「各ターンに一度」「ゲーム中に一度」の使用済みキー（`${uid}#a${i}` 起動型 / `${uid}#t${i}` 誘発型）
  const [usedThisTurn,setUsedThisTurn]=useState(()=>new Set());
  const [usedThisGame,setUsedThisGame]=useState(()=>new Set());
  const [activatedModal,setActivatedModal]=useState(null);
  // 墓地・マナからの召喚許可を、そのターンに何回使ったか（{ permKey: 回数 }）
  const [summonUsed,setSummonUsed]=useState({});
  const usedRef=useRef({turn:usedThisTurn,game:usedThisGame});
  usedRef.current={turn:usedThisTurn,game:usedThisGame};
  const isAbilityUsed=(ab,key)=>(ab.oncePerGame&&usedRef.current.game.has(key))||(ab.oncePerTurn&&usedRef.current.turn.has(key));
  const markAbilityUsed=(ab,key)=>{
    if(!key) return;
    if(ab?.oncePerGame) setUsedThisGame(s=>new Set(s).add(key));
    else if(ab?.oncePerTurn) setUsedThisTurn(s=>new Set(s).add(key));
  };

  // 効果を pending キューへ積む（front=true で先頭=LIFO, #6枠組み）
  const enqueueEffect=(entry,{front=false}={})=>{
    if(!entry?.effect) return;
    const e={ id:`pe${++pendingIdRef.current}`, kind:entry.kind||"trigger", priority: entry.priority ?? (entry.ownerPid===active?0:1), ...entry };
    setPendingEffects(p=> front?[e,...p]:[...p,e]);
  };
  enqueueEffectRef.current=enqueueEffect;

  // pending から取り出したエントリを実際に解決開始する
  const resolveEntry=(entry)=>{
    const {effect,ownerPid,srcCard,subjectCard,sourceName}=entry;
    if(entry.onceKey) markAbilityUsed(effect,entry.onceKey);
    showCutIn({title:"効果発動！",cardName:sourceName||srcCard?.name,civ:Array.isArray(srcCard?.civ)?srcCard.civ[0]:srcCard?.civ||"fire"});
    if(effect.type==="chooseTimes"){
      setTemplateChoiceModal({count:effect.count,templates:effect.templates,ownerPid,srcCard});
    } else if(effect.effects?.length){
      setActiveSteps({ steps:effect.effects, stepIdx:0, ownerPid, srcCard, context:{ srcCardUid:srcCard?.uid, subjectCard, vars:{} } });
    }
  };

  // 順序選択リゾルバ：アイドル時に pending を1件ずつ解決。ターンプレイヤー優先、同時複数はモーダルで任意順。
  // #2 直列化: 解決系・対話系モーダルが1つでも開いていれば次を始めない。
  const resolverBusy = activeSteps||templateChoiceModal||triggerOrderModal||replacementModal||gStrikeModal||finalRevModal||hyperUntapModal||hyperTargetedModal||hyperUnlockModal||blockerModal||activatedModal||handoff||winner;
  useEffect(()=>{
    if(resolverBusy) return;
    if(pendingEffects.length===0) return;
    const minP=Math.min(...pendingEffects.map(e=>e.priority));
    const group=pendingEffects.filter(e=>e.priority===minP);
    // 呪文は順序固定（割り込ませず enqueue 順で解決）。誘発が2件以上、または任意誘発(単体でも)は選択モーダル。
    // 起動型能力はプレイヤーが既に「使う」と宣言しているので確認しない。
    const spell=group.find(e=>e.kind==="spell");
    if(spell){
      setPendingEffects(p=>p.filter(e=>e.id!==spell.id));
      resolveEntry(spell);
    } else if(group.length>1 || (group[0].effect?.optional && group[0].kind!=="activated")){
      setTriggerOrderModal({entries:group});
    } else {
      setPendingEffects(p=>p.filter(e=>e.id!==group[0].id));
      resolveEntry(group[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[resolverBusy,pendingEffects]);

  const advanceStep = useCallback((selectedUids) => {
    setActiveSteps(prev => {
      if (!prev) return null;
      const updatedCtx = executeEffect(prev.steps[prev.stepIdx], selectedUids, prev.context, prev.ownerPid, p1, setP1, p2, setP2, addLog, prev.srcCard);
      // 「相手がこのクリーチャーを選んだ時」：効果の対象に選ばれた場合もここで誘発させる
      if (selectedUids && selectedUids.length) {
        setTimeout(() => onTargetedRef.current && onTargetedRef.current(prev.ownerPid, selectedUids), 0);
      }
      // ステップ内で破壊されたカードの leave/destroyed/battleDestroy を発火（A7）
      if (updatedCtx.destroyedThisStep && updatedCtx.destroyedThisStep.length) {
        const list = updatedCtx.destroyedThisStep;
        delete updatedCtx.destroyedThisStep;
        list.forEach(d => setTimeout(() => { fireTriggerRef.current("leave",{sourcePid:d.ownerPid,subjectCard:d.card}); fireTriggerRef.current("destroyed",{sourcePid:d.ownerPid,subjectCard:d.card}); if(d.viaBattle) fireTriggerRef.current("battleDestroy",{sourcePid:d.ownerPid,subjectCard:d.card}); }, 0));
      }
      // ステップ内でシールドが置かれた時の shieldAdded を発火（DARK MEMORY等）
      if (updatedCtx.shieldAddedFor && updatedCtx.shieldAddedFor.length) {
        const pids = [...new Set(updatedCtx.shieldAddedFor)];
        delete updatedCtx.shieldAddedFor;
        pids.forEach(pid => setTimeout(() => fireTriggerRef.current("shieldAdded",{sourcePid:pid}), 0));
      }
      // ステップ内で手札が捨てられた時の opponentDiscard を発火（不死の黄昏司祭等）
      if (updatedCtx.discardedBy && updatedCtx.discardedBy.length) {
        const pids = updatedCtx.discardedBy;
        delete updatedCtx.discardedBy;
        pids.forEach(pid => setTimeout(() => fireTriggerRef.current("discard",{sourcePid:pid}), 0));
      }
      // シールドが離れた時（zRush 解放と shieldLeave）はシールドゾーンを監視する状況起因処理で拾うので、
      // ここでは何もしない。
      if (updatedCtx.castSpell) {
        const { card: castCard, ownerPid: castOwnerPid } = updatedCtx.castSpell;
        delete updatedCtx.castSpell;
        if (castCard.autoEffect) {
          // #6: 呪文解決中に唱えた呪文は先頭へ（LIFO近似）。墓地順B→Aの厳密化は今後の課題。
          setTimeout(() => enqueueEffectRef.current({ kind:"spell", effect:castCard.autoEffect, ownerPid:castOwnerPid, srcCard:castCard, sourceName:castCard.name }, { front:true }), 0);
        }
        setTimeout(() => fireTriggerRef.current("castSpell",{sourcePid:castOwnerPid,subjectCard:castCard}), 0);
      }
      // 効果でカードを引いた時（lastCard = 引いた結果その山札が0枚になったか）
      if (updatedCtx.drewCards && updatedCtx.drewCards.length) {
        const list = updatedCtx.drewCards;
        delete updatedCtx.drewCards;
        list.forEach(d => setTimeout(() => fireTriggerRef.current("draw", { sourcePid: d.pid, lastCard: d.lastCard }), 0));
      }
      // 効果でクリーチャーがバトルゾーンに出た時（method:"put"/"summon"）
      if (updatedCtx.creatureEnteredBz && updatedCtx.creatureEnteredBz.length) {
        const list = updatedCtx.creatureEnteredBz;
        delete updatedCtx.creatureEnteredBz;
        list.forEach(e => {
          // 「出た時」は出し方を問わず誘発する。autoEffect{trigger:"play"} で書かれた cip も発火させる
          // （手札からのプレイは handlePlayCard が別途呼ぶので、ここと二重にはならない）
          if (e.card.autoEffect?.trigger === "play") {
            setTimeout(() => enqueueEffectRef.current({
              kind: "trigger", effect: e.card.autoEffect, ownerPid: e.ownerPid,
              srcCard: { ...e.card, srcCardUid: e.card.uid }, sourceName: e.card.name,
            }), 0);
          }
          if (isCreatureSide(e.card)) {
            setTimeout(() => fireTriggerRef.current("creaturePutBz", { sourcePid: e.ownerPid, subjectCard: e.card, method: e.method }), 0);
          }
        });
      }
      // 効果によるバトルに勝った時（攻撃によるバトルは resolveAttackCreature から発火）
      if (updatedCtx.battleWonBy) {
        const { pid: wpid, card: wcard } = updatedCtx.battleWonBy;
        delete updatedCtx.battleWonBy;
        setTimeout(() => fireTriggerRef.current("battleWin", { sourcePid: wpid, subjectCard: wcard }), 0);
      }
      // EXWIN: 能力による特殊勝利
      if (updatedCtx.winGame) {
        const { pid: wpid, reason } = updatedCtx.winGame;
        delete updatedCtx.winGame;
        addLog(`[EXWIN] ${wpid.toUpperCase()} の勝利！`);
        setWinReason(reason);
        setWinner(wpid.toUpperCase());
        return null;
      }
      // 「そうしたら」「そうした場合」: 直前のステップを実際に行わなかったら以降は起こらない
      if (shouldStopChain(prev.steps, prev.stepIdx, updatedCtx)) {
        addLog(prev.steps[prev.stepIdx].type === "meteorBurn"
          ? "メテオバーンを支払わなかったため、以降の効果は発生しない"
          : "直前の効果を行わなかったため、「そうしたら」以降の効果は発生しない");
        return null;
      }
      let nextIdx = prev.stepIdx + 1;
      // Skip conditional steps when their precondition is not met
      while (nextIdx < prev.steps.length && (
        (prev.steps[nextIdx].type === "graveToBz" && prev.steps[nextIdx].owner === "destroyed" && !updatedCtx.destroyedCreatureOwner) ||
        (prev.steps[nextIdx].type === "breakShield" && !updatedCtx.etbBattleWon)
      )) {
        nextIdx++;
      }
      if (nextIdx < prev.steps.length) return { ...prev, stepIdx: nextIdx, context: updatedCtx };
      // 一連の解決が完了 → activeSteps を空にし、リゾルバが次の pending を処理（#2 直列化）
      return null;
    });
  }, [p1, p2, addLog]);

  const triggerEffect=(effect,ownerPid,selfSnap,setSelf,otherSnap,setOther,sourceName,srcCardOverride,subjectCard)=>{
    if(!effect) return;
    const srcCard=srcCardOverride||cardDb.find(c=>c.name===sourceName)||{name:sourceName};
    const kind=(srcCard?.type==="spell"||srcCard?.type==="twinpact")?"spell":"trigger";
    enqueueEffect({ kind, effect, ownerPid, srcCard, subjectCard, sourceName:sourceName||srcCard?.name });
  };

  // 汎用トリガー・ディスパッチャ
  // ゾーン走査型: creatureEnter/selfDraw/shieldLeave/shieldAdded/opponentDiscard（opts.sourcePid）
  // 攻撃型: attack（opts.sourcePid, opts.attackerUid）
  // 離脱カード固有型: leave/destroyed/battleDestroy（opts.card, opts.ownerPid）
  // 汎用トリガー・ディスパッチャ
  // event: creaturePutBz/castSpell/leave/destroyed/battleDestroy/attack/draw/discard/shieldAdded/shieldLeave/endOfTurn
  // ev: { sourcePid, subjectCard?, method?("summon"|"put"), firstThisTurn? }
  const fireTrigger=(event,ev={})=>{
    const cur=stateRef.current;
    const runOne=(card,ownerPid,tr,subject)=>{
      if(tr.hyperOnly&&!card.hyperMode) return;
      if(tr.condition&&!checkGrantCondition(tr.condition,stateRef.current[ownerPid],card)) return;
      // 「各ターンに一度」「ゲーム中に一度」の誘発は使用済みなら発火しない
      const idx=getCardTriggers(card).indexOf(tr);
      const onceKey=(tr.oncePerTurn||tr.oncePerGame)?`${card.uid}#t${idx}`:null;
      if(onceKey&&isAbilityUsed(tr,onceKey)) return;
      // 誘発を pending キューへ。同一tickに積まれた分が「同時誘発」としてまとめてリゾルバで順序選択される。
      enqueueEffect({ kind:"trigger", effect:tr, ownerPid, srcCard:{...card}, subjectCard:subject, sourceName:card.name,
        onceKey, onceLabel: tr.oncePerGame?"ゲーム中に一度":tr.oncePerTurn?"各ターンに一度":null });
    };
    const subj=ev.subjectCard;
    // 1) 主体カード自身の triggers。ここで扱うのは target:"this"（＝自分自身に起きた出来事）だけ。
    //    離脱後でゾーンに無くても発火させたいので、ゾーンを見ずに回す。
    //    ただし SUBJECT_MUST_BE_IN_BZ のイベントは、主体がバトルゾーンに残っている時だけ発火する。
    //    self/opponent/both のような「プレイヤーのイベントを見張る」能力はカードがバトルゾーン等に
    //    いる間だけ有効なので、ここでは扱わず 2) に任せる。
    //    （呪文面で唱えたツインパクトが、墓地にありながらクリーチャー面の
    //      「自分が呪文を唱えた時」を自分で誘発してしまうのを防ぐ）
    const subjInBz=!subj||!ev.sourcePid||(cur[ev.sourcePid]?.battle||[]).some(c=>c.uid===subj.uid);
    if(subj&&ev.sourcePid&&(subjInBz||!SUBJECT_MUST_BE_IN_BZ.has(event))){
      getCardTriggers(subj).forEach(tr=>{
        if(triggerScope(tr,event)!=="this") return;
        if(matchTrigger(tr,event,ev.sourcePid,subj,ev)) runOne(subj,ev.sourcePid,tr,subj);
      });
    }
    // 2) 監視カード（バトルゾーン＋表向きシールド。shieldAdded は墓地の自己蘇生系も対象）
    ["p1","p2"].forEach(watcherPid=>{
      const st=cur[watcherPid];
      const watchers=[...st.battle,...st.shields.filter(s=>s.faceUp),...(event==="shieldAdded"?st.grave:[])];
      watchers.forEach(card=>{
        getCardTriggers(card).forEach(tr=>{
          if(subj&&card.uid===subj.uid&&triggerScope(tr,event)==="this") return; // 1) で処理済み
          if(matchTrigger(tr,event,watcherPid,card,ev)) runOne(card,watcherPid,tr,subj);
        });
      });
    });
  };
  fireTriggerRef.current=fireTrigger;

  // 起動型能力（activated）: 自分のバトルゾーン＋表向きシールドから、今使えるものを集める
  const collectActivated=(pid)=>{
    const st=stateRef.current[pid];
    if(!st) return [];
    const out=[];
    [...st.battle, ...st.shields.filter(c=>c.faceUp)].forEach(card=>{
      getCardActivated(card).forEach((ab,i)=>{
        const key=`${card.uid}#a${i}`;
        if(isAbilityUsed(ab,key)) return;
        const timing=ab.timing||"ownTurn";
        if(timing==="ownTurn"&&pid!==active) return;
        if(ab.condition&&!checkGrantCondition(ab.condition,st,card)) return;
        out.push({ key, pid, card, ability:ab, fromSsx: !(card.activated||[]).includes(ab) });
      });
    });
    return out;
  };
  const handleUseActivated=(entry)=>{
    setActivatedModal(null);
    const {card,ability,key,pid}=entry;
    addLog(`${pid}: ${card.name} の能力を発動（${ability.label||""}）`);
    enqueueEffect({ kind:"activated", effect:ability, ownerPid:pid, srcCard:{...card}, sourceName:card.name, onceKey:key,
      onceLabel: ability.oncePerGame?"ゲーム中に一度":ability.oncePerTurn?"各ターンに一度":null });
  };

  // シールドが離れたことの検出：Zラッシュは「いつ」「誰のシールドが」「どこに」離れても成立する
  // 状況起因処理なので、離脱の経路ごとに発火させるのではなくシールドゾーンの中身そのものを監視し、
  // 前回いた uid が消えたことをもって「離れた」と判定する。
  // （ブレイク／効果／エスケープ／置換で墓地行きなど、経路と行き先を問わず一律に拾える。
  //   タップやめくりで配列が作り直されても uid は変わらないので誤検出しない）
  const shieldUidsRef=useRef(null);
  useEffect(()=>{
    const next={ p1: new Set(p1.shields.map(c=>c.uid)), p2: new Set(p2.shields.map(c=>c.uid)) };
    const prev=shieldUidsRef.current;
    shieldUidsRef.current=next;
    if(!prev) return;   // 初期配置は「離れた」ではない
    if(winner) return;
    const leftPids=["p1","p2"].filter(pid=>[...prev[pid]].some(uid=>!next[pid].has(uid)));
    if(!leftPids.length) return;
    // Zラッシュ：誰のシールドが離れても、バトルゾーンにいる全てのZラッシュが解放される
    const released=[];
    for(const pid of ["p1","p2"]){
      const st=stateRef.current[pid];
      const zs=(st.battle||[]).filter(c=>hasKeyword(c,"zRush")&&!c.hyperMode);
      if(!zs.length) continue;
      released.push(...zs);
      (pid==="p1"?setP1:setP2)(s=>({...s,battle:s.battle.map(c=>hasKeyword(c,"zRush")&&!c.hyperMode?{...c,hyperMode:true}:c)}));
    }
    if(released.length>0){
      const who=leftPids.map(x=>x.toUpperCase()).join("・");
      released.forEach(c=>addLog(`[ZR] Zラッシュ: ${c.name} ハイパーモード解放！（${who} のシールドが離れた）`));
      setHyperModeCutIn(released[0]);
    }
    leftPids.forEach(pid=>setTimeout(()=>fireTriggerRef.current("shieldLeave",{sourcePid:pid}),0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[p1.shields,p2.shields,winner]);

  const handleTemplateChoose=(tplIdx)=>{
    if(!templateChoiceModal)return;
    const {templates,ownerPid,srcCard,count}=templateChoiceModal;
    const tpl=templates[tplIdx];
    setTemplateChoiceModal(count>1?{...templateChoiceModal,count:count-1}:null);
    // 選んだテンプレートの effects を現在の解決として実行（chooseTimes の継続。アイドル時のみ表示されるため直接 set）
    setActiveSteps({ steps: tpl.effects, stepIdx: 0, ownerPid, srcCard, context: { srcCardUid: srcCard?.uid, vars: {} } });
  };

  // 相手の常時能力(reactivePassive)を考慮し、新たにBZに出たクリーチャーへcantAttackUntilMyTurnを付与
  const maybeFlagCantAttack=(newUids,setSelf,opponentBattle)=>{
    if(!opponentBattle.some(c=>c.reactivePassive?.type==="cantAttackUntilControllerTurn"))return;
    setSelf(s=>({...s,battle:s.battle.map(c=>newUids.includes(c.uid)?{...c,cantAttackUntilMyTurn:true}:c)}));
    addLog(`[反応] 相手の常時能力により、出たクリーチャーは次の自分のターンまで攻撃できない`);
  };

  // 先行1ターン目はドロー不要（マナチャージから開始）
  const isFirstTurn = turn===1 && active==="p1";

  // ライブラリアウト（LO）: DMでは「山札が0枚になった瞬間」に敗北が成立する（引こうとした時ではない）。
  // 状態起因処理なので、ドローに限らず山札が減るあらゆる操作の後に判定する。
  // 「かわりに勝つ」等の置換があれば §0 のとおり必ず例外処理で中止できる形で提示する。
  const resolveDeckOutLoss=(pid)=>{
    const lose=()=>{
      addLog(`${pid}: 山札が0枚になった（ライブラリアウト）ため敗北`);
      setWinReason("deckout");
      setWinner(pid==="p1"?"P2":"P1");
    };
    const rep=findLoseReplacement(stateRef.current[pid],"deckOut");
    if(!rep){ lose(); return; }
    setReplacementModal({
      title: "敗北の置換（置換効果）",
      card: rep.card,
      message: `${pid.toUpperCase()} は山札が0枚になり、ゲームに負けます。\nかわりに「${rep.card.name}」の能力でゲームに勝ちます。`,
      applyLabel: "かわりに勝つ（EXWIN）",
      cancelLabel: "例外処理で中止（通常どおり敗北）",
      onApply: () => {
        setReplacementModal(null);
        addLog(`[EXWIN] ${rep.card.name}: 敗北するかわりに ${pid.toUpperCase()} の勝利！`);
        setWinReason("exwin");
        setWinner(pid.toUpperCase());
      },
      onCancel: () => { setReplacementModal(null); lose(); },
    });
  };
  // 山札が0枚になった瞬間に判定する。誘発能力(setTimeout)より先に走るので、状態起因処理が優先される。
  const deckOutRef=useRef(null);
  useEffect(()=>{
    if(winner) return;
    const pid=["p1","p2"].find(x=>(x==="p1"?p1:p2).deck.length===0);
    if(!pid){ deckOutRef.current=null; return; }
    if(deckOutRef.current===pid) return; // 解決中/解決済み（置換モーダルを出している間の再入を防ぐ）
    deckOutRef.current=pid;
    resolveDeckOutLoss(pid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[p1.deck.length,p2.deck.length,winner]);

  const handleDraw=()=>{
    if(drewThisTurn)return;
    if(activeState.deck.length===0)return; // 0枚ならLOで既に決着している
    const[card,...rest]=activeState.deck;
    setActiveState(s=>({...s,hand:[...s.hand,{...card,tapped:false}],deck:rest}));
    setDrewThisTurn(true);addLog(`${active}: ${card.name} ドロー`);setMessage(`${active}: マナチャージorプレイ`);
    setTimeout(()=>fireTrigger("draw",{sourcePid:active,lastCard:rest.length===0}),0);
  };
  const handleChargeMana=idx=>{if(chargedThisTurn)return;const card=activeState.hand[idx];const isMulti=Array.isArray(card.civ)&&card.civ.length>=2;setActiveState(s=>({...s,hand:s.hand.filter((_,i)=>i!==idx),mana:[...s.mana,{...card,tapped:isMulti}]}));setChargedThisTurn(true);addLog(`${active}: ${card.name}→マナ${isMulti?" (タップ)":""}`);};
  // fromZone: "hand"(通常) / "grave" / "mana"。墓地・マナからの召喚は summonFrom 系の許可が必要（PlayerBoard 側で判定済み）。
  // permKey が来た場合、その許可の使用回数を1つ消費する。
  const handlePlayCard=(idx,selectedManaUids,twinpactSide=null,evolutionBaseUids=null,fromZone="hand",permKey=null)=>{
    const srcZone=fromZone==="hand"?activeState.hand:fromZone==="grave"?activeState.grave:activeState.mana;
    const card=srcZone[idx];
    if(!card) return true;
    const isSpell=card.type==="spell"||(card.type==="twinpact"&&twinpactSide==="spell");
    if(fromZone!=="hand"&&(isSpell||card.type==="castle")){addLog(`${active}: ${card.name} は召喚できない`);return true;}
    let newMana=tapManaByUids(activeState.mana,selectedManaUids);
    let newHand=activeState.hand;
    let newGrave=activeState.grave;
    if(fromZone==="hand") newHand=activeState.hand.filter((_,i)=>i!==idx);
    else if(fromZone==="grave") newGrave=activeState.grave.filter((_,i)=>i!==idx);
    else if(fromZone==="mana") newMana=newMana.filter(c=>c.uid!==card.uid);
    if(permKey) setSummonUsed(u=>({...u,[permKey]:(u[permKey]||0)+1}));
    const isCastle=card.type==="castle";
    const effectiveSide=twinpactSide==="spell"?card.spellSide:card;
    if(isCastle){
      // G城: 表向きの新しいシールドとしてシールドゾーンへ
      const newShields=[...activeState.shields,{...card,tapped:false,faceUp:true}];
      setActiveState(s=>({...s,hand:newHand,mana:newMana,shields:newShields,shieldAddedThisTurn:true}));
      addLog(`${active}: 城「${card.name}」を表向きでシールド化`);
      showCutIn({title:"城！",cardName:card.name,civ:Array.isArray(card.civ)?card.civ[0]:card.civ});
      if(card.autoEffect) triggerEffect(card.autoEffect,active,{...activeState,hand:newHand,mana:newMana,shields:newShields},setActiveState,otherState,setOtherState,card.name,{...card});
      setTimeout(()=>fireTrigger("shieldAdded",{sourcePid:active}),0);
    }else if(!isSpell){
      // クリーチャー or タマシード（どちらもバトルゾーンへ。タマシードは攻撃不可・パワー無し）
      // #3 常在型: 相手の「クリーチャーを出せない」常在型を解決に先んじて適用（枠組み・現状該当カード無し）
      const isCre=isCreatureSide(card);
      if(isCre&&(checkStaticDeny(stateRef.current,active,"cantPutCreature",fromZone)
              ||checkStaticDeny(stateRef.current,active,"cantPutCreatureFromNonHand",fromZone))){
        addLog(`${active}: 相手の常在型能力によりクリーチャーを出せない`);setMessage("相手の常在型能力でクリーチャーを出せません");return true;
      }
      const isSpeed=effectiveSide.keywords?.includes("speedAttacker");
      const isEvo=card.type==="evo_creature";
      // クリーチャー側でプレイされたツインパクトもクリーチャーとして扱う（召喚酔い・出た時の誘発）
      const isCreature=isCreatureSide(card);
      // 進化元は「バトルゾーンに出た」ことにならないので、battle を経由せず evolutionBase へ直接積む。
      // 選択順がそのまま重ねる順。進化元のゾーンは bz / grave / mana のいずれか。
      let evoBase=undefined;
      let battleWithoutBase=activeState.battle;
      const baseUids=Array.isArray(evolutionBaseUids)?evolutionBaseUids:evolutionBaseUids?[evolutionBaseUids]:[];
      if(baseUids.length){
        const spec=evolutionSpec(card)||{zone:"bz"};
        const from=spec.zone==="grave"?newGrave:spec.zone==="mana"?newMana:activeState.battle;
        const bases=baseUids.map(uid=>from.find(c=>c.uid===uid)).filter(Boolean);
        const used=new Set(bases.map(c=>c.uid));
        // 下に敷かれたカードはタップ状態や表裏を持たない（マナ進化はタップ済みでも進化元にできる）
        evoBase=bases.flatMap(b=>[b,...(b.evolutionBase||[])]).map(({evolutionBase,...c})=>({...c,tapped:false,faceUp:false}));
        if(spec.zone==="grave")      newGrave=newGrave.filter(c=>!used.has(c.uid));
        else if(spec.zone==="mana")  newMana=newMana.filter(c=>!used.has(c.uid));
        else                         battleWithoutBase=activeState.battle.filter(c=>!used.has(c.uid));
      }
      const newCreature={...card,tapped:false,summonedThisTurn:isCreature&&!isSpeed&&!isEvo,evolutionBase:evoBase};
      const newBattle=[...battleWithoutBase,newCreature];
      setActiveState(s=>({...s,hand:newHand,grave:newGrave,mana:newMana,battle:newBattle}));
      const fromLabel=fromZone==="grave"?"（墓地から）":fromZone==="mana"?"（マナゾーンから）":"";
      const typeLabel=CARD_TYPE_LABELS[card.type]||"カード";
      addLog(`${active}: ${card.name}${isCreature?`(${effectiveSide.power||card.power}) ${fromLabel}召喚！`:`（${typeLabel}）を出した`}`);
      showCutIn({title:isCreature?"召喚！":`${typeLabel}！`,cardName:card.name,civ:Array.isArray(card.civ)?card.civ[0]:card.civ});
      if(isCreature) maybeFlagCantAttack([newCreature.uid],setActiveState,otherState.battle);
      if(card.autoEffect) triggerEffect(card.autoEffect,active,{...activeState,hand:newHand,grave:newGrave,mana:newMana,battle:newBattle},setActiveState,otherState,setOtherState,card.name,{...card,uid:newCreature.uid,srcCardUid:newCreature.uid});
      // 汎用トリガー: クリーチャーが出た時（自分/相手の監視カードへ）
      if(isCreature) setTimeout(()=>fireTrigger("creaturePutBz",{sourcePid:active,subjectCard:newCreature,method:"summon"}),0);
    }else{
      const isCharger=effectiveSide.keywords?.includes("charger");
      if(isCharger){
        setActiveState(s=>({...s,hand:newHand,mana:[...newMana,{...card,tapped:true}]}));
      }else{
        setActiveState(s=>({...s,hand:newHand,mana:newMana,grave:[...s.grave,card]}));
      }
      const spellName=effectiveSide?.name||card.name;
      addLog(`${active}: 呪文「${spellName}」${isCharger?"(チャージャー→マナへ)":""}`);
      showCutIn({title:"呪文！",cardName:spellName,civ:Array.isArray(card.civ)?card.civ[0]:card.civ});
      const spellEffect=effectiveSide?.autoEffect||card.autoEffect;
      if(spellEffect) triggerEffect(spellEffect,active,{...activeState,hand:newHand,mana:newMana},setActiveState,otherState,setOtherState,spellName,card);
      // 汎用トリガー: 呪文を唱えた時
      setTimeout(()=>fireTrigger("castSpell",{sourcePid:active,subjectCard:card}),0);
    }
    return true;
  };
  const handleRevChangeExec=(handCard,attacker)=>{
    const newBattle=activeState.battle.map(c=>c.uid===attacker.uid?{...handCard,uid:handCard.uid,tapped:false,summonedThisTurn:false}:c);
    setActiveState(s=>({
      ...s,
      battle:newBattle,
      hand:s.hand.filter(c=>c.uid!==handCard.uid).concat({...attacker,tapped:false,hyperMode:false,cantAttackThisTurn:false,summonedThisTurn:false}),
    }));
    addLog(`[REV] 革命チェンジ！${attacker.name} → ${handCard.name}（攻撃継続）`);
    maybeFlagCantAttack([handCard.uid],setActiveState,otherState.battle);
    if(handCard.autoEffect) triggerEffect(handCard.autoEffect,active,{...activeState,battle:newBattle},setActiveState,otherState,setOtherState,handCard.name,{...handCard,uid:handCard.uid});
    if(handCard.name==="蒼き団長 ドギラゴン剣"&&!usedFinalRevThisTurn) setFinalRevModal(true);
    else if(handCard.finalRevolution&&!usedFinalRevThisTurn){
      setUsedFinalRevThisTurn(true);
      triggerEffect(handCard.finalRevolution,active,{...activeState,battle:newBattle},setActiveState,otherState,setOtherState,handCard.name,handCard);
    }
    setAttackingUid(handCard.uid);
    setMessage("攻撃対象を選択");
  };
  const handleFinalRevConfirm=selected=>{
    setUsedFinalRevThisTurn(true);
    setFinalRevModal(false);
    if(selected.length===0) return;
    const handUids=selected.filter(x=>x.from==="hand").map(x=>x.uid);
    const manaUids=selected.filter(x=>x.from==="mana").map(x=>x.uid);
    const fromHand=activeState.hand.filter(c=>handUids.includes(c.uid));
    const fromMana=activeState.mana.filter(c=>manaUids.includes(c.uid));
    // ファイナル革命で出したクリーチャーも召喚酔いする
    const newCards=[...fromHand,...fromMana].map(c=>({ ...c, tapped: false, summonedThisTurn: true }));
    setActiveState(s=>({...s,hand:s.hand.filter(c=>!handUids.includes(c.uid)),mana:s.mana.filter(c=>!manaUids.includes(c.uid)),battle:[...s.battle,...newCards]}));
    addLog(`[FINAL] ファイナル革命！${selected.length}枚をバトルゾーンへ`);
    maybeFlagCantAttack(newCards.map(c=>c.uid),setActiveState,otherState.battle);
  };
  const handleStartAttack=uid=>{
    setAttackingUid(uid);
    const card=activeState.battle.find(c=>c.uid===uid);
    addLog(`${active}: ${card?.name} 攻撃宣言`);
    setMessage("攻撃対象を選択");
    // ハイパーモード攻撃時効果：自分の他クリーチャーを1体アンタップ
    if(card?.hyperMode&&card.hyperOnAttack?.type==="untapAlly"){
      const allies=activeState.battle.filter(c=>c.uid!==uid);
      if(allies.length>0) setHyperUntapModal({attackerUid:uid,allies});
    }
    // 汎用トリガー: このクリーチャーが攻撃する時
    const firstThisTurn=!attackedThisTurn;
    if(firstThisTurn) setAttackedThisTurn(true);
    setTimeout(()=>fireTrigger("attack",{sourcePid:active,subjectCard:card,firstThisTurn}),0);
    // ブロックの確認は攻撃先を決めた後（下の withBlockStep）。宣言時にやると
    // 革命チェンジで攻撃クリーチャーが入れ替わった場合に確認が飛んでしまい、
    // ダイレクトアタックもブロックの機会を経ずに通ってしまう。
  };
  // マッハファイターで召喚酔いのまま攻撃している間は、クリーチャーしか攻撃できない。
  // （スピードアタッカーも持つなら普通の攻撃なので制限はかからない）
  const attackerHas=(c,kw)=>
    hasKeyword(c,kw)||computeGrantedKeywords(c,activeState.battle,activeState).includes(kw);
  const machFighterOnly=card=>!!card?.summonedThisTurn
    &&!attackerHas(card,"speedAttacker")&&attackerHas(card,"machFighter");
  // 攻撃先に選べるか。「相手が自分のクリーチャーを選ぶ時、選ばれない」は攻撃先の選択にも効く
  const isUnselectableBy=(card,ownerPid,selectorPid)=>
    selectorPid!==ownerPid && isUnselectableByOpponent(card,stateRef.current[ownerPid]);
  // ブロック・ステップ。攻撃先（クリーチャー／シールド／プレイヤー）を決めた後に必ず通す。
  // 防御側に未タップのブロッカー／ガードマンがいればモーダルを出し、
  // どちらも使わなければ intent をそのまま実行する。
  const defenderHas=(c,kw)=>
    hasKeyword(c,kw)||computeGrantedKeywords(c,otherState.battle,otherState).includes(kw);
  const readyDefenders=kw=>otherState.battle.filter(c=>!c.tapped&&isCreatureSide(c)&&defenderHas(c,kw));
  const blockersFor=()=>readyDefenders("blocker");
  // ガードマン: 攻撃先が「自分の他のクリーチャー」の時だけ、攻撃先を自分に変更できる。
  // シールド／プレイヤーへの攻撃や、自分自身が攻撃先の場合は使えない。
  const guardsFor=intent=>intent?.kind!=="creature"?[]
    :readyDefenders("guardman").filter(c=>c.uid!==intent.targetUid);
  const withBlockStep=(attackerUid,intent,proceed)=>{
    const blockers=blockersFor();
    const guards=guardsFor(intent);
    if(blockers.length===0&&guards.length===0){ proceed(); return true; }
    setBlockerModal({attackerUid,blockerUids:blockers.map(b=>b.uid),guardUids:guards.map(g=>g.uid),intent});
    setMessage(`${otherPid.toUpperCase()}: ブロック／ガードマンを選択`);
    return false;
  };
  // ブロックされなかった時に、保留していた攻撃先へ進む
  const resumeAttack=(intent)=>{
    if(!intent) { setMessage("攻撃対象を選択"); return; }
    if(intent.kind==="creature") attackCreatureNow(intent.targetUid);
    else if(intent.kind==="shield") attackShieldNow();
    else if(intent.kind==="direct") directAttackNow();
  };
  // 「相手がこのクリーチャーを選んだ時」の解決後。攻撃で選ばれたならブロック確認へ進む。
  // 効果で選ばれた場合は続きが無い（選んだ効果自体は既に解決済み）。
  const continueAfterHyperTargeted=(m)=>{
    if(m.kind!=="attack") return;
    withBlockStep(m.attackerUid,{kind:"creature",targetUid:m.targetUid},()=>attackCreatureNow(m.targetUid));
  };
  // 「相手がこのクリーチャーを選んだ時」は攻撃で選ばれた時だけでなく、
  // 相手の効果の対象に選ばれた時にも誘発する（「…開けるか？」等）。
  // 効果の選択が確定した時点で、選ばれた相手クリーチャーを見て誘発させる。
  const fireOnTargetedByEffect=(selectorPid,selectedUids)=>{
    if(!selectedUids||!selectedUids.length) return;
    const oppPid=selectorPid==="p1"?"p2":"p1";
    const opp=stateRef.current[oppPid];
    const hit=(opp?.battle||[]).find(c=>selectedUids.includes(c.uid)&&c.hyperMode&&c.hyperOnTargeted?.type==="breakAttackerShields");
    if(!hit) return;
    setHyperTargetedModal({kind:"effect",targetUid:hit.uid,targetName:hit.name,
      amount:hit.hyperOnTargeted.amount,breakPid:selectorPid});
  };
  onTargetedRef.current=fireOnTargetedByEffect;
  // ===== 中央破壊パイプライン（スレイヤー/エスケープ置換/離脱トリガーを集約）=====
  const fireLeaveTriggers=(card,ownerPid,viaBattle)=>{
    fireTrigger("leave",{sourcePid:ownerPid,subjectCard:card});
    fireTrigger("destroyed",{sourcePid:ownerPid,subjectCard:card});
    if(viaBattle) fireTrigger("battleDestroy",{sourcePid:ownerPid,subjectCard:card});
  };
  const destroyNow=(card,ownerPid,viaBattle)=>{
    const setSt=ownerPid==="p1"?setP1:setP2;
    setSt(s=>{const {newBattle,extracted}=extractFromBattle(s.battle,card.uid);return {...s,battle:newBattle,grave:[...s.grave,...extracted]};});
    addLog(`[DESTROY] ${card.name} 破壊`);
    setTimeout(()=>fireLeaveTriggers(card,ownerPid,viaBattle),0);
  };
  const hasEscapeNow=(card,ownerPid)=>{
    const st=stateRef.current[ownerPid];
    return card.keywords?.includes("escape")||computeGrantedKeywords(card,st.battle,st).includes("escape");
  };
  // 破壊対象列を順に処理。エスケープ持ちは置換モーダル（§0: 必ず例外中止可）を挟む。
  const processVictims=(victims,idx,onDone)=>{
    if(idx>=victims.length){onDone&&onDone();return;}
    const v=victims[idx];
    const ownerSt=stateRef.current[v.ownerPid];
    const stillThere=ownerSt.battle.some(c=>c.uid===v.card.uid);
    if(!stillThere){processVictims(victims,idx+1,onDone);return;}
    if(hasEscapeNow(v.card,v.ownerPid)&&ownerSt.shields.length>0){
      setReplacementModal({
        title:"エスケープ（置換効果）",
        card:v.card,
        message:`${v.card.name} は破壊されます。\n墓地に置く代わりに、自分のシールドを1つ手札に加えてもよい（エスケープ）。`,
        applyLabel:"エスケープ（シールド→手札）",
        cancelLabel:"例外処理で中止（破壊）",
        onApply:()=>{
          setReplacementModal(null);
          const setSt=v.ownerPid==="p1"?setP1:setP2;
          setSt(s=>{if(s.shields.length===0)return s;const sh=s.shields[0];return {...s,shields:s.shields.slice(1),hand:[...s.hand,{...sh,tapped:false,faceUp:false}]};});
          addLog(`[ESCAPE] ${v.card.name} エスケープ：シールド1枚を手札へ（破壊を回避）`);
          processVictims(victims,idx+1,onDone);
        },
        onCancel:()=>{
          setReplacementModal(null);
          destroyNow(v.card,v.ownerPid,v.viaBattle);
          processVictims(victims,idx+1,onDone);
        },
      });
      return;
    }
    // 「自分のクリーチャーが離れる時、かわりに〜に置いてもよい」（八頭竜 ACE-Yamata 等）
    const lr=findLeaveReplacement(ownerSt,v.card);
    if(lr){
      const zoneLabel=ZONE_LABELS[lr.rule.to==="mana"?"mana":lr.rule.to==="hand"?"hand":lr.rule.to==="shield"?"shield":"deck"]||"マナゾーン";
      setReplacementModal({
        title:`${lr.card.name}（置換効果）`,
        card:v.card,
        message:`${v.card.name} はバトルゾーンを離れます。\n墓地に置く代わりに、${zoneLabel}に置いてもよい。`,
        applyLabel:`かわりに${zoneLabel}へ`,
        cancelLabel:"例外処理で中止（通常どおり破壊）",
        onApply:()=>{
          setReplacementModal(null);
          moveLeavingCard(v.card,v.ownerPid,lr.rule.to||"mana");
          processVictims(victims,idx+1,onDone);
        },
        onCancel:()=>{
          setReplacementModal(null);
          destroyNow(v.card,v.ownerPid,v.viaBattle);
          processVictims(victims,idx+1,onDone);
        },
      });
      return;
    }
    destroyNow(v.card,v.ownerPid,v.viaBattle);
    processVictims(victims,idx+1,onDone);
  };
  // 置換で、破壊されるかわりに別ゾーンへ送る。破壊ではないので destroyed は誘発せず、
  // leave（バトルゾーンを離れた）だけ誘発する。下に敷かれたカードも一緒に離れる。
  const moveLeavingCard=(card,ownerPid,to)=>{
    const setSt=ownerPid==="p1"?setP1:setP2;
    setSt(s=>{
      const {newBattle,extracted}=extractFromBattle(s.battle,card.uid);
      if(!extracted.length) return s;
      const moved=extracted.map(c=>({...c,tapped:false,faceUp:false}));
      if(to==="hand")   return {...s,battle:newBattle,hand:[...s.hand,...moved]};
      if(to==="shield") return {...s,battle:newBattle,shields:[...s.shields,...moved],shieldAddedThisTurn:true};
      if(to==="deck")   return {...s,battle:newBattle,deck:[...s.deck,...moved]};
      return {...s,battle:newBattle,mana:[...s.mana,...moved]};
    });
    addLog(`[置換] ${card.name} は破壊されるかわりに${ZONE_LABELS[to]||"マナゾーン"}へ`);
    setTimeout(()=>fireTrigger("leave",{sourcePid:ownerPid,subjectCard:card}),0);
    if(to==="shield") setTimeout(()=>fireTrigger("shieldAdded",{sourcePid:ownerPid}),0);
  };

  const resolveAttackCreature=(attacker,target)=>{
    setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attacker.uid?{...c,tapped:true}:c)}));
    const aEff=getEffectivePower(attacker,activeState,activeState.battle,{attacking:true});
    const dEff=getEffectivePower(target,otherState,otherState.battle);
    addLog(`[VS] ${attacker.name}(${aEff}) vs ${target.name}(${dEff})`);
    const aWin=aEff>=dEff;const dWin=dEff>=aEff;
    const aSlayer=attacker.keywords?.includes("slayer")||computeGrantedKeywords(attacker,activeState.battle,activeState).includes("slayer");
    const dSlayer=target.keywords?.includes("slayer")||computeGrantedKeywords(target,otherState.battle,otherState).includes("slayer");
    const victims=[];
    if(aWin||dSlayer){ addLog(`[WIN] ${target.name} 破壊${!aWin&&dSlayer?"（スレイヤー）":""}`); victims.push({card:target,ownerPid:otherPid,viaBattle:true}); }
    const attackerDies=dWin||aSlayer;
    if(attackerDies){ addLog(`[LOST] ${attacker.name} 破壊${!dWin&&aSlayer?"（スレイヤー）":""}`); victims.push({card:attacker,ownerPid:active,viaBattle:true}); }
    else if(attacker.untapAfterAttack){
      setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attacker.uid?{...c,tapped:false,untapAfterAttack:false}:c)}));
      addLog(`${attacker.name}: 攻撃後にアンタップ`);
    }
    setAttackingUid(null);
    // バトルに勝った時（相手を破壊し、自分は生き残った）
    const wonBattle=aWin&&!attackerDies;
    // 攻撃の終わり（攻撃終了ステップ）は破壊の解決が全部終わってから
    setTimeout(()=>processVictims(victims,0,()=>{
      if(wonBattle) fireTrigger("battleWin",{sourcePid:active,subjectCard:attacker});
      fireTrigger("attackEnd",{sourcePid:active,subjectCard:attacker});
    }),0);
  };
  const handleAttackCreature=targetUid=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    const target=otherState.battle.find(c=>c.uid===targetUid);
    if(!attacker||!target)return;
    // 攻撃できるのはクリーチャーだけ。タマシードとフィールドは攻撃されない
    if(!isCreatureSide(target)){
      addLog(`${target.name} は ${CARD_TYPE_LABELS[target.type]||"エレメント"} なので攻撃されない`);
      setMessage("クリーチャー以外は攻撃できません");return;
    }
    // 「相手が自分のクリーチャーを選ぶ時、選ばれない」
    if(isUnselectableBy(target,otherPid,active)){
      addLog(`${target.name} は相手に選ばれない`);
      setMessage("このクリーチャーは相手に選ばれません");return;
    }
    // ハイパーモード：相手に選ばれた時、相手シールドをブレイクしてもよい（ブロックより先）
    if(target.hyperMode&&target.hyperOnTargeted?.type==="breakAttackerShields"){
      setHyperTargetedModal({kind:"attack",targetUid,targetName:target.name,attackerUid:attacker.uid,
        amount:target.hyperOnTargeted.amount,breakPid:active});
      return;
    }
    withBlockStep(attacker.uid,{kind:"creature",targetUid},()=>attackCreatureNow(targetUid));
  };
  const attackCreatureNow=targetUid=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    const target=otherState.battle.find(c=>c.uid===targetUid);
    if(!attacker||!target)return;
    resolveAttackCreature(attacker,target);
  };
  const handleAttackShield=()=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    if(!attacker)return;
    if(attacker.cantAttackPlayer){addLog(`${attacker.name} はプレイヤーを攻撃できない`);setMessage("このクリーチャーはプレイヤーを攻撃できません（クリーチャーのみ攻撃可）");return;}
    if(machFighterOnly(attacker)){addLog(`${attacker.name} はマッハファイターで攻撃しているのでクリーチャーしか攻撃できない`);setMessage("マッハファイターで攻撃中はクリーチャーのみ攻撃できます");return;}
    withBlockStep(attacker.uid,{kind:"shield"},attackShieldNow);
  };
  const attackShieldNow=()=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    if(!attacker)return;
    const attackerPower=getEffectivePower(attacker,activeState,activeState.battle,{attacking:true});
    const breakCount=getBreakCount(attacker,attackerPower,computeGrantedKeywords(attacker,activeState.battle,activeState));
    setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attackingUid?{...c,tapped:true}:c)}));
    let shields=[...otherState.shields];const broken=[];
    for(let i=0;i<breakCount;i++){if(shields.length===0)break;broken.push(shields[0]);shields=shields.slice(1);}
    // graveSet: 手札でなく墓地へ送る broken の uid 集合（ボルメテウス置換 / faceUpLeaveTo 置換）
    const finalizeBreak=(graveSet)=>{
      const gset=graveSet||new Set();
      const toGraveCards=broken.filter(c=>gset.has(c.uid));
      const toHandAll=broken.filter(c=>!gset.has(c.uid));
      // ツインパクトは呪文面が「S・トリガー」を持つことがあるので、唱える面を解決してから絞る
      const sTriggers=toHandAll.map(c=>({card:c,side:sTriggerSide(c)})).filter(x=>x.side&&!hasKeyword(x.card,"gStrike"));
      const gStrikeCards=toHandAll.filter(c=>hasKeyword(c,"gStrike"));
      const toHand=toHandAll.map(c=>({...c,tapped:false,faceUp:false}));
      setOtherState(s=>({...s,shields,hand:[...s.hand,...toHand],grave:[...s.grave,...toGraveCards]}));
      if(toGraveCards.length>0) addLog(`[BURN] ${toGraveCards.length}枚を墓地へ（置換効果）`);
      sTriggers.forEach(({side})=>{addLog(`ST 「${side.name}」`);showCutIn({title:"S-TRIGGER!",cardName:side.name,civ:Array.isArray(side.civ)?side.civ[0]:side.civ});if(side.autoEffect)setTimeout(()=>triggerEffect(side.autoEffect,otherPid,stateRef.current[otherPid],setOtherState,stateRef.current[active],setActiveState,side.name,{...side}),800);});
      if(gStrikeCards.length>0){
        gStrikeCards.forEach(c=>addLog(`[GS] G・ストライク「${c.name}」`));
        setGStrikeModal({cards:gStrikeCards,attackerBattle:activeState.battle,attackerPid:active});
      }
      addLog(`[BREAK] ${attacker.name} ${broken.length}枚ブレイク(残${shields.length})`);
      if(shields.length===0)setMessage("シールド全滅！ダイレクトアタック可能");
      if(attacker.untapAfterAttack){
        setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attackingUid?{...c,tapped:false,untapAfterAttack:false}:c)}));
        addLog(`${attacker.name}: 攻撃後にアンタップ`);
      }
      setAttackingUid(null);
      setTimeout(()=>fireTrigger("attackEnd",{sourcePid:active,subjectCard:attacker}),0);
    };

    const isBolmetheus=attacker.name.includes("ボルメテウス");
    const faceUpToGrave=broken.filter(c=>c.faceUp&&c.faceUpLeaveTo==="grave");
    if(isBolmetheus&&broken.length>0){
      // 置換効果（§0: 必ず例外処理で中止できる）
      setReplacementModal({
        title:"ボルメテウス（置換効果）",
        card:attacker,
        message:`ブレイクしたシールド${broken.length}枚を、手札に加える代わりに墓地に置く（その「S・トリガー」は使えない）。`,
        applyLabel:"墓地に置く（置換）",
        cancelLabel:"例外処理で中止（通常ブレイク）",
        onApply:()=>{setReplacementModal(null);finalizeBreak(new Set(broken.map(c=>c.uid)));},
        onCancel:()=>{setReplacementModal(null);finalizeBreak(null);},
      });
    }else if(faceUpToGrave.length>0){
      // 表向きカードの離脱置換（G城等：表向きで離れる時はかわりに墓地へ）§0で中止可
      setReplacementModal({
        title:"表向きシールドの離脱（置換効果）",
        card:faceUpToGrave[0],
        message:`表向きの「${faceUpToGrave.map(c=>c.name).join("、")}」は、離れる時にかわりに墓地に置く。`,
        applyLabel:"墓地に置く（置換）",
        cancelLabel:"例外処理で中止（通常どおり手札へ）",
        onApply:()=>{setReplacementModal(null);finalizeBreak(new Set(faceUpToGrave.map(c=>c.uid)));},
        onCancel:()=>{setReplacementModal(null);finalizeBreak(null);},
      });
    }else{
      finalizeBreak(null);
    }
  };
  // ハイパー化（コスト支払いによる解放：メインステップ）
  const handleHyperUnlock=uid=>{
    const card=activeState.battle.find(c=>c.uid===uid);
    if(!card?.hyperUnlock||card.hyperMode) return;
    if(card.hyperUnlock.type==="tapOwnCreature"){
      const allies=activeState.battle.filter(c=>c.uid!==uid&&!c.tapped);
      if(allies.length===0){addLog("ハイパー化の対象（タップできる自分の他のクリーチャー）がいない");setMessage("ハイパー化できません（対象不足）");return;}
      setHyperUnlockModal({sourceUid:uid,allies,desc:"ハイパー化：自分の他のクリーチャーを1体タップする",actionLabel:"ハイパー化"});
    }
  };
  const handleDirectAttack=()=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    if(attacker?.cantAttackPlayer){addLog(`${attacker.name} はプレイヤーを攻撃できない`);setMessage("このクリーチャーはプレイヤーを攻撃できません");return;}
    if(machFighterOnly(attacker)){addLog(`${attacker.name} はマッハファイターで攻撃しているのでクリーチャーしか攻撃できない`);setMessage("マッハファイターで攻撃中はクリーチャーのみ攻撃できます");return;}
    // ダイレクトアタックもブロックできる
    withBlockStep(attacker?.uid,{kind:"direct"},directAttackNow);
  };
  const directAttackNow=()=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    addLog(`[DIRECT] ${attacker?.name??""} ダイレクトアタック！${active.toUpperCase()} の勝利！`);
    setAttackingUid(null);
    setWinReason("direct");
    setWinner(active.toUpperCase());
  };
  const handleEndTurn=()=>{
    // 汎用 endOfTurn トリガー（hyperOnly/condition を現状態で同期評価してから発火）
    [{pid:"p1",st:p1},{pid:"p2",st:p2}].forEach(({pid,st})=>{
      const setSelf=pid==="p1"?setP1:setP2;const oPid=pid==="p1"?"p2":"p1";const setOther=pid==="p1"?setP2:setP1;
      [...st.battle,...st.shields.filter(s=>s.faceUp)].forEach(card=>{
        getCardTriggers(card).forEach(tr=>{
          // sourcePid はターンを終えるプレイヤー。target:"self"=自分のターンの終わり /
          // "opponent"=相手のターンの終わり / "both"=各ターンの終わり
          if(!matchTrigger(tr,"endOfTurn",pid,card,{sourcePid:active})) return;
          if(tr.hyperOnly&&!card.hyperMode) return;
          if(tr.condition&&!checkGrantCondition(tr.condition,st,card)) return;
          setTimeout(()=>triggerEffect(tr,pid,stateRef.current[pid],setSelf,stateRef.current[oPid],setOther,card.name,{...card}),0);
        });
      });
    });
    // 遅延効果: pendingRevive（チェスト等）をこのターンの終わりに墓地→BZ
    [{st:p1,set:setP1},{st:p2,set:setP2}].forEach(({st,set})=>{
      if(st.pendingRevive&&st.pendingRevive.length){
        const ids=st.pendingRevive.map(c=>c.uid);
        st.pendingRevive.forEach(c=>addLog(`${c.name} をターン終了時に墓地から出した`));
        set(s=>{const revive=s.grave.filter(c=>ids.includes(c.uid));return {...s,grave:s.grave.filter(c=>!ids.includes(c.uid)),battle:[...s.battle,...revive.map(c=>({...c,tapped:false,summonedThisTurn:true}))],pendingRevive:[]};});
      }
    });
    // endOfTurnEffect処理
    [{state:p1,setState:setP1},{state:p2,setState:setP2}].forEach(({state:ps,setState:pss})=>{
      ps.battle.forEach(c=>{
        if(c.endOfTurnEffect?.type==="untapOthers"){
          pss(s=>({...s,battle:s.battle.map(b=>b.uid===c.uid?b:{...b,tapped:false})}));
          addLog(`${c.name}: 自分の他のクリーチャーをアンタップ`);
        }
        if(c.endOfTurnEffect?.type==="destroySelf"){
          pss(s=>{
            const {newBattle,extracted}=extractFromBattle(s.battle,c.uid);
            return extracted.length?{...s,battle:newBattle,grave:[...s.grave,...extracted]}:s;
          });
          addLog(`${c.name}: ターン終了時に破壊`);
        }
      });
    });
    // 終了するプレイヤー: このターン限定のフラグのみリセット（タップ状態・cantAttackUntilMyTurnは自分の次のターン開始時まで維持）
    setActiveState(s=>({...s,shieldAddedThisTurn:false,battle:s.battle.map(c=>({
      ...c,
      cantAttackThisTurn:false,
      untapAfterAttack:false,
      tempBuff:c.tempBuff?.expires==="endOfTurn"?null:c.tempBuff,
    }))}));
    // 相手の常時能力(cantAttackUntilControllerTurn)を考慮し、次に開始するプレイヤーのクリーチャーをアンタップ
    const reactiveCreature=activeState.battle.find(c=>c.reactivePassive?.type==="cantAttackUntilControllerTurn");
    const tappedOtherUids=new Set(otherState.battle.filter(c=>c.tapped).map(c=>c.uid));
    setOtherState(s=>({...s,shieldAddedThisTurn:false,battle:s.battle.map(c=>({
      ...c,
      // noUntapNextTurn のクリーチャーはこのターン開始時にアンタップしない（フラグはここで解除）
      tapped:c.noUntapNextTurn?true:false,
      noUntapNextTurn:false,
      summonedThisTurn:false,
      cantAttackThisTurn:false,
      hyperMode:false,
      untapAfterAttack:false,
      tempBuff:c.tempBuff?.expires==="ownTurnStart"?null:c.tempBuff,
      cantAttackUntilMyTurn:!!(reactiveCreature&&tappedOtherUids.has(c.uid)),
    })),mana:s.mana.map(c=>({...c,tapped:false}))}));
    if(reactiveCreature){
      const affected=otherState.battle.filter(c=>tappedOtherUids.has(c.uid));
      if(affected.length>0) addLog(`[反応] ${reactiveCreature.name}: アンタップした${affected.map(c=>c.name).join("、")}は次の自分のターンまで攻撃できない`);
    }
    setAttackingUid(null);setUsedFinalRevThisTurn(false);setAttackedThisTurn(false);setUsedThisTurn(new Set());
    // 「そのターン限り」の召喚許可と使用回数をリセット
    setSummonUsed({});setP1(s=>s.turnSummonFrom?.length?{...s,turnSummonFrom:[]}:s);setP2(s=>s.turnSummonFrom?.length?{...s,turnSummonFrom:[]}:s);
    const next=otherPid;const newTurn=active==="p2"?turn+1:turn;
    addLog(`--- ${next.toUpperCase()} のターン (T${newTurn}) ---`);
    setHandoff({from:active.toUpperCase(),to:next.toUpperCase()});
    setActive(next);setTurn(newTurn);setDrewThisTurn(false);setChargedThisTurn(false);
    // ターンのはじめに（アンタップとフラグのリセットが済んでから発火。sourcePid はターンを始めるプレイヤー）
    // 解決はハンドオフ画面を閉じたあと（resolverBusy に handoff が含まれるため）
    setTimeout(()=>fireTrigger("startOfTurn",{sourcePid:next}),0);
  };

  return(
    <div className="battle-ui" style={{height:"calc(100vh / var(--ui-scale))",overflow:"hidden",background:"#04040e",fontFamily:"'Noto Sans JP','Segoe UI',sans-serif",color:"#fff",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}::-webkit-scrollbar{width:4px;background:#111;}::-webkit-scrollbar-thumb{background:#333;border-radius:4px;}`}</style>
      {cutin&&<CutIn cutin={cutin} onDone={()=>setCutin(null)}/>}
      {hyperModeCutIn&&<HyperModeCutIn creature={hyperModeCutIn} onDismiss={()=>setHyperModeCutIn(null)}/>}
      {winner&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:700}}>
          {(()=>{
            // EXWIN（ダイレクトアタック以外の特殊勝利）は演出を分ける
            const ex=winReason==="exwin";
            const col=ex?"#c9f":"#ffe066";
            const label=ex?`${winner} EXTRA WIN!`:`${winner} WIN!`;
            const sub=winReason==="deckout"?"山札切れ":winReason==="direct"?"ダイレクトアタック":ex?"特殊勝利":null;
            return(<>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:72,fontWeight:900,color:col,textShadow:`0 0 40px ${col}aa`,lineHeight:1,letterSpacing:4}}>{ex?"✧":"✦"}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:ex?40:48,fontWeight:900,color:col,textShadow:`0 0 30px ${col}`,marginTop:12}}>{label}</div>
              {sub&&<div style={{fontSize:13,color:"#888",marginTop:8,letterSpacing:2}}>{sub}</div>}
            </>);
          })()}
          <div style={{display:"flex",gap:12,marginTop:32}}>
            <button onClick={()=>{setP1(initPlayerState(p1DeckIds,cardDb));setP2(initPlayerState(p2DeckIds,cardDb));setActive("p1");setDrewThisTurn(true);setChargedThisTurn(false);setAttackingUid(null);setWinner(null);setWinReason(null);setHandoff(null);setTurn(1);setCutin(null);setLogs(["ゲーム開始！"]);setMessage("P1: マナチャージorカードをプレイ");}} style={{padding:"14px 32px",borderRadius:8,background:"linear-gradient(135deg,#ffe066,#ff9900)",border:"none",color:"#000",fontWeight:900,fontSize:16,cursor:"pointer"}}>再戦</button>
            <button onClick={onBackToMenu} style={{padding:"14px 32px",borderRadius:8,background:"#111",border:"1px solid #333",color:"#888",fontWeight:700,fontSize:16,cursor:"pointer"}}>メニューへ</button>
          </div>
        </div>
      )}
      {handoff&&<HandoffScreen from={handoff.from} to={handoff.to} onReady={()=>{setHandoff(null);setMessage(`${active.toUpperCase()}: ドローしてください`);}}/>}
      {activeSteps&&<EffectStepModal activeSteps={activeSteps} p1={p1} setP1={setP1} p2={p2} setP2={setP2} addLog={addLog} onAdvance={advanceStep} onException={()=>{addLog("[例外処理] ステップをスキップ");setActiveSteps(null);}}/>}
      {templateChoiceModal&&templateChoiceModal.count>0&&!activeSteps&&<TemplateChoiceModal modal={templateChoiceModal} onChoose={handleTemplateChoose} onAbandon={()=>{addLog("[例外処理] 残りの選択を放棄");setTemplateChoiceModal(null);}}/>}
      {triggerOrderModal&&<TriggerOrderModal entries={triggerOrderModal.entries}
        onChoose={id=>{const entry=triggerOrderModal.entries.find(e=>e.id===id);setTriggerOrderModal(null);setPendingEffects(p=>p.filter(e=>e.id!==id));if(entry)resolveEntry(entry);}}
        onDecline={id=>{const entry=triggerOrderModal.entries.find(e=>e.id===id);addLog(`${entry?.sourceName??""}: 能力を発動しなかった`);setPendingEffects(p=>p.filter(e=>e.id!==id));setTriggerOrderModal(prev=>{const rest=(prev?.entries||[]).filter(e=>e.id!==id);return rest.length?{entries:rest}:null;});}}
        onDeclineAll={()=>{const ids=triggerOrderModal.entries.filter(e=>e.effect?.optional).map(e=>e.id);addLog("任意の誘発能力を発動しなかった");setPendingEffects(p=>p.filter(e=>!ids.includes(e.id)));setTriggerOrderModal(prev=>{const rest=(prev?.entries||[]).filter(e=>!ids.includes(e.id));return rest.length?{entries:rest}:null;});}}/>}
      {finalRevModal&&<FinalRevolutionModal selfState={activeState} onConfirm={handleFinalRevConfirm} onSkip={()=>{setFinalRevModal(false);setUsedFinalRevThisTurn(true);}}/>}
      {gStrikeModal&&<GStrikeModal cards={gStrikeModal.cards} attackerBattle={gStrikeModal.attackerBattle} onConfirm={uid=>{if(uid){const target=gStrikeModal.attackerPid==="p1"?setP1:setP2;target(s=>({...s,battle:s.battle.map(c=>c.uid===uid?{...c,cantAttackThisTurn:true}:c)}));addLog(`[GS] G・ストライク: ${(gStrikeModal.attackerBattle||[]).find(c=>c.uid===uid)?.name} 今ターン攻撃不可`);}setGStrikeModal(null);}} onSkip={()=>setGStrikeModal(null)}/>}
      {replacementModal&&<ReplacementModal modal={replacementModal} onApply={replacementModal.onApply} onCancel={replacementModal.onCancel}/>}
      {hyperUntapModal&&<HyperUntapModal modal={hyperUntapModal} onSelect={uid=>{setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===uid?{...c,tapped:false}:c)}));addLog(`ハイパーモード: ${activeState.battle.find(c=>c.uid===uid)?.name} アンタップ`);setHyperUntapModal(null);}} onSkip={()=>setHyperUntapModal(null)}/>}
      {hyperUnlockModal&&<HyperUntapModal modal={hyperUnlockModal} onSelect={uid2=>{
        const srcUid=hyperUnlockModal.sourceUid;
        const srcCard=activeState.battle.find(c=>c.uid===srcUid);
        setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===uid2?{...c,tapped:true}:c.uid===srcUid?{...c,hyperMode:true}:c)}));
        addLog(`[HYPER化] ${srcCard?.name} ハイパーモード解放！（${activeState.battle.find(c=>c.uid===uid2)?.name} をタップ）`);
        if(srcCard) setHyperModeCutIn(srcCard);
        setHyperUnlockModal(null);
      }} onSkip={()=>setHyperUnlockModal(null)}/>}
      {blockerModal&&<BlockerModal
        blockers={otherState.battle.filter(c=>blockerModal.blockerUids.includes(c.uid)&&!c.tapped)}
        guards={otherState.battle.filter(c=>(blockerModal.guardUids||[]).includes(c.uid)&&!c.tapped)}
        attackerName={activeState.battle.find(c=>c.uid===blockerModal.attackerUid)?.name||""}
        targetName={blockerModal.intent?.kind==="creature"
          ?otherState.battle.find(c=>c.uid===blockerModal.intent.targetUid)?.name
          :blockerModal.intent?.kind==="shield"?"シールド":"プレイヤー（ダイレクトアタック）"}
        onBlock={blockerUid=>{
          const attacker=activeState.battle.find(c=>c.uid===blockerModal.attackerUid);
          const blocker=otherState.battle.find(c=>c.uid===blockerUid);
          setBlockerModal(null);
          if(!attacker||!blocker){setMessage("攻撃対象を選択");return;}
          setOtherState(s=>({...s,battle:s.battle.map(c=>c.uid===blockerUid?{...c,tapped:true}:c)}));
          addLog(`[BLOCK] ${otherPid.toUpperCase()}: ${blocker.name} でブロック！`);
          resolveAttackCreature(attacker,blocker);
        }}
        onGuard={guardUid=>{
          // ガードマン: 自分をタップして、攻撃先を自分に変更する（ブロックではないのでバトルになる）
          const attacker=activeState.battle.find(c=>c.uid===blockerModal.attackerUid);
          const guard=otherState.battle.find(c=>c.uid===guardUid);
          setBlockerModal(null);
          if(!attacker||!guard){setMessage("攻撃対象を選択");return;}
          setOtherState(s=>({...s,battle:s.battle.map(c=>c.uid===guardUid?{...c,tapped:true}:c)}));
          addLog(`[GUARD] ${otherPid.toUpperCase()}: ${guard.name} のガードマン！攻撃先を変更`);
          resolveAttackCreature(attacker,guard);
        }}
        onDecline={()=>{const intent=blockerModal.intent;setBlockerModal(null);resumeAttack(intent);}}
      />}
      {activatedModal&&<ActivatedAbilityModal entries={activatedModal.entries} onUse={handleUseActivated} onClose={()=>setActivatedModal(null)}/>}
      {hyperTargetedModal&&<HyperTargetedModal modal={hyperTargetedModal} attackerShields={stateRef.current[hyperTargetedModal.breakPid]?.shields.length??0} onUse={()=>{
        const m=hyperTargetedModal;
        const setBreakSt=m.breakPid==="p1"?setP1:setP2;
        const breakSt=stateRef.current[m.breakPid];
        const n=Math.min(m.amount,breakSt.shields.length);
        if(n>0){
          const broken=breakSt.shields.slice(0,n);
          setBreakSt(s=>({...s,shields:s.shields.slice(n),hand:[...s.hand,...broken.map(c=>({...c,tapped:false,faceUp:false}))]}));
          addLog(`${m.targetName} ハイパーモード: ${m.breakPid.toUpperCase()} のシールドを${n}枚ブレイク`);
        }
        setHyperTargetedModal(null);
        continueAfterHyperTargeted(m);
      }} onSkip={()=>{
        const m=hyperTargetedModal;
        setHyperTargetedModal(null);
        continueAfterHyperTargeted(m);
      }}/>}
      <div style={{background:"linear-gradient(90deg,#08001a,#100520,#08001a)",borderBottom:"1px solid #2a1a4a",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:15,fontWeight:900,color:"#ffe066",textShadow:"0 0 10px #ffe066",letterSpacing:3}}>DUEL MASTERS</div>
        <div style={{fontSize:11,color:"#555"}}>T{turn} ｜ <span style={{color:active==="p1"?"#4af":"#f84"}}>{active.toUpperCase()} のターン</span>{isFirstTurn&&<span style={{color:"#f84",marginLeft:6,fontSize:10}}>先行</span>}</div>
        <button onClick={onBackToMenu} style={{padding:"3px 10px",borderRadius:4,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:11}}>← メニュー</button>
      </div>
      <div style={{background:"rgba(20,20,50,0.6)",borderBottom:"1px solid #141428",padding:"5px 14px",fontSize:11,color:"#9ae"}}>{message}</div>
      {isPC?(
        /* ===== PC: 左右分割レイアウト ===== */
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"row",minHeight:0}}>
          {/* 左：ターンプレイヤー (50%) */}
          <div style={{flex:"0 0 50%",display:"flex",flexDirection:"column",borderRight:"1px solid #2a1a4a",overflow:"hidden"}}>
            <div style={{fontSize:9,color:"#4af",background:"rgba(10,30,80,0.35)",textAlign:"center",padding:"3px",borderBottom:"1px solid #1a1a2a",letterSpacing:2,flexShrink:0}}>◆ ターンプレイヤー</div>
            <div style={{flex:1,overflowY:"auto",padding:"8px 10px"}}>
              {active==="p1"
                ? <PlayerBoard key="p1-active" pid="p1" large state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p1").length} onOpenActivated={()=>setActivatedModal({pid:"p1",entries:collectActivated("p1")})}/>
                : <PlayerBoard key="p2-active" pid="p2" large state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p2").length} onOpenActivated={()=>setActivatedModal({pid:"p2",entries:collectActivated("p2")})}/>
              }
            </div>
          </div>
          {/* 右：非ターンプレイヤー (50%) */}
          <div style={{flex:"0 0 50%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{fontSize:9,color:"#f84",background:"rgba(80,15,10,0.25)",textAlign:"center",padding:"3px",borderBottom:"1px solid #1a1a2a",letterSpacing:2,flexShrink:0}}>非ターンプレイヤー</div>
            <div style={{flex:1,overflowY:"auto",padding:"8px 10px"}}>
              {active==="p1"
                ? <PlayerBoard key="p2-inactive" pid="p2" large state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p2").length} onOpenActivated={()=>setActivatedModal({pid:"p2",entries:collectActivated("p2")})}/>
                : <PlayerBoard key="p1-inactive" pid="p1" large state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p1").length} onOpenActivated={()=>setActivatedModal({pid:"p1",entries:collectActivated("p1")})}/>
              }
            </div>
          </div>
        </div>
      ):(
        /* ===== モバイル: 上下3分割レイアウト ===== */
        <div style={{flex:1,overflow:"hidden",display:"grid",gridTemplateRows:"1fr 22px 1fr",minHeight:0}}>
          <div style={{overflowY:"auto",padding:"6px 10px",borderBottom:"1px solid #1a1a2a"}}>
            {active==="p1"
              ? <PlayerBoard key="p2" pid="p2" state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p2").length} onOpenActivated={()=>setActivatedModal({pid:"p2",entries:collectActivated("p2")})}/>
              : <PlayerBoard key="p1" pid="p1" state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p1").length} onOpenActivated={()=>setActivatedModal({pid:"p1",entries:collectActivated("p1")})}/>
            }
          </div>
          <div style={{overflow:"hidden"}}>
            <StepIndicator drewThisTurn={drewThisTurn} attackingUid={attackingUid}/>
          </div>
          <div style={{overflowY:"auto",padding:"6px 10px",borderTop:"1px solid #1a1a2a"}}>
            {active==="p1"
              ? <PlayerBoard key="p1" pid="p1" state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p1").length} onOpenActivated={()=>setActivatedModal({pid:"p1",entries:collectActivated("p1")})}/>
              : <PlayerBoard key="p2" pid="p2" state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack} onHyperUnlock={handleHyperUnlock} summonUsed={summonUsed} activatedCount={collectActivated("p2").length} onOpenActivated={()=>setActivatedModal({pid:"p2",entries:collectActivated("p2")})}/>
            }
          </div>
        </div>
      )}
    </div>
  );
}
