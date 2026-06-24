import { useState, useCallback, useEffect, useRef } from "react";
import { initPlayerState, tapManaByUids, getEffectivePower, extractFromBattle, computeGrantedKeywords, checkGrantCondition } from "../gameLogic";
import { executeStepAction } from "../engine/steps";
import { processEffect } from "../engine/effects";
import { CutIn, HyperModeCutIn } from "../components/CutIn";
import { HandoffScreen } from "./HandoffScreen";
import { EffectModal, EffectConfirmModal } from "../components/modals/EffectModal";
import { EffectStepModal } from "../components/modals/EffectStepModal";
import { TemplateChoiceModal } from "../components/modals/TemplateChoiceModal";
import { FinalRevolutionModal } from "../components/modals/FinalRevolutionModal";
import { GStrikeModal } from "../components/modals/GStrikeModal";
import { HyperUntapModal, HyperTargetedModal } from "../components/modals/HyperModals";
import { ReplacementModal } from "../components/modals/ReplacementModal";
import { PlayerBoard } from "../components/PlayerBoard";
import { StepIndicator } from "../components/BoardWidgets";

// 汎用トリガーの関係性解決（ゾーン走査型）
// triggerName: 発生したイベント名 / on: カードが宣言する誘発条件
// watcherPid: 監視カードの支配者 / sourcePid: イベントの所属プレイヤー
function triggerMatches(on, triggerName, watcherPid, sourcePid){
  if(on === triggerName){
    // 所属プレイヤー相対のイベントは「自分の」ものだけ反応
    if(triggerName === "selfDraw" || triggerName === "shieldLeave" || triggerName === "shieldAdded") return watcherPid === sourcePid;
    if(triggerName === "opponentDiscard") return watcherPid !== sourcePid;
    return true;
  }
  if(triggerName === "creatureEnter"){
    if(on === "selfCreaturePlay") return watcherPid === sourcePid;
    if(on === "opponentCreaturePlay") return watcherPid !== sourcePid;
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
  const [handoff,setHandoff]=useState(null);
  const [turn,setTurn]=useState(1);
  const [effectModal,setEffectModal]=useState(null);
  const [cutin,setCutin]=useState(null);
  const [hyperModeCutIn,setHyperModeCutIn]=useState(null);
  const [usedFinalRevThisTurn,setUsedFinalRevThisTurn]=useState(false);
  const [finalRevModal,setFinalRevModal]=useState(false);
  const [effectConfirmModal,setEffectConfirmModal]=useState(null);
  const [activeSteps,setActiveSteps]=useState(null);
  const [effectQueue,setEffectQueue]=useState([]);
  const [gStrikeModal,setGStrikeModal]=useState(null);
  const [hyperUntapModal,setHyperUntapModal]=useState(null);
  const [hyperTargetedModal,setHyperTargetedModal]=useState(null);
  const [templateChoiceModal,setTemplateChoiceModal]=useState(null);

  const addLog=useCallback(msg=>setLogs(p=>[...p,msg]),[]);
  const [isPC,setIsPC]=useState(()=>window.innerWidth>=768);
  useEffect(()=>{const fn=()=>setIsPC(window.innerWidth>=768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  const showCutIn=useCallback(data=>setCutin(data),[]);
  const openEffectModal=useCallback(m=>setEffectModal(m),[]);

  const otherPid=active==="p1"?"p2":"p1";
  const activeState=active==="p1"?p1:p2;
  const otherState=active==="p1"?p2:p1;
  const setActiveState=active==="p1"?setP1:setP2;
  const setOtherState=active==="p1"?setP2:setP1;
  // 汎用トリガー/置換が常に最新の盤面を読めるよう ref に保持
  const stateRef=useRef({p1,p2});
  stateRef.current={p1,p2};
  const [replacementModal,setReplacementModal]=useState(null);

  const startStepEffect = useCallback((steps, ownerPid, srcCard) => {
    setActiveSteps(prev => {
      if (prev === null) return { steps, stepIdx: 0, ownerPid, srcCard, context: { srcCardUid: srcCard?.uid } };
      setEffectQueue(q => [...q, { steps, ownerPid, srcCard }]);
      return prev;
    });
  }, []);

  const advanceStep = useCallback((selectedUids) => {
    setActiveSteps(prev => {
      if (!prev) return null;
      const updatedCtx = executeStepAction(prev.steps[prev.stepIdx], selectedUids, prev.context, prev.ownerPid, p1, setP1, p2, setP2, addLog, prev.srcCard);
      if (updatedCtx.castSpell) {
        const { card: castCard, ownerPid: castOwnerPid } = updatedCtx.castSpell;
        delete updatedCtx.castSpell;
        if (castCard.autoEffect) {
          const selfSnap = castOwnerPid === "p1" ? p1 : p2;
          const setSelfFn = castOwnerPid === "p1" ? setP1 : setP2;
          const otherSnap = castOwnerPid === "p1" ? p2 : p1;
          const setOtherFn = castOwnerPid === "p1" ? setP2 : setP1;
          setTimeout(() => triggerEffect(castCard.autoEffect, castOwnerPid, selfSnap, setSelfFn, otherSnap, setOtherFn, castCard.name, castCard), 0);
        }
      }
      let nextIdx = prev.stepIdx + 1;
      // Skip conditional steps when their precondition is not met
      while (nextIdx < prev.steps.length && (
        (prev.steps[nextIdx].type === "reviveFromDestroyedOwnerGrave" && !updatedCtx.destroyedCreatureOwner) ||
        (prev.steps[nextIdx].type === "breakOpponentShieldChoice" && !updatedCtx.etbBattleWon)
      )) {
        nextIdx++;
      }
      if (nextIdx < prev.steps.length) return { ...prev, stepIdx: nextIdx, context: updatedCtx };
      // All done — pop queue
      setEffectQueue(q => {
        if (q.length > 0) {
          const [next, ...rest] = q;
          setTimeout(() => setActiveSteps({ steps: next.steps, stepIdx: 0, ownerPid: next.ownerPid, srcCard: next.srcCard, context: { srcCardUid: next.srcCard?.uid } }), 0);
          return rest;
        }
        return q;
      });
      return null;
    });
  }, [p1, p2, addLog]);

  const triggerEffect=(effect,ownerPid,selfSnap,setSelf,otherSnap,setOther,sourceName,srcCardOverride)=>{
    if(!effect) return;
    const srcCard=srcCardOverride||cardDb.find(c=>c.name===sourceName)||{name:sourceName};
    showCutIn({title:"効果発動！",cardName:sourceName,civ:Array.isArray(srcCard?.civ)?srcCard.civ[0]:srcCard?.civ||"fire"});
    if(effect.type==="steps"){
      startStepEffect(effect.steps, ownerPid, srcCard);
    } else if(effect.type==="chooseTimes"){
      setTemplateChoiceModal({count:effect.count,templates:effect.templates,ownerPid,srcCard});
    } else {
      setEffectConfirmModal({effect,ownerPid,selfSnap,setSelf,otherSnap,setOther,srcCard});
    }
  };

  // 汎用トリガー・ディスパッチャ
  // ゾーン走査型: creatureEnter/selfDraw/shieldLeave/shieldAdded/opponentDiscard（opts.sourcePid）
  // 攻撃型: attack（opts.sourcePid, opts.attackerUid）
  // 離脱カード固有型: leave/destroyed/battleDestroy（opts.card, opts.ownerPid）
  const fireTrigger=(triggerName,opts={})=>{
    const cur=stateRef.current;
    const runCardTriggers=(card,ownerPid)=>{
      const setSelf=ownerPid==="p1"?setP1:setP2;
      const oPid=ownerPid==="p1"?"p2":"p1";
      const setOther=ownerPid==="p1"?setP2:setP1;
      (card.triggers||[]).forEach(tr=>{
        if(tr.on!==triggerName) return;
        if(tr.condition&&!checkGrantCondition(tr.condition,stateRef.current[ownerPid])) return;
        setTimeout(()=>triggerEffect(tr.effect,ownerPid,stateRef.current[ownerPid],setSelf,stateRef.current[oPid],setOther,card.name,{...card}),0);
      });
    };
    if(triggerName==="leave"||triggerName==="destroyed"||triggerName==="battleDestroy"){
      if(opts.card&&opts.ownerPid) runCardTriggers(opts.card,opts.ownerPid);
      return;
    }
    if(triggerName==="attack"){
      const ownerPid=opts.sourcePid;
      const card=cur[ownerPid].battle.find(c=>c.uid===opts.attackerUid);
      if(card) runCardTriggers(card,ownerPid);
      return;
    }
    ["p1","p2"].forEach(watcherPid=>{
      const st=cur[watcherPid];
      const setSelf=watcherPid==="p1"?setP1:setP2;
      const oPid=watcherPid==="p1"?"p2":"p1";
      const setOther=watcherPid==="p1"?setP2:setP1;
      const watchers=[...st.battle,...st.shields.filter(s=>s.faceUp)];
      watchers.forEach(card=>{
        (card.triggers||[]).forEach(tr=>{
          if(!triggerMatches(tr.on,triggerName,watcherPid,opts.sourcePid)) return;
          if(tr.condition&&!checkGrantCondition(tr.condition,st)) return;
          setTimeout(()=>triggerEffect(tr.effect,watcherPid,stateRef.current[watcherPid],setSelf,stateRef.current[oPid],setOther,card.name,{...card}),0);
        });
      });
    });
  };

  const handleTemplateChoose=(tplIdx)=>{
    if(!templateChoiceModal)return;
    const {templates,ownerPid,srcCard,count}=templateChoiceModal;
    const tpl=templates[tplIdx];
    setTemplateChoiceModal(count>1?{...templateChoiceModal,count:count-1}:null);
    startStepEffect(tpl.steps, ownerPid, srcCard);
  };

  // 相手の常時能力(reactivePassive)を考慮し、新たにBZに出たクリーチャーへcantAttackUntilMyTurnを付与
  const maybeFlagCantAttack=(newUids,setSelf,opponentBattle)=>{
    if(!opponentBattle.some(c=>c.reactivePassive?.type==="cantAttackUntilControllerTurn"))return;
    setSelf(s=>({...s,battle:s.battle.map(c=>newUids.includes(c.uid)?{...c,cantAttackUntilMyTurn:true}:c)}));
    addLog(`[反応] 相手の常時能力により、出たクリーチャーは次の自分のターンまで攻撃できない`);
  };

  // 先行1ターン目はドロー不要（マナチャージから開始）
  const isFirstTurn = turn===1 && active==="p1";

  const handleDraw=()=>{
    if(drewThisTurn)return;
    if(activeState.deck.length===0){setWinner(otherPid==="p1"?"P1":"P2");return;}
    const[card,...rest]=activeState.deck;
    setActiveState(s=>({...s,hand:[...s.hand,{...card,tapped:false}],deck:rest}));
    setDrewThisTurn(true);addLog(`${active}: ${card.name} ドロー`);setMessage(`${active}: マナチャージorプレイ`);
    setTimeout(()=>fireTrigger("selfDraw",{sourcePid:active}),0);
  };
  const handleChargeMana=idx=>{if(chargedThisTurn)return;const card=activeState.hand[idx];const isMulti=Array.isArray(card.civ)&&card.civ.length>=2;setActiveState(s=>({...s,hand:s.hand.filter((_,i)=>i!==idx),mana:[...s.mana,{...card,tapped:isMulti}]}));setChargedThisTurn(true);addLog(`${active}: ${card.name}→マナ${isMulti?" (タップ)":""}`);};
  const handlePlayCard=(idx,selectedManaUids,twinpactSide=null,evolutionBaseUid=null)=>{
    const card=activeState.hand[idx];
    const newMana=tapManaByUids(activeState.mana,selectedManaUids);
    const newHand=activeState.hand.filter((_,i)=>i!==idx);
    const isSpell=card.type==="spell"||(card.type==="twinpact"&&twinpactSide==="spell");
    const isCastle=card.type==="castle";
    const effectiveSide=twinpactSide==="spell"?card.spellSide:card;
    if(isCastle){
      // G城: 表向きの新しいシールドとしてシールドゾーンへ
      const newShields=[...activeState.shields,{...card,tapped:false,faceUp:true}];
      setActiveState(s=>({...s,hand:newHand,mana:newMana,shields:newShields}));
      addLog(`${active}: 城「${card.name}」を表向きでシールド化`);
      showCutIn({title:"城！",cardName:card.name,civ:Array.isArray(card.civ)?card.civ[0]:card.civ});
      if(card.autoEffect) triggerEffect(card.autoEffect,active,{...activeState,hand:newHand,mana:newMana,shields:newShields},setActiveState,otherState,setOtherState,card.name,{...card});
      setTimeout(()=>fireTrigger("shieldAdded",{sourcePid:active}),0);
    }else if(!isSpell){
      // クリーチャー or タマシード（どちらもバトルゾーンへ。タマシードは攻撃不可・パワー無し）
      const isSpeed=effectiveSide.keywords?.includes("speedAttacker");
      const isEvo=card.type==="evo_creature";
      const isCreature=card.type==="creature"||card.type==="evo_creature";
      let evoBase=undefined;
      let battleWithoutBase=activeState.battle;
      if(evolutionBaseUid){
        const baseCard=activeState.battle.find(c=>c.uid===evolutionBaseUid);
        if(baseCard){
          evoBase=[baseCard,...(baseCard.evolutionBase||[])].map(({evolutionBase:_,...c})=>c);
          battleWithoutBase=activeState.battle.filter(c=>c.uid!==evolutionBaseUid);
        }
      }
      const newCreature={...card,tapped:false,summonedThisTurn:isCreature&&!isSpeed&&!isEvo,evolutionBase:evoBase};
      const newBattle=[...battleWithoutBase,newCreature];
      setActiveState(s=>({...s,hand:newHand,mana:newMana,battle:newBattle}));
      addLog(`${active}: ${card.name}${isCreature?`(${effectiveSide.power||card.power}) 召喚！`:"（タマシード）を出した"}`);
      showCutIn({title:isCreature?"召喚！":"タマシード！",cardName:card.name,civ:Array.isArray(card.civ)?card.civ[0]:card.civ});
      if(isCreature) maybeFlagCantAttack([newCreature.uid],setActiveState,otherState.battle);
      if(card.autoEffect) triggerEffect(card.autoEffect,active,{...activeState,hand:newHand,mana:newMana,battle:newBattle},setActiveState,otherState,setOtherState,card.name,{...card,uid:newCreature.uid,srcCardUid:newCreature.uid});
      // 汎用トリガー: クリーチャーが出た時（自分/相手の監視カードへ）
      if(isCreature) setTimeout(()=>fireTrigger("creatureEnter",{sourcePid:active}),0);
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
      triggerEffect(handCard.finalRevolution.effect,active,{...activeState,battle:newBattle},setActiveState,otherState,setOtherState,handCard.name,handCard);
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
    const newCards=[...fromHand,...fromMana].map(c=>({...c,tapped:false,summonedThisTurn:false}));
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
    setTimeout(()=>fireTrigger("attack",{sourcePid:active,attackerUid:uid}),0);
  };
  // ===== 中央破壊パイプライン（スレイヤー/エスケープ置換/離脱トリガーを集約）=====
  const fireLeaveTriggers=(card,ownerPid,viaBattle)=>{
    fireTrigger("leave",{card,ownerPid});
    fireTrigger("destroyed",{card,ownerPid});
    if(viaBattle) fireTrigger("battleDestroy",{card,ownerPid});
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
  const processVictims=(victims,idx)=>{
    if(idx>=victims.length){return;}
    const v=victims[idx];
    const ownerSt=stateRef.current[v.ownerPid];
    const stillThere=ownerSt.battle.some(c=>c.uid===v.card.uid);
    if(!stillThere){processVictims(victims,idx+1);return;}
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
          setTimeout(()=>fireTrigger("shieldLeave",{sourcePid:v.ownerPid}),0);
          processVictims(victims,idx+1);
        },
        onCancel:()=>{
          setReplacementModal(null);
          destroyNow(v.card,v.ownerPid,v.viaBattle);
          processVictims(victims,idx+1);
        },
      });
    }else{
      destroyNow(v.card,v.ownerPid,v.viaBattle);
      processVictims(victims,idx+1);
    }
  };

  const resolveAttackCreature=(attacker,target)=>{
    setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attacker.uid?{...c,tapped:true}:c)}));
    const aEff=getEffectivePower(attacker,activeState,activeState.battle);
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
    setTimeout(()=>processVictims(victims,0),0);
  };
  const handleAttackCreature=targetUid=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    const target=otherState.battle.find(c=>c.uid===targetUid);
    if(!attacker||!target)return;
    // ハイパーモード：相手に選ばれた時、相手シールドをブレイクしてもよい
    if(target.hyperMode&&target.hyperOnTargeted?.type==="breakAttackerShields"){
      setHyperTargetedModal({targetUid,attackerUid:attacker.uid,amount:target.hyperOnTargeted.amount});
      return;
    }
    resolveAttackCreature(attacker,target,targetUid);
  };
  const handleAttackShield=shieldIdx=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    if(!attacker)return;
    if(attacker.cantAttackPlayer){addLog(`${attacker.name} はプレイヤーを攻撃できない`);setMessage("このクリーチャーはプレイヤーを攻撃できません（クリーチャーのみ攻撃可）");return;}
    const effectiveTBreaker=attacker.keywords?.includes("tBreaker")||computeGrantedKeywords(attacker,activeState.battle,activeState).includes("tBreaker")||(attacker.hyperMode&&attacker.hyperKeywords?.includes("tBreaker"));
    const effectiveWBreaker=(!effectiveTBreaker)&&(attacker.keywords?.includes("wBreaker")||computeGrantedKeywords(attacker,activeState.battle,activeState).includes("wBreaker")||(attacker.hyperMode&&attacker.hyperKeywords?.includes("wBreaker")));
    const breakCount=effectiveTBreaker?3:effectiveWBreaker?2:1;
    setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attackingUid?{...c,tapped:true}:c)}));
    let shields=[...otherState.shields];const broken=[];
    for(let i=0;i<breakCount;i++){if(shields.length===0)break;broken.push(shields[0]);shields=shields.slice(1);}
    const gStrikeCards=broken.filter(c=>c.keywords?.includes("gStrike"));
    const sTriggers=broken.filter(c=>c.keywords?.includes("sTrigger")&&!c.keywords?.includes("gStrike"));
    const normal=broken.filter(c=>!c.keywords?.includes("sTrigger")&&!c.keywords?.includes("gStrike"));

    const finalizeBreak=(toGrave)=>{
      if(toGrave){
        setOtherState(s=>({...s,shields,grave:[...s.grave,...broken]}));
        addLog(`[BURN] ${broken.length}枚を墓地へ（置換効果）`);
      }else{
        // シールドから手札に入るときtapped/faceUpをリセット
        const toHand=[...normal,...sTriggers,...gStrikeCards].map(c=>({...c,tapped:false,faceUp:false}));
        setOtherState(s=>({...s,shields,hand:[...s.hand,...toHand]}));
        sTriggers.forEach(c=>{addLog(`ST 「${c.name}」`);showCutIn({title:"S-TRIGGER!",cardName:c.name,civ:c.civ});if(c.autoEffect)setTimeout(()=>triggerEffect(c.autoEffect,otherPid,stateRef.current[otherPid],setOtherState,stateRef.current[active],setActiveState,c.name),800);});
        if(gStrikeCards.length>0){
          gStrikeCards.forEach(c=>addLog(`[GS] G・ストライク「${c.name}」`));
          setGStrikeModal({cards:gStrikeCards,attackerBattle:activeState.battle,attackerPid:active});
        }
      }
      // Z-Rush: シールドが離れたらzRushクリーチャーのhyperModeを解放（攻撃ブレイク以外でも shieldLeave 経由で発火可）
      if(broken.length>0){
        const zActive=activeState.battle.filter(c=>c.keywords?.includes("zRush")&&!c.hyperMode);
        const zOther=otherState.battle.filter(c=>c.keywords?.includes("zRush")&&!c.hyperMode);
        const zAll=[...zActive,...zOther];
        if(zAll.length>0){
          if(zActive.length>0)setActiveState(s=>({...s,battle:s.battle.map(c=>c.keywords?.includes("zRush")&&!c.hyperMode?{...c,hyperMode:true}:c)}));
          if(zOther.length>0)setOtherState(s=>({...s,battle:s.battle.map(c=>c.keywords?.includes("zRush")&&!c.hyperMode?{...c,hyperMode:true}:c)}));
          zAll.forEach(c=>addLog(`[ZR] Zラッシュ: ${c.name} ハイパーモード解放！`));
          setHyperModeCutIn(zAll[0]);
        }
        // 汎用トリガー: カードがシールドゾーンを離れた時（防御側=otherPid のシールド）
        setTimeout(()=>fireTrigger("shieldLeave",{sourcePid:otherPid}),0);
      }
      addLog(`[BREAK] ${attacker.name} ${broken.length}枚ブレイク(残${shields.length})`);
      if(shields.length===0)setMessage("シールド全滅！ダイレクトアタック可能");
      if(attacker.untapAfterAttack){
        setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attackingUid?{...c,tapped:false,untapAfterAttack:false}:c)}));
        addLog(`${attacker.name}: 攻撃後にアンタップ`);
      }
      setAttackingUid(null);
    };

    const isBolmetheus=attacker.name.includes("ボルメテウス");
    if(isBolmetheus&&broken.length>0){
      // 置換効果（§0: 必ず例外処理で中止できる）
      setReplacementModal({
        title:"ボルメテウス（置換効果）",
        card:attacker,
        message:`ブレイクしたシールド${broken.length}枚を、手札に加える代わりに墓地に置く（その「S・トリガー」は使えない）。`,
        applyLabel:"墓地に置く（置換）",
        cancelLabel:"例外処理で中止（通常ブレイク）",
        onApply:()=>{setReplacementModal(null);finalizeBreak(true);},
        onCancel:()=>{setReplacementModal(null);finalizeBreak(false);},
      });
    }else{
      finalizeBreak(false);
    }
  };
  const handleDirectAttack=()=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    if(attacker?.cantAttackPlayer){addLog(`${attacker.name} はプレイヤーを攻撃できない`);setMessage("このクリーチャーはプレイヤーを攻撃できません");return;}
    addLog(`[DIRECT] ${attacker?.name??""} ダイレクトアタック！${active.toUpperCase()} の勝利！`);
    setAttackingUid(null);
    setWinner(active.toUpperCase());
  };
  const handleEndTurn=()=>{
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
    setActiveState(s=>({...s,battle:s.battle.map(c=>({
      ...c,
      cantAttackThisTurn:false,
      untapAfterAttack:false,
      tempBuff:c.tempBuff?.expires==="endOfTurn"?null:c.tempBuff,
    }))}));
    // 相手の常時能力(cantAttackUntilControllerTurn)を考慮し、次に開始するプレイヤーのクリーチャーをアンタップ
    const reactiveCreature=activeState.battle.find(c=>c.reactivePassive?.type==="cantAttackUntilControllerTurn");
    const tappedOtherUids=new Set(otherState.battle.filter(c=>c.tapped).map(c=>c.uid));
    setOtherState(s=>({...s,battle:s.battle.map(c=>({
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
    setAttackingUid(null);setUsedFinalRevThisTurn(false);
    const next=otherPid;const newTurn=active==="p2"?turn+1:turn;
    addLog(`--- ${next.toUpperCase()} のターン (T${newTurn}) ---`);
    setHandoff({from:active.toUpperCase(),to:next.toUpperCase()});
    setActive(next);setTurn(newTurn);setDrewThisTurn(false);setChargedThisTurn(false);
  };

  return(
    <div style={{height:"100vh",overflow:"hidden",background:"#04040e",fontFamily:"'Noto Sans JP','Segoe UI',sans-serif",color:"#fff",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}::-webkit-scrollbar{width:4px;background:#111;}::-webkit-scrollbar-thumb{background:#333;border-radius:4px;}`}</style>
      {cutin&&<CutIn cutin={cutin} onDone={()=>setCutin(null)}/>}
      {hyperModeCutIn&&<HyperModeCutIn creature={hyperModeCutIn} onDismiss={()=>setHyperModeCutIn(null)}/>}
      {winner&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:700}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:72,fontWeight:900,color:"#ffe066",textShadow:"0 0 40px #ffe066aa",lineHeight:1,letterSpacing:4}}>✦</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:48,fontWeight:900,color:"#ffe066",textShadow:"0 0 30px #ffe066",marginTop:12}}>{winner} WIN!</div>
          <div style={{display:"flex",gap:12,marginTop:32}}>
            <button onClick={()=>{setP1(initPlayerState(p1DeckIds,cardDb));setP2(initPlayerState(p2DeckIds,cardDb));setActive("p1");setDrewThisTurn(true);setChargedThisTurn(false);setAttackingUid(null);setWinner(null);setHandoff(null);setTurn(1);setEffectModal(null);setCutin(null);setLogs(["ゲーム開始！"]);setMessage("P1: マナチャージorカードをプレイ");}} style={{padding:"14px 32px",borderRadius:8,background:"linear-gradient(135deg,#ffe066,#ff9900)",border:"none",color:"#000",fontWeight:900,fontSize:16,cursor:"pointer"}}>再戦</button>
            <button onClick={onBackToMenu} style={{padding:"14px 32px",borderRadius:8,background:"#111",border:"1px solid #333",color:"#888",fontWeight:700,fontSize:16,cursor:"pointer"}}>メニューへ</button>
          </div>
        </div>
      )}
      {handoff&&<HandoffScreen from={handoff.from} to={handoff.to} onReady={()=>{setHandoff(null);setMessage(`${active.toUpperCase()}: ドローしてください`);}}/>}
      {effectModal&&<EffectModal modal={effectModal} p1State={p1} setP1={setP1} p2State={p2} setP2={setP2} onClose={()=>setEffectModal(null)} addLog={addLog}/>}
      {effectConfirmModal&&<EffectConfirmModal modal={effectConfirmModal} onConfirm={()=>{const{effect,ownerPid,selfSnap,setSelf,otherSnap,setOther}=effectConfirmModal;setEffectConfirmModal(null);processEffect(effect,ownerPid,selfSnap,setSelf,otherSnap,setOther,addLog,openEffectModal);}} onSkip={()=>setEffectConfirmModal(null)}/>}
      {activeSteps&&<EffectStepModal activeSteps={activeSteps} p1={p1} setP1={setP1} p2={p2} setP2={setP2} addLog={addLog} onAdvance={advanceStep} onException={()=>{addLog("[例外処理] ステップをスキップ");setActiveSteps(null);}}/>}
      {templateChoiceModal&&templateChoiceModal.count>0&&!activeSteps&&<TemplateChoiceModal modal={templateChoiceModal} onChoose={handleTemplateChoose} onAbandon={()=>{addLog("[例外処理] 残りの選択を放棄");setTemplateChoiceModal(null);}}/>}
      {finalRevModal&&<FinalRevolutionModal selfState={activeState} onConfirm={handleFinalRevConfirm} onSkip={()=>{setFinalRevModal(false);setUsedFinalRevThisTurn(true);}}/>}
      {gStrikeModal&&<GStrikeModal cards={gStrikeModal.cards} attackerBattle={gStrikeModal.attackerBattle} onConfirm={uid=>{if(uid){const target=gStrikeModal.attackerPid==="p1"?setP1:setP2;target(s=>({...s,battle:s.battle.map(c=>c.uid===uid?{...c,cantAttackThisTurn:true}:c)}));addLog(`[GS] G・ストライク: ${(gStrikeModal.attackerBattle||[]).find(c=>c.uid===uid)?.name} 今ターン攻撃不可`);}setGStrikeModal(null);}} onSkip={()=>setGStrikeModal(null)}/>}
      {replacementModal&&<ReplacementModal modal={replacementModal} onApply={replacementModal.onApply} onCancel={replacementModal.onCancel}/>}
      {hyperUntapModal&&<HyperUntapModal modal={hyperUntapModal} onSelect={uid=>{setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===uid?{...c,tapped:false}:c)}));addLog(`ハイパーモード: ${activeState.battle.find(c=>c.uid===uid)?.name} アンタップ`);setHyperUntapModal(null);}} onSkip={()=>setHyperUntapModal(null)}/>}
      {hyperTargetedModal&&<HyperTargetedModal modal={hyperTargetedModal} attackerShields={activeState.shields.length} onUse={()=>{
        const {targetUid,attackerUid,amount}=hyperTargetedModal;
        const target=otherState.battle.find(c=>c.uid===targetUid);
        const n=Math.min(amount,activeState.shields.length);
        if(n>0){
          const broken=activeState.shields.slice(0,n);
          setActiveState(s=>({...s,shields:s.shields.slice(n),hand:[...s.hand,...broken.map(c=>({...c,tapped:false}))]}));
          addLog(`${target?.name} ハイパーモード: 相手シールドを${n}枚ブレイク`);
        }
        setHyperTargetedModal(null);
        const attacker=activeState.battle.find(c=>c.uid===attackerUid);
        if(attacker&&target) resolveAttackCreature(attacker,target,targetUid);
      }} onSkip={()=>{
        const {targetUid,attackerUid}=hyperTargetedModal;
        setHyperTargetedModal(null);
        const attacker=activeState.battle.find(c=>c.uid===attackerUid);
        const target=otherState.battle.find(c=>c.uid===targetUid);
        if(attacker&&target) resolveAttackCreature(attacker,target,targetUid);
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
                ? <PlayerBoard key="p1-active" pid="p1" large state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
                : <PlayerBoard key="p2-active" pid="p2" large state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
              }
            </div>
          </div>
          {/* 右：非ターンプレイヤー (50%) */}
          <div style={{flex:"0 0 50%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{fontSize:9,color:"#f84",background:"rgba(80,15,10,0.25)",textAlign:"center",padding:"3px",borderBottom:"1px solid #1a1a2a",letterSpacing:2,flexShrink:0}}>非ターンプレイヤー</div>
            <div style={{flex:1,overflowY:"auto",padding:"8px 10px"}}>
              {active==="p1"
                ? <PlayerBoard key="p2-inactive" pid="p2" large state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
                : <PlayerBoard key="p1-inactive" pid="p1" large state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
              }
            </div>
          </div>
        </div>
      ):(
        /* ===== モバイル: 上下3分割レイアウト ===== */
        <div style={{flex:1,overflow:"hidden",display:"grid",gridTemplateRows:"1fr 22px 1fr",minHeight:0}}>
          <div style={{overflowY:"auto",padding:"6px 10px",borderBottom:"1px solid #1a1a2a"}}>
            {active==="p1"
              ? <PlayerBoard key="p2" pid="p2" state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
              : <PlayerBoard key="p1" pid="p1" state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={false} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
            }
          </div>
          <div style={{overflow:"hidden"}}>
            <StepIndicator drewThisTurn={drewThisTurn} attackingUid={attackingUid}/>
          </div>
          <div style={{overflowY:"auto",padding:"6px 10px",borderTop:"1px solid #1a1a2a"}}>
            {active==="p1"
              ? <PlayerBoard key="p1" pid="p1" state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
              : <PlayerBoard key="p2" pid="p2" state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={true} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog} onRevChange={handleRevChangeExec} onDirectAttack={handleDirectAttack}/>
            }
          </div>
        </div>
      )}
    </div>
  );
}
