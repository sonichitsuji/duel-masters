import { useState, useEffect } from "react";
import { CIV } from "../constants";
import { getCardCivs, canPayCost, computeGrantedKeywords, getEffectivePower, collectSummonPermissions, summonPermissionFor, evolutionSpec, evolutionCandidates, maxEvolutionBases, collectFreeCastPermissions, freeCastPermissionFor, isCreatureSide } from "../gameLogic";
import { CardFace, CardBack } from "./CardFace";
import { ShieldPile } from "./BoardWidgets";
import { EffectText } from "./EffectText";
import { CreatureDetailPanel } from "./CreatureDetailPanel";
import { ExceptionPanel } from "./ExceptionPanel";
import { AttackTriggerModal } from "./modals/AttackTriggerModal";
import { ManaPayModal } from "./modals/ManaPayModal";
import { TwinPactChoiceModal } from "./modals/TwinPactChoiceModal";
import { AlternateCostModal } from "./modals/AlternateCostModal";
import { EvolutionSelectModal } from "./modals/EvolutionSelectModal";
import { ZoneViewModal } from "./modals/ZoneViewModal";

// ===========================
// PLAYER BOARD
// ===========================
export function PlayerBoard({pid,state,setState,otherState,setOtherState,isActive,attackingUid,onDraw,onChargeMana,onPlayCard,onStartAttack,onEndTurn,onAttackCreature,onAttackShield,drewThisTurn,chargedThisTurn,addLog,onRevChange,onDirectAttack,onHyperUnlock,activatedCount,onOpenActivated,summonUsed,large}){
  const [selHand,setSelHand]=useState(null);
  const [selBattle,setSelBattle]=useState(null);
  const [revChangeTarget,setRevChangeTarget]=useState(null);
  const [manaPayModal,setManaPayModal]=useState(null);
  const [twinPactModal,setTwinPactModal]=useState(null);
  const [evolutionSelectModal,setEvolutionSelectModal]=useState(null);
  const [altCostModal,setAltCostModal]=useState(null);
  const [zoneModal,setZoneModal]=useState(null); // null | "grave" | "mana" | "hyper"（超次元ゾーンは閲覧のみ）
  const label=pid==="p1"?"P1":"P2";const color=pid==="p1"?"#4af":"#f84";
  const availMana=state.mana.filter(c=>!c.tapped).length;
  useEffect(()=>{setSelHand(null);setSelBattle(null);setManaPayModal(null);},[isActive]);
  const selectedCard=selHand!==null?state.hand[selHand]:null;
  const altCostAvailable=selectedCard?.alternateCost&&selectedCard.alternateCost.condition?.type==="graveCountAtLeast"&&state.grave.length>=selectedCard.alternateCost.condition.amount;
  // 「進化元1体につきコスト-1」のように、重ねる枚数でコストが変わるカードがある。
  // 進化元を選ぶ前の判定では最大枚数（＝最も軽くなるケース）で見積もり、実際の枚数は支払い画面で確定させる。
  const costOptsFor=(card,bases)=>({ evolutionBaseCount: bases!=null?bases.length:maxEvolutionBases(card,state) });
  const civCheck=selectedCard?(()=>{
    const o=costOptsFor(selectedCard);
    return selectedCard.type==="twinpact"
      ?(canPayCost(state.mana,{ ...selectedCard, side: "creature" },state,o).ok
        ||canPayCost(state.mana,{ ...selectedCard, ...selectedCard.spellSide, side: "spell" },state,o).ok
          ?{ok:true}:canPayCost(state.mana,{ ...selectedCard, side: "creature" },state,o))
      :(altCostAvailable&&canPayCost(state.mana,{...selectedCard,cost:selectedCard.alternateCost.cost,civ:selectedCard.alternateCost.civs},state,o).ok)
        ?{ok:true}
        :canPayCost(state.mana,selectedCard,state,o);
  })():null;
  // G-Zero check
  const gZeroOk=selectedCard?.gZero&&state.battle.some(c=>
    (!selectedCard.gZero.nameContains||c.name?.includes(selectedCard.gZero.nameContains))&&
    (!selectedCard.gZero.raceContains||c.race?.includes(selectedCard.gZero.raceContains))
  );
  // コストを支払わずにプレイできるか（アカシック3の「呪文をコストを支払わずに唱えてもよい」等）。
  // ツインパクトは呪文面が対象になることがあるので、両面で判定する。
  const freeCastPerms=collectFreeCastPermissions(state,isActive);
  const freeCastPerm=selectedCard?(
    freeCastPermissionFor(selectedCard.type==="twinpact"?{ ...selectedCard, side:"creature" }:selectedCard,freeCastPerms)
    ||(selectedCard.type==="twinpact"
      ?freeCastPermissionFor({ ...selectedCard, ...selectedCard.spellSide, uid:selectedCard.uid, side:"spell" },freeCastPerms)
      :null)
  ):null;
  // 呪文面だけが許可に合致するツインパクトは、呪文として唱える
  const freeCastSide=selectedCard?.type==="twinpact"&&freeCastPerm
    ?(freeCastPermissionFor({ ...selectedCard, side:"creature" },freeCastPerms)?"creature":"spell")
    :null;
  const selBattleCard=selBattle?state.battle.find(c=>c.uid===selBattle):null;
  // 墓地・マナからの召喚許可（summonFrom / turnSummonFrom）
  const summonPerms=collectSummonPermissions(state,isActive);
  const canSummonNow=isActive&&drewThisTurn;
  // ゾーンの中身を「召喚できるか」付きで列挙する
  const zoneEntries=zone=>{
    const list=zone==="grave"?state.grave:zone==="hyper"?(state.hyper||[]):state.mana;
    return list.map((card,idx)=>{
      const perm=canSummonNow?summonPermissionFor(card,zone,summonPerms,summonUsed||{}):null;
      // マナから召喚する場合、そのカード自身はコスト支払いに使えない
      const payMana=zone==="mana"?state.mana.filter(c=>c.uid!==card.uid):state.mana;
      return { card, idx, perm, payable: !!perm&&canPayCost(payMana,card,state,costOptsFor(card)).ok };
    });
  };
  const summonableCount=zone=>zoneEntries(zone).filter(e=>e.perm).length;

  // コスト支払いに使えるマナ。マナから召喚したカード自身と、マナ進化の進化元は使えない
  const payableMana=(m)=>{
    const excluded=new Set();
    if(m?.zone==="mana") excluded.add(m.card.uid);
    if(evolutionSpec(m?.card)?.zone==="mana") (m.evolutionBaseUids||[]).forEach(u=>excluded.add(u));
    return excluded.size?state.mana.filter(c=>!excluded.has(c.uid)):state.mana;
  };

  // 進化元の選択を開く（BZ/墓地/マナのどれでも同じ入口）。候補が足りなければ false を返す
  const openEvolutionSelect=(common)=>{
    const spec=evolutionSpec(common.card);
    const candidates=evolutionCandidates(common.card,state);
    if(candidates.length===0) return false;
    setEvolutionSelectModal({...common,spec,candidates});
    return true;
  };

  const handleHandClick=i=>{if(!isActive)return;setSelBattle(null);setSelHand(selHand===i?null:i);};
  const handleBattleClick=card=>{if(attackingUid&&!isActive){onAttackCreature(card.uid);return;}setSelHand(null);setSelBattle(selBattle===card.uid?null:card.uid);};
  const handleCharge=()=>{if(selHand===null)return;onChargeMana(selHand);setSelHand(null);};
  const handlePlay=()=>{
    if(selHand===null||!civCheck?.ok)return;
    const card=state.hand[selHand];
    if(card.type==="evo_creature"){
      if(!openEvolutionSelect({handIdx:selHand,card}))return;
    }else if(card.cost===0&&(!card.spellSide||card.spellSide.cost===0)){const ok=onPlayCard(selHand,[]);if(ok!==false)setSelHand(null);}
    else if(card.type==="twinpact"){setTwinPactModal({handIdx:selHand,card});}
    else if(card.alternateCost&&card.alternateCost.condition?.type==="graveCountAtLeast"&&state.grave.length>=card.alternateCost.condition.amount){setAltCostModal({handIdx:selHand,card});}
    else{setManaPayModal({handIdx:selHand,card});}
  };
  const handleManaConfirm=uids=>{
    if(!manaPayModal)return;
    const ok=onPlayCard(manaPayModal.handIdx,uids,manaPayModal.twinpactSide||null,manaPayModal.evolutionBaseUids||null,manaPayModal.zone||"hand",manaPayModal.permKey||null);
    if(ok!==false)setSelHand(null);
    setManaPayModal(null);
    setZoneModal(null);
  };
  // 墓地・マナからの召喚。手札からのプレイと同じ支払い/進化フローに合流する
  const handleSummonFromZone=entry=>{
    const {card,idx,perm}=entry;
    const common={handIdx:idx,card,zone:zoneModal,permKey:perm.key};
    if(card.type==="evo_creature"){
      openEvolutionSelect(common);
    }else{
      setManaPayModal(common);
    }
  };
  const handleGZeroPlay=()=>{
    if(!gZeroOk||selHand===null)return;
    const card=state.hand[selHand];
    if(card.type==="evo_creature"){
      if(!openEvolutionSelect({handIdx:selHand,card,gZero:true}))return;
    }else{
      const ok=onPlayCard(selHand,[],null,null);
      if(ok!==false)setSelHand(null);
    }
  };

  // コストを支払わずにプレイ（マナを1枚もタップしない）
  const handleFreeCastPlay=()=>{
    if(!freeCastPerm||selHand===null)return;
    const card=state.hand[selHand];
    if(card.type==="evo_creature"){
      if(!openEvolutionSelect({handIdx:selHand,card,freeCast:true}))return;
    }else{
      const ok=onPlayCard(selHand,[],freeCastSide,null);
      if(ok!==false)setSelHand(null);
    }
  };

  // 攻撃宣言: 革命チェンジ可能かチェック
  const handleAttackWithTriggerCheck = (uid) => {
    const card = state.battle.find(c => c.uid === uid);
    if (!card) return;
    // 革命チェンジ可能なカードが手札にあるかチェック
    const hasRevChange = state.hand.some(c => {
      if (!c.keywords?.includes("revolutionChange") || !c.revolutionChangeCond) return false;
      const cond = c.revolutionChangeCond;
      const attackerCivs = getCardCivs(card);
      const civMatch = !cond.civs?.length || cond.civs.some(cv => attackerCivs.includes(cv));
      const raceMatch = !cond.race && !cond.races ? true : cond.races ? cond.races.some(r => card.race?.includes(r)) : card.race?.includes(cond.race);
      const costMatch = !cond.minCost || card.cost >= cond.minCost;
      const powerMatch = !cond.minPower || getEffectivePower(card, state, state.battle) >= cond.minPower;
      const nameMatch = !cond.nameContains || card.name?.includes(cond.nameContains);
      const multiColorMatch = !cond.multiColor || (Array.isArray(card.civ) && card.civ.length >= 2);
      return civMatch && raceMatch && costMatch && powerMatch && nameMatch && multiColorMatch;
    });
    if (hasRevChange) {
      setRevChangeTarget(card);
      setSelBattle(null);
    } else {
      onStartAttack(uid);
    }
  };

  // 革命チェンジ実行
  const handleRevChange = (handCard) => {
    if (!revChangeTarget) return;
    onRevChange(handCard, revChangeTarget);
    setRevChangeTarget(null);
  };

  const Btn=({children,onClick,col,disabled})=>(<button onClick={onClick} disabled={disabled} style={{padding:"6px 12px",borderRadius:5,border:`1px solid ${col}44`,background:disabled?"#111":`${col}18`,color:disabled?"#333":col,cursor:disabled?"not-allowed":"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</button>);
  return(
    <div style={{display:"flex",flexDirection:"column",overflowY:"auto",minHeight:large?"100%":undefined,background:`rgba(${pid==="p1"?"10,30,80":"80,15,10"},0.1)`,border:`1px solid ${color}22`,borderRadius:12,padding:"10px 12px"}}>
      {selBattleCard&&<CreatureDetailPanel card={selBattleCard} isActive={isActive} drewThisTurn={drewThisTurn} battleZone={state.battle} ownerState={state} onHyperUnlock={onHyperUnlock} onAttack={()=>{handleAttackWithTriggerCheck(selBattleCard.uid);setSelBattle(null);}} onClose={()=>setSelBattle(null)}/>}
      {revChangeTarget&&(
        <AttackTriggerModal
          attacker={revChangeTarget}
          hand={state.hand}
          battle={state.battle}
          ownerState={state}
          onRevChange={handleRevChange}
          onSkip={()=>{ onStartAttack(revChangeTarget.uid); setRevChangeTarget(null); }}
        />
      )}
      {manaPayModal&&(
        <ManaPayModal
          card={manaPayModal.card}
          mana={payableMana(manaPayModal)}
          ownerState={state}
          costOpts={costOptsFor(manaPayModal.card,manaPayModal.evolutionBaseUids||[])}
          onConfirm={handleManaConfirm}
          onCancel={()=>setManaPayModal(null)}
        />
      )}
      {twinPactModal&&(
        <TwinPactChoiceModal
          card={twinPactModal.card}
          onSelectCreature={()=>{const{handIdx,card}=twinPactModal;setTwinPactModal(null);setManaPayModal({handIdx,card:{ ...card, side: "creature" },twinpactSide:"creature"});}}
          onSelectSpell={()=>{const{handIdx,card}=twinPactModal;setTwinPactModal(null);setManaPayModal({handIdx,card:{ ...card, ...card.spellSide, uid: card.uid, grantKeywords: card.grantKeywords, side: "spell" },twinpactSide:"spell"});}}
          onCancel={()=>setTwinPactModal(null)}
        />
      )}
      {altCostModal&&(
        <AlternateCostModal
          card={altCostModal.card}
          onSelectNormal={()=>{const{handIdx,card}=altCostModal;setAltCostModal(null);setManaPayModal({handIdx,card});}}
          onSelectAlternate={()=>{const{handIdx,card}=altCostModal;setAltCostModal(null);setManaPayModal({handIdx,card:{...card,cost:card.alternateCost.cost,civ:card.alternateCost.civs}});}}
          onCancel={()=>setAltCostModal(null)}
        />
      )}
      {evolutionSelectModal&&(
        <EvolutionSelectModal
          candidates={evolutionSelectModal.candidates}
          card={evolutionSelectModal.card}
          spec={evolutionSelectModal.spec}
          ownerState={state}
          onConfirm={baseUids=>{
            const{handIdx,card,gZero,zone,permKey}=evolutionSelectModal;
            setEvolutionSelectModal(null);
            if(gZero){
              const ok=onPlayCard(handIdx,[],null,baseUids);
              if(ok!==false)setSelHand(null);
            }else{
              setManaPayModal({handIdx,card,evolutionBaseUids:baseUids,zone,permKey});
            }
          }}
          onCancel={()=>setEvolutionSelectModal(null)}
        />
      )}
      {zoneModal&&(
        <ZoneViewModal
          zone={zoneModal}
          entries={zoneEntries(zoneModal)}
          ownerState={state}
          onSummon={handleSummonFromZone}
          onClose={()=>setZoneModal(null)}
        />
      )}
      {/* Header: PID label + DECK/墓地 boxes + Shield */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap",flexShrink:0}}>
        <span style={{fontWeight:700,color,fontSize:13}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:1,marginRight:4}}>{pid==="p1"?"P1":"P2"}</span>
          {label}{isActive&&<span style={{fontSize:9,color:"#ffe066",marginLeft:6,fontFamily:"'Cinzel',serif",letterSpacing:1}}>◆ ACTIVE</span>}
        </span>
        <div style={{display:"flex",gap:4,marginLeft:"auto",alignItems:"center"}}>
          <div style={{background:"#0d1a2e",border:"1px solid #2255aa88",borderRadius:6,padding:"2px 6px",textAlign:"center",minWidth:36}}>
            <div style={{fontSize:9,color:"#5588aa"}}>DECK</div>
            <div style={{fontSize:16,fontWeight:700,color:"#7af",lineHeight:1.1}}>{state.deck.length}</div>
          </div>
          <div onClick={()=>setZoneModal("grave")} style={{background:"#150a2e",border:`1px solid ${summonableCount("grave")>0?"#ffcc66":"#7755aa88"}`,borderRadius:6,padding:"2px 6px",textAlign:"center",minWidth:36,cursor:"pointer"}}>
            <div style={{fontSize:9,color:"#9966bb"}}>墓地{summonableCount("grave")>0&&<span style={{color:"#ffcc66"}}> ▲</span>}</div>
            <div style={{fontSize:16,fontWeight:700,color:"#b8f",lineHeight:1.1}}>{state.grave.length}</div>
          </div>
          {/* 超次元ゾーンは置かれた時だけ表示する（閲覧のみ・戻ってこない） */}
          {(state.hyper||[]).length>0&&(
            <div onClick={()=>setZoneModal("hyper")} style={{background:"#04202a",border:"1px solid #66ddff88",borderRadius:6,padding:"2px 6px",textAlign:"center",minWidth:36,cursor:"pointer"}}>
              <div style={{fontSize:9,color:"#66ddff"}}>超次元</div>
              <div style={{fontSize:16,fontWeight:700,color:"#9ef",lineHeight:1.1}}>{state.hyper.length}</div>
            </div>
          )}
        </div>
        <div style={{border:"1px solid #3498dbaa",background:"rgba(52,152,219,0.10)",borderRadius:7,padding:"3px 6px"}}>
          <ShieldPile shields={state.shields} canClick={!!(attackingUid&&!isActive)} onBreak={onAttackShield}/>
        </div>
      </div>
      {/* BZ with red border */}
      <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",border:"1px solid #e74c3caa",background:"rgba(231,76,60,0.12)",borderRadius:7,padding:"5px 7px",marginBottom:6}}>
        <div style={{fontSize:10,fontWeight:400,color:"#f55",marginBottom:4,flexShrink:0}}>バトルゾーン <span style={{color:"#222",fontSize:9}}>(タップで詳細)</span></div>
        <div style={{display:"flex",gap:5,overflowX:"auto",flexWrap:"nowrap",flex:1,alignItems:"center"}}>
          {(()=>{
            const getGranted=c=>computeGrantedKeywords(c,state.battle,state);
            // 攻撃を受ける側では、いま攻撃先に選べないカードを薄く表示する。
            // 攻撃できるのはタップされているクリーチャーだけ（マッハファイターは出たターンの間アンタップでも可）
            const beingAttacked=!!attackingUid&&!isActive;
            const attacker=beingAttacked?otherState.battle.find(c=>c.uid===attackingUid):null;
            const machNow=!!attacker?.enteredThisTurn&&
              (attacker.keywords?.includes("machFighter")||computeGrantedKeywords(attacker,otherState.battle,otherState).includes("machFighter"));
            const notTargetable=c=>beingAttacked&&(!isCreatureSide(c)||(!c.tapped&&!machNow));
            return state.battle.map(c=><CardFace key={c.uid} card={c} small={!large} selected={selBattle===c.uid||attackingUid===c.uid} dimmed={!!(attackingUid&&attackingUid!==c.uid&&isActive)||notTargetable(c)} onClick={()=>handleBattleClick(c)} grantedKeywords={getGranted(c)}/>);
          })()}
          {state.battle.length===0&&<span style={{color:"#1e1e2e",fontSize:10,alignSelf:"center"}}>空</span>}
        </div>
      </div>
      {/* Mana + Hand row */}
      <div style={{display:"flex",gap:6,flexShrink:0,height:large?112:96}}>
        <div onClick={()=>setZoneModal("mana")} style={{flex:`0 0 ${large?130:100}px`,cursor:"pointer",border:`1px solid ${summonableCount("mana")>0?"#ffcc66":"#27ae60aa"}`,background:"rgba(39,174,96,0.10)",borderRadius:7,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:9,fontWeight:400,color:"#4a8",padding:"3px 6px",borderBottom:"1px solid #27ae6033"}}>マナ ({state.mana.length}){summonableCount("mana")>0&&<span style={{color:"#ffcc66"}}> ▲</span>}</div>
          <div style={{flex:1,overflow:"hidden",padding:"2px 4px",display:"flex",flexDirection:"column",gap:1}}>
            {state.mana.slice(0,large?14:10).map((c,i)=>{
              const civs=getCardCivs(c);
              const cv=CIV[civs[0]];
              return <div key={c.uid||i} style={{height:large?16:14,borderRadius:3,background:c.tapped?`${cv?.color}33`:`${cv?.color}88`,border:`1px solid ${cv?.color}55`,fontSize:large?8:7,color:"#fff",padding:"1px 3px",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{c.tapped?"":"▶"}{c.name}</div>;
            })}
            {state.mana.length>(large?14:10)&&<div style={{fontSize:8,color:"#4a8",textAlign:"center"}}>+{state.mana.length-(large?14:10)}</div>}
          </div>
        </div>
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid #f1c40faa",background:"rgba(241,196,15,0.10)",borderRadius:7,padding:"5px 7px"}}>
          <div style={{fontSize:10,fontWeight:400,color:"#ca8",marginBottom:4,flexShrink:0}}>手札</div>
          <div style={{display:"flex",gap:5,overflowX:"auto",flexWrap:"nowrap",flex:1,alignItems:"flex-end"}}>
            {state.hand.map((c,i)=>!isActive?<CardBack key={c.uid} tiny onClick={()=>handleHandClick(i)}/>:<CardFace key={c.uid} card={c} small selected={selHand===i} onClick={()=>handleHandClick(i)}/>)}
            {state.hand.length===0&&<span style={{color:"#1e1e2e",fontSize:10,alignSelf:"center"}}>空</span>}
          </div>
        </div>
      </div>
      {selectedCard&&(
        <div style={{background:"#080818",border:`1px solid ${CIV[getCardCivs(selectedCard)[0]]?.color}55`,borderRadius:8,padding:"8px 12px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><span style={{fontWeight:700,color:"#fff",fontSize:12}}>{getCardCivs(selectedCard).map(cv=>CIV[cv]?.label).join("")} {selectedCard.name}</span><span style={{color:"#666",fontSize:10,marginLeft:8}}>コスト:{selectedCard.cost}{selectedCard.type==="creature"&&` / パワー:${selectedCard.power}`}{selectedCard.race&&` / 種族:${selectedCard.race}`}</span></div>
            <div style={{fontSize:10,color:civCheck?.ok?"#4f8":"#f84",fontWeight:700}}>{civCheck?.ok?`✓ プレイ可 (${availMana}マナ)`:`✗ ${civCheck?.reason}`}</div>
          </div>
          <div style={{fontSize:10,color:"#999",marginTop:4,lineHeight:1.5}}><EffectText text={selectedCard.effect}/></div>
        </div>
      )}
      {attackingUid&&!isActive&&(
        <div style={{background:"rgba(255,80,0,0.08)",border:"1px dashed #f8444488",borderRadius:6,padding:"6px 10px",marginBottom:8}}>
          <div style={{fontSize:11,color:"#f84",marginBottom:4,fontFamily:"'Cinzel',serif",letterSpacing:1}}>攻撃対象を選択</div>
          <ShieldPile shields={state.shields} canClick onBreak={onAttackShield}/>
        </div>
      )}
      {/* 起動型能力（各ターンに一度〜等）。timing:"any" の能力は相手ターン中でも使えるので isActive とは独立に出す */}
      {activatedCount>0&&onOpenActivated&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
          <Btn onClick={onOpenActivated} col="#cc99ff">起動能力 ({activatedCount})</Btn>
        </div>
      )}
      {isActive&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
          {!drewThisTurn&&<Btn onClick={onDraw} col="#44ff88">DRAW</Btn>}
          {drewThisTurn&&!chargedThisTurn&&selHand!==null&&<Btn onClick={handleCharge} col="#8888ff">CHARGE</Btn>}
          {drewThisTurn&&selHand!==null&&<Btn onClick={handlePlay} col="#ff8844" disabled={!civCheck?.ok}>PLAY</Btn>}
          {drewThisTurn&&selHand!==null&&gZeroOk&&<Btn onClick={handleGZeroPlay} col="#ff44ff">G-ZERO</Btn>}
          {drewThisTurn&&selHand!==null&&freeCastPerm&&<Btn onClick={handleFreeCastPlay} col="#66ddff">コスト不要</Btn>}
          {drewThisTurn&&attackingUid&&otherState.shields.length===0&&<Btn onClick={onDirectAttack} col="#ff4444">DIRECT</Btn>}
          {drewThisTurn&&<Btn onClick={onEndTurn} col="#ffaa44">END TURN</Btn>}
        </div>
      )}
      <ExceptionPanel pid={pid} state={state} setState={setState} otherState={otherState} setOtherState={setOtherState} addLog={addLog}/>
    </div>
  );
}
