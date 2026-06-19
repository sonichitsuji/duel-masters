import { useState } from "react";
import { CIV, EFFECT_TYPE_LABELS } from "../../constants";
import { shuffle, extractManyFromBattle, getCardCivs } from "../../gameLogic";
import { CardFace, CardBack } from "../CardFace";

// ===========================
// EFFECT MODAL
// ===========================
export function EffectModal({modal,p1State,setP1,p2State,setP2,onClose,addLog}){
  const [selected,setSelected]=useState([]);
  if(!modal) return null;
  const ownerState=modal.ownerPid==="p1"?p1State:p2State;
  const setOwner=modal.ownerPid==="p1"?setP1:setP2;
  const otherState=modal.ownerPid==="p1"?p2State:p1State;
  const setOther=modal.ownerPid==="p1"?setP2:setP1;
  const toggle=uid=>setSelected(p=>p.includes(uid)?p.filter(x=>x!==uid):[...p,uid]);
  let title="",cards=[],maxSel=modal.amount||1,zone="";
  if(modal.type==="discard"){title=`手札から${modal.amount}枚捨てる`;cards=ownerState.hand;zone="hand";}
  else if(modal.type==="handDestroy"){title=`相手手札から${modal.amount}枚捨てさせる`;cards=(modal.target==="opponent"?otherState:ownerState).hand;zone="hand";}
  else if(modal.type==="destroy"){title=`クリーチャー${modal.amount}体破壊`;cards=(modal.target==="opponent"?otherState:ownerState).battle;zone="battle";}
  else if(modal.type==="sendToMana"){title=`クリーチャー${modal.amount}体をマナへ`;cards=(modal.target==="opponent"?otherState:ownerState).battle;zone="battle";}
  else if(modal.type==="bounce"){title=`クリーチャー${modal.amount}体を手札へ`;cards=(modal.target==="opponent"?otherState:ownerState).battle;zone="battle";}
  else if(modal.type==="manaReturn"){title=`マナから${modal.amount}枚手札へ${modal.optional?"（任意）":""}`;cards=ownerState.mana;zone="mana";maxSel=modal.optional?1:modal.amount;}
  else if(modal.type==="deckSearch"){title=`山札から${modal.amount}枚選ぶ`;cards=ownerState.deck;zone="deck";}
  const ready=modal.optional?selected.length<=maxSel:selected.length===maxSel;
  const confirm=()=>{
    if(modal.type==="discard"||modal.type==="handDestroy"){
      const setT=modal.type==="handDestroy"&&modal.target==="opponent"?setOther:setOwner;
      const st=modal.type==="handDestroy"&&modal.target==="opponent"?otherState:ownerState;
      setT(s=>({...s,hand:s.hand.filter(c=>!selected.includes(c.uid)),grave:[...s.grave,...s.hand.filter(c=>selected.includes(c.uid))]}));
      addLog(`${modal.pid}: ${selected.length}枚捨て`);
    }else if(modal.type==="destroy"){const setT=modal.target==="opponent"?setOther:setOwner;const st=modal.target==="opponent"?otherState:ownerState;const d=st.battle.filter(c=>selected.includes(c.uid));setT(s=>{const{newBattle,extracted}=extractManyFromBattle(s.battle,selected);return{...s,battle:newBattle,grave:[...s.grave,...extracted]};});addLog(`${modal.pid}: ${d.length}体破壊`);}
    else if(modal.type==="sendToMana"){const setT=modal.target==="opponent"?setOther:setOwner;const st=modal.target==="opponent"?otherState:ownerState;const m=st.battle.filter(c=>selected.includes(c.uid));setT(s=>{const{newBattle,extracted}=extractManyFromBattle(s.battle,selected);return{...s,battle:newBattle,mana:[...s.mana,...extracted.map(c=>({...c,tapped:false}))]};});addLog(`${modal.pid}: ${m.length}体マナへ`);}
    else if(modal.type==="bounce"){const setT=modal.target==="opponent"?setOther:setOwner;const st=modal.target==="opponent"?otherState:ownerState;const b=st.battle.filter(c=>selected.includes(c.uid));setT(s=>{const{newBattle,extracted}=extractManyFromBattle(s.battle,selected);return{...s,battle:newBattle,hand:[...s.hand,...extracted.map(c=>({...c,tapped:false,hyperMode:false,cantAttackThisTurn:false,summonedThisTurn:false}))]};});addLog(`${modal.pid}: ${b.length}体手札へ`);}
    else if(modal.type==="manaReturn"){const m=ownerState.mana.filter(c=>selected.includes(c.uid));setOwner(s=>({...s,mana:s.mana.filter(c=>!selected.includes(c.uid)),hand:[...s.hand,...m.map(c=>({...c,tapped:false}))]}));addLog(`${modal.pid}: マナ${m.length}枚手札へ`);}
    else if(modal.type==="deckSearch"){const m=ownerState.deck.filter(c=>selected.includes(c.uid));setOwner(s=>({...s,deck:shuffle(s.deck.filter(c=>!selected.includes(c.uid))),hand:[...s.hand,...m]}));addLog(`${modal.pid}: デッキ${m.length}枚→手札`);}
    onClose();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a18",border:"1px solid #ffe06655",borderRadius:14,padding:18,maxWidth:480,width:"100%",maxHeight:"80vh",overflow:"auto"}}>
        <div style={{fontFamily:"'Cinzel',serif",fontWeight:900,color:"#ffe066",fontSize:13,marginBottom:10,letterSpacing:1}}>{title}</div>
        <div style={{color:"#777",fontSize:11,marginBottom:10}}>{selected.length}/{maxSel} 選択中</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {cards.map(c=>(zone==="deck"&&modal.type!=="deckSearch")?<CardBack key={c.uid} small onClick={()=>toggle(c.uid)} label={selected.includes(c.uid)?"✓":""}/>:<CardFace key={c.uid} card={c} small selected={selected.includes(c.uid)} onClick={()=>toggle(c.uid)}/>)}
          {cards.length===0&&<div style={{color:"#444",fontSize:12}}>対象なし</div>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={confirm} disabled={!ready} style={{padding:"8px 24px",borderRadius:6,fontWeight:700,fontSize:13,background:ready?"linear-gradient(135deg,#ffe066,#ff9900)":"#222",border:"none",color:ready?"#000":"#555",cursor:ready?"pointer":"not-allowed"}}>確定</button>
          {modal.optional&&<button onClick={onClose} style={{padding:"8px 16px",borderRadius:6,background:"#1a1a2a",border:"1px solid #333",color:"#888",cursor:"pointer",fontSize:12}}>スキップ</button>}
        </div>
      </div>
    </div>
  );
}

export function EffectConfirmModal({ modal, onConfirm, onSkip }) {
  if (!modal) return null;
  const { srcCard, effect } = modal;
  const civs = getCardCivs(srcCard || {});
  const c = CIV[civs[0]] || CIV.fire;
  const label = EFFECT_TYPE_LABELS[effect?.type] || effect?.type || "不明な効果";
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:370, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:340, width:"100%", boxShadow:`0 0 30px ${c.glow}55` }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:14, fontWeight:900, marginBottom:4, letterSpacing:1 }}>効果発動確認</div>
        <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:4 }}>
          {civs.map(cv=>{const cv_=CIV[cv];return cv_?<span key={cv} style={{fontSize:11,fontWeight:900,color:cv_.textColor,background:`${cv_.color}33`,borderRadius:2,padding:"0 3px",marginRight:2}}>{cv_.label}</span>:null;})} {srcCard?.name || "不明"}
        </div>
        <div style={{ fontSize:11, color:"#aaa", marginBottom:14, padding:"8px 10px", background:"rgba(0,0,0,0.4)", borderRadius:6, border:`1px solid ${c.color}33` }}>
          {label}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onConfirm} style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:`linear-gradient(135deg,${c.color}55,${c.color}22)`, border:`1px solid ${c.color}`, color:c.textColor, cursor:"pointer" }}>
            発動する
          </button>
          <button onClick={onSkip} style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#666", cursor:"pointer", fontSize:12 }}>
            例外処理で手動対応
          </button>
        </div>
      </div>
    </div>
  );
}
