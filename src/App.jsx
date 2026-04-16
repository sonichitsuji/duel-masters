import { useState, useCallback, useRef, useEffect } from "react";

// ===========================
// INITIAL CARD DATABASE
// ===========================
const INITIAL_CARD_DB = [
  { id:1,  name:"ボルメテウス・ホワイト・ドラゴン", cost:8,  power:11000, type:"creature", civ:"fire",     keywords:["speedAttacker","wBreaker"],  effect:"スピードアタッカー。W・ブレイカー。シールドブレイク時、そのシールドは墓地へ。", autoEffect:null },
  { id:2,  name:"アクアン",                         cost:5,  power:3000,  type:"creature", civ:"water",    keywords:["drawOnPlay"],                effect:"バトルゾーンに出たとき、カードを5枚引き、3枚捨てる。", autoEffect:{ trigger:"play", type:"draw", amount:5, thenDiscard:3 } },
  { id:3,  name:"クリスタル・パラディン",           cost:6,  power:6000,  type:"creature", civ:"water",    keywords:["blocker","wBreaker"],         effect:"ブロッカー。W・ブレイカー。", autoEffect:null },
  { id:5,  name:"ロスト・ソウル",                   cost:7,  power:0,     type:"spell",    civ:"darkness", keywords:[],                             effect:"相手の手札を全て見て、2枚選んで捨てさせる。", autoEffect:{ trigger:"cast", type:"handDestroy", amount:2, target:"opponent" } },
  { id:6,  name:"ガントラ・マックス",               cost:3,  power:3000,  type:"creature", civ:"fire",     keywords:["speedAttacker"],              effect:"スピードアタッカー。", autoEffect:null },
  { id:7,  name:"光輪の精霊ピカリエ",               cost:3,  power:3500,  type:"creature", civ:"light",    keywords:["blocker","cantAttack"],       effect:"ブロッカー。このクリーチャーは攻撃できない。", autoEffect:null },
  { id:8,  name:"ナチュラル・トラップ",             cost:5,  power:0,     type:"spell",    civ:"nature",   keywords:["sTrigger"],                   effect:"S・トリガー。相手クリーチャー1体をマナゾーンに置く。", autoEffect:{ trigger:"cast", type:"sendToMana", target:"opponent", amount:1 } },
  { id:9,  name:"アクア・エージェント",             cost:2,  power:2000,  type:"creature", civ:"water",    keywords:[],                             effect:"バトルゾーンに出たとき、カードを1枚引く。", autoEffect:{ trigger:"play", type:"draw", amount:1 } },
  { id:10, name:"デーモン・ハンド",                 cost:6,  power:0,     type:"spell",    civ:"darkness", keywords:["sTrigger"],                   effect:"S・トリガー。相手クリーチャー1体を破壊する。", autoEffect:{ trigger:"cast", type:"destroy", target:"opponent", amount:1 } },
  { id:11, name:"リーフ・ストーム",                 cost:2,  power:0,     type:"spell",    civ:"nature",   keywords:[],                             effect:"自分のマナゾーンのカード1枚を手札に加える。", autoEffect:{ trigger:"cast", type:"manaReturn", target:"self", amount:1 } },
  { id:12, name:"紅蓮の戦士ガルベリアス",           cost:5,  power:5000,  type:"creature", civ:"fire",     keywords:["speedAttacker","wBreaker"],   effect:"スピードアタッカー。W・ブレイカー。", autoEffect:null },
  { id:13, name:"エメラルド・グラスパー",           cost:3,  power:4000,  type:"creature", civ:"nature",   keywords:[],                             effect:"バトルゾーンに出たとき、自分のマナゾーンのカードを1枚手札に加えてもよい。", autoEffect:{ trigger:"play", type:"manaReturn", target:"self", amount:1, optional:true } },
  { id:14, name:"霊騎コルテオ",                     cost:4,  power:3000,  type:"creature", civ:"light",    keywords:["blocker"],                    effect:"ブロッカー。", autoEffect:null },
  { id:15, name:"斬隠テンサイ・ジャニット",         cost:3,  power:1000,  type:"creature", civ:"darkness", keywords:[],                             effect:"このクリーチャーが攻撃するとき、相手はカードを1枚捨てる。[攻撃時例外処理]", autoEffect:null },
  { id:16, name:"アクア・ハルカス",                 cost:2,  power:1000,  type:"creature", civ:"water",    keywords:[],                             effect:"バトルゾーンに出たとき、カードを1枚引く。", autoEffect:{ trigger:"play", type:"draw", amount:1 } },
  { id:17, name:"サイバー・ブレイン",               cost:5,  power:0,     type:"spell",    civ:"water",    keywords:["sTrigger"],                   effect:"S・トリガー。カードを3枚引く。", autoEffect:{ trigger:"cast", type:"draw", amount:3 } },
  { id:18, name:"クリスタル・メモリー",             cost:4,  power:0,     type:"spell",    civ:"water",    keywords:[],                             effect:"自分の山札を見て、カードを1枚手札に加える。シャッフルする。", autoEffect:{ trigger:"cast", type:"deckSearch", amount:1 } },
  { id:19, name:"魂と記憶の盾",                     cost:5,  power:0,     type:"spell",    civ:"light",    keywords:[],                             effect:"相手のクリーチャー1体を持ち主の手札に戻す。", autoEffect:{ trigger:"cast", type:"bounce", target:"opponent", amount:1 } },
  { id:20, name:"スパイラル・ゲート",               cost:4,  power:0,     type:"spell",    civ:"water",    keywords:["sTrigger"],                   effect:"S・トリガー。相手のクリーチャー1体を持ち主の手札に戻す。", autoEffect:{ trigger:"cast", type:"bounce", target:"opponent", amount:1 } },
  { id:21, name:"地獄スクラッパー",                 cost:5,  power:0,     type:"spell",    civ:"fire",     keywords:["sTrigger"],                   effect:"S・トリガー。パワー3000以下の相手クリーチャーを全て破壊する。", autoEffect:{ trigger:"cast", type:"destroyUnder", target:"opponent", threshold:3000 } },
  { id:22, name:"フェアリー・ライフ",               cost:2,  power:0,     type:"spell",    civ:"nature",   keywords:["sTrigger"],                   effect:"S・トリガー。自分の山札の上から1枚をマナゾーンに置く。", autoEffect:{ trigger:"cast", type:"deckToMana", amount:1 } },
  { id:23, name:"ホーリー・スパーク",               cost:4,  power:0,     type:"spell",    civ:"light",    keywords:["sTrigger"],                   effect:"S・トリガー。相手のクリーチャーをすべてタップする。", autoEffect:{ trigger:"cast", type:"tapAll", target:"opponent" } },
  { id:24, name:"クリムゾン・チャージャー",         cost:3,  power:0,     type:"spell",    civ:"fire",     keywords:[],                             effect:"自分の山札の上から3枚を墓地に置く。その中のクリーチャー1体をBZに出せる。[例外処理]", autoEffect:null },
  { id:25, name:"ボルバルザーク・エクス",           cost:7,  power:6000,  type:"creature", civ:"fire",     keywords:["speedAttacker","wBreaker"],   effect:"スピードアタッカー。W・ブレイカー。このクリーチャーがバトルゾーンに出たとき、相手のマナゾーンのカードを1枚選んで墓地に置く。[例外処理]", autoEffect:null },
  { id:26, name:"界王類邪龍目ギョウ",               cost:8,  power:13000, type:"creature", civ:"darkness", keywords:["tBreaker"],                   effect:"T・ブレイカー。相手がクリーチャーを召喚するとき、そのクリーチャーのコストを2多くする。[例外処理]", autoEffect:null },
  { id:27, name:"聖霊王アルカディアス",             cost:7,  power:9000,  type:"creature", civ:"light",    keywords:["wBreaker"],                   effect:"W・ブレイカー。相手は闇のカードを使えない。[例外処理]", autoEffect:null },
  { id:28, name:"魔龍バベルギヌス",                 cost:7,  power:6000,  type:"creature", civ:"darkness", keywords:[],                             effect:"このクリーチャーがバトルゾーンに出たとき、相手のクリーチャー1体と自分のクリーチャー1体を破壊する。[例外処理]", autoEffect:null },
  { id:29, name:"ヘブンズ・ゲート",                cost:6,  power:0,     type:"spell",    civ:"light",    keywords:["sTrigger"],                   effect:"S・トリガー。ブロッカーを2体まで、自分の手札からバトルゾーンに出す。[例外処理]", autoEffect:null },
  { id:30, name:"母なる大地",                       cost:4,  power:0,     type:"spell",    civ:"nature",   keywords:["sTrigger"],                   effect:"S・トリガー。バトルゾーンにある自分のクリーチャー1体をマナゾーンに置き、自分のマナゾーンからクリーチャーを1体出す。[例外処理]", autoEffect:null },
];

const ALL_KEYWORDS = ["speedAttacker","wBreaker","tBreaker","blocker","cantAttack","sTrigger","drawOnPlay"];
const KEYWORD_LABELS = { speedAttacker:"スピードアタッカー", wBreaker:"W・ブレイカー", tBreaker:"T・ブレイカー", blocker:"ブロッカー", cantAttack:"攻撃不可", sTrigger:"S・トリガー", drawOnPlay:"ドロー(召喚時)" };

const CIV = {
  fire:     { label:"火", color:"#e74c3c", glow:"#ff4444", bg:"#1a0505", icon:"🔥", textColor:"#ff8877" },
  water:    { label:"水", color:"#3498db", glow:"#4488ff", bg:"#020a1a", icon:"💧", textColor:"#77aaff" },
  darkness: { label:"闇", color:"#9b59b6", glow:"#aa44ff", bg:"#0a0010", icon:"💀", textColor:"#bb88ff" },
  nature:   { label:"自", color:"#27ae60", glow:"#44ff88", bg:"#021008", icon:"🌿", textColor:"#88ff99" },
  light:    { label:"光", color:"#f1c40f", glow:"#ffcc44", bg:"#101005", icon:"✨", textColor:"#ffdd66" },
};
const CIVS = Object.keys(CIV);

const ZONES = ["hand","battle","mana","grave","shield","deck"];
const ZONE_LABELS = { hand:"手札", battle:"バトルゾーン", mana:"マナゾーン", grave:"墓地", shield:"シールド", deck:"山札" };

// ===========================
// HELPERS
// ===========================
let _uid = 1;
const mkUid = () => `c${_uid++}`;
let _cardId = 200;
const mkCardId = () => ++_cardId;

function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

function makeDeckFromList(cardIds, cardDb) {
  return shuffle(cardIds.map(id=>{
    const base=cardDb.find(c=>c.id===id)||cardDb[0];
    return {...base,uid:mkUid(),tapped:false,summonedThisTurn:false};
  }));
}

function defaultDeckIds(cardDb) {
  const pool=cardDb.slice(0,15).map(c=>c.id);
  const ids=[];
  for(let i=0;ids.length<40;i++) ids.push(pool[i%pool.length]);
  return ids;
}

function initPlayerState(deckIds, cardDb) {
  const deck=makeDeckFromList(deckIds, cardDb);
  return {deck:deck.slice(10),hand:deck.slice(5,10),shields:deck.slice(0,5),battle:[],mana:[],grave:[]};
}

function canPayCost(mana,card){
  const untapped=mana.filter(c=>!c.tapped);
  if(untapped.length<card.cost) return {ok:false,reason:`マナ不足 (必要:${card.cost} / 利用可能:${untapped.length})`};
  if(card.cost===0) return {ok:true};
  const hasCiv=untapped.some(c=>c.civ===card.civ);
  if(!hasCiv) return {ok:false,reason:`${CIV[card.civ]?.label}文明のマナが必要です`};
  return {ok:true};
}

function tapManaForCost(mana,card){
  let tapped=0;const needed=card.cost;const nm=mana.map(c=>({...c}));
  for(let i=0;i<nm.length&&tapped<needed;i++){if(!nm[i].tapped&&nm[i].civ===card.civ){nm[i].tapped=true;tapped++;}}
  for(let i=0;i<nm.length&&tapped<needed;i++){if(!nm[i].tapped){nm[i].tapped=true;tapped++;}}
  return nm;
}

// autoEffect inference from keywords/effect text
function inferAutoEffect(keywords, effectText) {
  if(keywords.includes("sTrigger") && effectText.includes("引く")) return { trigger:"cast", type:"draw", amount:3 };
  if(keywords.includes("sTrigger") && effectText.includes("タップ")) return { trigger:"cast", type:"tapAll", target:"opponent" };
  if(keywords.includes("sTrigger") && effectText.includes("破壊")) return { trigger:"cast", type:"destroy", target:"opponent", amount:1 };
  if(keywords.includes("sTrigger") && effectText.includes("マナゾーンに置く") && effectText.includes("相手")) return { trigger:"cast", type:"sendToMana", target:"opponent", amount:1 };
  if(keywords.includes("sTrigger") && effectText.includes("手札に戻")) return { trigger:"cast", type:"bounce", target:"opponent", amount:1 };
  if(keywords.includes("sTrigger") && effectText.includes("マナゾーンに置く") && !effectText.includes("相手")) return { trigger:"cast", type:"deckToMana", amount:1 };
  if(effectText.includes("出たとき") && effectText.includes("引く")) return { trigger:"play", type:"draw", amount:1 };
  if(effectText.includes("出たとき") && effectText.includes("マナゾーンのカード") && effectText.includes("手札")) return { trigger:"play", type:"manaReturn", target:"self", amount:1, optional:true };
  if(effectText.includes("手札を全て見て") && effectText.includes("捨て")) return { trigger:"cast", type:"handDestroy", amount:2, target:"opponent" };
  if(effectText.includes("手札に加える") && effectText.includes("マナ")) return { trigger:"cast", type:"manaReturn", target:"self", amount:1 };
  return null;
}

// ===========================
// CUT-IN
// ===========================
function CutIn({cutin,onDone}){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    setVisible(true);
    const t=setTimeout(()=>{setVisible(false);setTimeout(onDone,300);},1800);
    return()=>clearTimeout(t);
  },[]);
  const c=CIV[cutin.civ]||CIV.fire;
  return(
    <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",background:visible?`radial-gradient(ellipse at center,${c.glow}22 0%,transparent 70%)`:"transparent",transition:"background 0.3s"}}>
      <div style={{transform:visible?"scale(1) translateY(0)":"scale(0.6) translateY(30px)",opacity:visible?1:0,transition:"all 0.25s cubic-bezier(0.34,1.56,0.64,1)",display:"flex",flexDirection:"column",alignItems:"center",background:`linear-gradient(135deg,${c.bg}ee,#08080fee)`,border:`3px solid ${c.color}`,borderRadius:16,padding:"18px 40px",boxShadow:`0 0 40px ${c.glow}88,0 0 80px ${c.glow}44`,minWidth:240}}>
        <div style={{fontSize:40,marginBottom:6}}>{cutin.icon||c.icon}</div>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:22,fontWeight:900,color:c.color,textShadow:`0 0 16px ${c.glow}`,letterSpacing:2,marginBottom:4,textAlign:"center"}}>{cutin.title}</div>
        {cutin.cardName&&<div style={{marginTop:8,padding:"4px 12px",borderRadius:4,background:`${c.color}22`,border:`1px solid ${c.color}55`,fontSize:12,color:c.textColor,fontWeight:700}}>{cutin.cardName}</div>}
      </div>
    </div>
  );
}

// ===========================
// EFFECT PROCESSOR
// ===========================
function processEffect(effect,ownerPid,selfState,setSelf,otherState,setOther,addLog,openEffectModal){
  if(!effect) return;
  const pid=ownerPid==="p1"?"P1":"P2";
  switch(effect.type){
    case"draw":{
      const n=Math.min(effect.amount,selfState.deck.length);
      if(n===0){addLog(`${pid}: 山札が空`);return;}
      setSelf(s=>({...s,hand:[...s.hand,...s.deck.slice(0,n)],deck:s.deck.slice(n)}));
      addLog(`${pid}: ${n}枚ドロー`);
      if(effect.thenDiscard>0) openEffectModal({type:"discard",amount:effect.thenDiscard,pid,ownerPid});
      break;
    }
    case"handDestroy":   openEffectModal({type:"handDestroy",  amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"destroy":       openEffectModal({type:"destroy",      amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"sendToMana":    openEffectModal({type:"sendToMana",   amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"bounce":        openEffectModal({type:"bounce",       amount:effect.amount,target:effect.target,pid,ownerPid});break;
    case"manaReturn":    openEffectModal({type:"manaReturn",   amount:effect.amount,target:effect.target,optional:effect.optional,pid,ownerPid});break;
    case"deckSearch":    openEffectModal({type:"deckSearch",   amount:effect.amount,pid,ownerPid});break;
    case"destroyUnder":{
      const tgt=effect.target==="opponent"?otherState:selfState;
      const st=effect.target==="opponent"?setOther:setSelf;
      const d=tgt.battle.filter(c=>c.power<=effect.threshold);
      st(s=>({...s,battle:s.battle.filter(c=>c.power>effect.threshold),grave:[...s.grave,...d]}));
      addLog(`${pid}: パワー${effect.threshold}以下 ${d.length}体破壊`);break;
    }
    case"tapAll":{
      const st2=effect.target==="opponent"?setOther:setSelf;
      st2(s=>({...s,battle:s.battle.map(c=>({...c,tapped:true}))}));
      addLog(`${pid}: 相手BZ全タップ`);break;
    }
    case"deckToMana":{
      setSelf(s=>{
        if(s.deck.length===0) return s;
        const[card,...rest]=s.deck;
        addLog(`${pid}: ${card.name}→マナ`);
        return{...s,deck:rest,mana:[...s.mana,{...card,tapped:false}]};
      });break;
    }
    default: addLog(`[未実装] ${effect.type}`);
  }
}

// ===========================
// CARD COMPONENTS
// ===========================
function CardFace({card,selected,onClick,small,dimmed}){
  const c=CIV[card.civ]||CIV.fire;
  const w=small?52:74;const h=small?72:106;
  return(
    <div onClick={onClick} title={card.name} style={{width:w,height:h,borderRadius:7,flexShrink:0,border:`2px solid ${selected?"#ffe066":c.color}`,background:`linear-gradient(160deg,${c.bg},#08080f)`,cursor:"pointer",position:"relative",transform:card.tapped?"rotate(90deg)":selected?"translateY(-8px) scale(1.07)":"none",opacity:dimmed?0.4:1,boxShadow:selected?`0 0 18px #ffe066`:`0 0 8px ${c.glow}33`,transition:"all 0.15s",display:"flex",flexDirection:"column",padding:"3px 4px",userSelect:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}>
        <span style={{background:c.color,color:"#fff",fontWeight:700,fontSize:small?8:10,borderRadius:3,padding:"0 3px",lineHeight:"15px"}}>{card.cost}</span>
        <span style={{fontSize:small?9:11}}>{c.icon}</span>
      </div>
      <div style={{color:"#fff",fontSize:small?6.5:8.5,fontWeight:700,lineHeight:1.2,textAlign:"center",flex:1,overflow:"hidden",wordBreak:"break-all",margin:"2px 0",textShadow:`0 0 5px ${c.glow}`}}>{card.name.length>13?card.name.slice(0,12)+"…":card.name}</div>
      <div style={{color:c.color,fontSize:small?6:7.5,textAlign:"center",borderTop:`1px solid ${c.color}44`,paddingTop:2}}>{card.type==="creature"?`⚔ ${card.power}`:"📜 呪文"}</div>
      <div style={{position:"absolute",top:2,right:2,display:"flex",flexDirection:"column",gap:1}}>
        {card.keywords?.includes("speedAttacker")&&<span style={{fontSize:7}}>⚡</span>}
        {card.keywords?.includes("blocker")&&<span style={{fontSize:7}}>🛡</span>}
        {card.keywords?.includes("wBreaker")&&<span style={{fontSize:7}}>✦✦</span>}
        {card.keywords?.includes("tBreaker")&&<span style={{fontSize:7}}>✦✦✦</span>}
        {card.keywords?.includes("sTrigger")&&<span style={{fontSize:7,color:"#ff8"}}>ST</span>}
      </div>
      {card.summonedThisTurn&&!card.keywords?.includes("speedAttacker")&&<div style={{position:"absolute",bottom:14,left:0,right:0,textAlign:"center",fontSize:7,color:"#888"}}>酔</div>}
    </div>
  );
}

function CardBack({small,onClick,label}){
  return(
    <div onClick={onClick} style={{width:small?52:74,height:small?72:106,borderRadius:7,border:"2px solid #2a2a4a",flexShrink:0,background:"linear-gradient(135deg,#0d0d1e,#1a1a3a,#0d0d1e)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:small?18:24,userSelect:"none",gap:2}}>🎴{label&&<span style={{fontSize:8,color:"#555"}}>{label}</span>}</div>
  );
}

// ===========================
// MANA DISPLAY
// ===========================
function ManaDisplay({mana}){
  const civCounts={};
  mana.forEach(c=>{if(!civCounts[c.civ])civCounts[c.civ]={total:0,available:0};civCounts[c.civ].total++;if(!c.tapped)civCounts[c.civ].available++;});
  const available=mana.filter(c=>!c.tapped).length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#555"}}>マナ:</span>
        <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{available}</span>
        <span style={{fontSize:10,color:"#333"}}>/ {mana.length}</span>
        {Object.entries(civCounts).map(([civ,cnt])=>{const c=CIV[civ];return(
          <div key={civ} style={{display:"flex",alignItems:"center",gap:2,background:`${c.color}18`,border:`1px solid ${c.color}44`,borderRadius:4,padding:"1px 5px"}}>
            <span style={{fontSize:11}}>{c.icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:cnt.available>0?c.textColor:"#333"}}>{cnt.available}</span>
            {cnt.total>cnt.available&&<span style={{fontSize:9,color:"#333"}}>/{cnt.total}</span>}
          </div>
        );})}
      </div>
      <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
        {mana.map(c=>{const cv=CIV[c.civ];return(
          <div key={c.uid} title={c.name} style={{width:18,height:18,borderRadius:3,background:c.tapped?"#111":cv?.color,border:`1px solid ${c.tapped?"#222":cv?.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,opacity:c.tapped?0.3:1,transition:"all 0.2s",boxShadow:c.tapped?"none":`0 0 4px ${cv?.glow}66`}}>{c.tapped?"":cv?.icon}</div>
        );})}
      </div>
    </div>
  );
}

function ShieldPile({shields,canClick,onBreak}){
  return(
    <div style={{display:"flex",gap:3}}>
      {[0,1,2,3,4].map(i=>{const exists=!!shields[i];return(
        <div key={i} onClick={()=>exists&&canClick&&onBreak(i)} style={{width:26,height:36,borderRadius:5,border:exists?(canClick?"2px solid #ffe066":"2px solid #4a6fa5"):"2px solid #1a1a2a",background:exists?(canClick?"#2a2000":"linear-gradient(135deg,#0d1b2a,#1b3a5c)"):"#080810",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,opacity:exists?1:0.2,cursor:exists&&canClick?"pointer":"default",boxShadow:canClick&&exists?"0 0 8px #ffe066":"none",transition:"all 0.15s"}}>{exists?(canClick?"⚡":"🛡"):""}</div>
      );})}
    </div>
  );
}

function Log({entries}){
  const ref=useRef();
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[entries]);
  return(
    <div ref={ref} style={{height:90,overflowY:"auto",padding:"6px 10px",background:"rgba(0,0,0,0.6)",borderRadius:8,border:"1px solid #141428",fontSize:11,color:"#888"}}>
      {entries.map((e,i)=><div key={i} style={{color:i===entries.length-1?"#ddd":"#555",marginBottom:2}}>{e}</div>)}
    </div>
  );
}

// ===========================
// CREATURE DETAIL PANEL
// ===========================
function CreatureDetailPanel({card,isActive,drewThisTurn,onAttack,onClose}){
  const c=CIV[card.civ]||CIV.fire;
  const canAtk=isActive&&drewThisTurn&&!card.tapped&&!card.keywords?.includes("cantAttack")&&!(card.summonedThisTurn&&!card.keywords?.includes("speedAttacker"));
  const reason=!isActive?null:card.tapped?"攻撃済み":card.keywords?.includes("cantAttack")?"攻撃不可":(card.summonedThisTurn&&!card.keywords?.includes("speedAttacker"))?"召喚酔い":!drewThisTurn?"ドロー前":null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:`linear-gradient(160deg,${c.bg},#0a0a18)`,border:`2px solid ${c.color}`,borderRadius:16,padding:20,maxWidth:340,width:"100%",boxShadow:`0 0 30px ${c.glow}66`}}>
        <div style={{display:"flex",gap:12,marginBottom:12}}>
          <CardFace card={card}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:"#fff",fontSize:14,lineHeight:1.3,marginBottom:4}}>{card.name}</div>
            <div style={{fontSize:11,color:"#777",marginBottom:4}}>{c.icon} {c.label}文明 ／ コスト {card.cost} ／ パワー {card.power}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {card.keywords?.map(k=><span key={k} style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:`${c.color}22`,color:c.textColor,border:`1px solid ${c.color}44`}}>{KEYWORD_LABELS[k]||k}</span>)}
            </div>
          </div>
        </div>
        <div style={{fontSize:11,color:"#bbb",lineHeight:1.6,marginBottom:14,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:6,border:"1px solid #1a1a2a"}}>{card.effect}</div>
        {card.tapped&&<div style={{fontSize:11,color:"#888",marginBottom:8,padding:"4px 8px",background:"#111",borderRadius:4}}>⟳ タップ状態</div>}
        {card.summonedThisTurn&&!card.keywords?.includes("speedAttacker")&&<div style={{fontSize:11,color:"#888",marginBottom:8,padding:"4px 8px",background:"#111",borderRadius:4}}>💤 召喚酔い</div>}
        <div style={{display:"flex",gap:8}}>
          {isActive&&<button onClick={()=>{if(canAtk)onAttack();}} style={{flex:1,padding:"10px",borderRadius:7,fontWeight:700,fontSize:13,background:canAtk?`linear-gradient(135deg,${c.color}44,${c.color}22)`:"#111",border:`1px solid ${canAtk?c.color:"#333"}`,color:canAtk?c.textColor:"#444",cursor:canAtk?"pointer":"not-allowed"}}>{canAtk?"⚔ 攻撃する":`⚔ 攻撃不可 (${reason})`}</button>}
          <button onClick={onClose} style={{padding:"10px 16px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

// ===========================
// EFFECT MODAL
// ===========================
function EffectModal({modal,p1State,setP1,p2State,setP2,onClose,addLog}){
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
    }else if(modal.type==="destroy"){const setT=modal.target==="opponent"?setOther:setOwner;const st=modal.target==="opponent"?otherState:ownerState;const d=st.battle.filter(c=>selected.includes(c.uid));setT(s=>({...s,battle:s.battle.filter(c=>!selected.includes(c.uid)),grave:[...s.grave,...d]}));addLog(`${modal.pid}: ${d.length}体破壊`);}
    else if(modal.type==="sendToMana"){const setT=modal.target==="opponent"?setOther:setOwner;const st=modal.target==="opponent"?otherState:ownerState;const m=st.battle.filter(c=>selected.includes(c.uid));setT(s=>({...s,battle:s.battle.filter(c=>!selected.includes(c.uid)),mana:[...s.mana,...m.map(c=>({...c,tapped:false}))]}));addLog(`${modal.pid}: ${m.length}体マナへ`);}
    else if(modal.type==="bounce"){const setT=modal.target==="opponent"?setOther:setOwner;const st=modal.target==="opponent"?otherState:ownerState;const b=st.battle.filter(c=>selected.includes(c.uid));setT(s=>({...s,battle:s.battle.filter(c=>!selected.includes(c.uid)),hand:[...s.hand,...b]}));addLog(`${modal.pid}: ${b.length}体手札へ`);}
    else if(modal.type==="manaReturn"){const m=ownerState.mana.filter(c=>selected.includes(c.uid));setOwner(s=>({...s,mana:s.mana.filter(c=>!selected.includes(c.uid)),hand:[...s.hand,...m]}));addLog(`${modal.pid}: マナ${m.length}枚手札へ`);}
    else if(modal.type==="deckSearch"){const m=ownerState.deck.filter(c=>selected.includes(c.uid));setOwner(s=>({...s,deck:shuffle(s.deck.filter(c=>!selected.includes(c.uid))),hand:[...s.hand,...m]}));addLog(`${modal.pid}: デッキ${m.length}枚→手札`);}
    onClose();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a18",border:"1px solid #ffe06655",borderRadius:14,padding:18,maxWidth:480,width:"100%",maxHeight:"80vh",overflow:"auto"}}>
        <div style={{fontWeight:700,color:"#ffe066",fontSize:14,marginBottom:10}}>⚡ {title}</div>
        <div style={{color:"#777",fontSize:11,marginBottom:10}}>{selected.length}/{maxSel} 選択中</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {cards.map(c=>zone==="deck"?<CardBack key={c.uid} small onClick={()=>toggle(c.uid)} label={selected.includes(c.uid)?"✓":""}/>:<CardFace key={c.uid} card={c} small selected={selected.includes(c.uid)} onClick={()=>toggle(c.uid)}/>)}
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

// ===========================
// EXCEPTION PANEL
// ===========================
function ExceptionPanel({pid,state,setState,otherState,setOtherState,addLog}){
  const [open,setOpen]=useState(false);
  const [selCards,setSelCards]=useState([]);
  const [targetPid,setTargetPid]=useState("self");
  const [targetZone,setTargetZone]=useState("grave");
  const [powerDelta,setPowerDelta]=useState(1000);
  const [drawN,setDrawN]=useState(1);
  const label=pid==="p1"?"P1":"P2";const color=pid==="p1"?"#4af":"#f84";
  const toggleSel=(zone,uid)=>{const key=`${zone}::${uid}`;setSelCards(p=>p.find(x=>x.key===key)?p.filter(x=>x.key!==key):[...p,{zone,uid,key}]);};
  const isSel=(zone,uid)=>!!selCards.find(x=>x.key===`${zone}::${uid}`);
  const clearSel=()=>setSelCards([]);
  const doMove=()=>{
    if(selCards.length===0)return;
    let ns=JSON.parse(JSON.stringify(state));let no=JSON.parse(JSON.stringify(otherState));
    const byZone={};selCards.forEach(({zone,uid})=>{(byZone[zone]=byZone[zone]||[]).push(uid);});
    const moved=[];Object.entries(byZone).forEach(([zone,uids])=>{moved.push(...ns[zone].filter(c=>uids.includes(c.uid)));ns[zone]=ns[zone].filter(c=>!uids.includes(c.uid));});
    if(targetPid==="self"){if(targetZone==="deck")ns.deck=shuffle([...ns.deck,...moved]);else ns[targetZone]=[...(ns[targetZone]||[]),...moved];}
    else{if(targetZone==="deck")no.deck=shuffle([...no.deck,...moved]);else no[targetZone]=[...(no[targetZone]||[]),...moved];}
    addLog(`[${label}例外] ${moved.map(c=>c.name).join(",")} → ${targetPid==="self"?"自":"相手"}の${ZONE_LABELS[targetZone]}`);
    setState(ns);setOtherState(no);clearSel();
  };
  const moveZone=fromZone=>{const cards=state[fromZone]||[];if(cards.length===0)return;setState(s=>{const ns={...s,[fromZone]:[]};if(targetPid==="self")return targetZone==="deck"?{...ns,deck:shuffle([...ns.deck,...cards])}:{...ns,[targetZone]:[...(ns[targetZone]||[]),...cards]};return ns;});if(targetPid==="other")setOtherState(s=>targetZone==="deck"?{...s,deck:shuffle([...s.deck,...cards])}:{...s,[targetZone]:[...(s[targetZone]||[]),...cards]});addLog(`[${label}例外] ${ZONE_LABELS[fromZone]}全→${targetPid==="self"?"自":"相手"}の${ZONE_LABELS[targetZone]}`);};
  const doTap=tap=>{let ns=JSON.parse(JSON.stringify(state));selCards.forEach(({zone,uid})=>{const idx=ns[zone]?.findIndex(c=>c.uid===uid);if(idx>=0)ns[zone][idx].tapped=tap;});setState(ns);addLog(`[${label}例外] ${tap?"タップ":"アンタップ"}`);clearSel();};
  const tapAllBattle=tap=>{setState(s=>({...s,battle:s.battle.map(c=>({...c,tapped:tap}))}));addLog(`[${label}例外] BZ全${tap?"タップ":"アンタップ"}`);};
  const doPower=()=>{let ns=JSON.parse(JSON.stringify(state));let ch=0;selCards.filter(x=>x.zone==="battle").forEach(({uid})=>{const idx=ns.battle.findIndex(c=>c.uid===uid);if(idx>=0){ns.battle[idx].power=Math.max(0,(ns.battle[idx].power||0)+powerDelta);ch++;}});setState(ns);if(ch)addLog(`[${label}例外] パワー${powerDelta>0?"+":""}${powerDelta} (${ch}体)`);};
  const doDrawN=()=>{const n=Math.min(drawN,state.deck.length);if(n===0)return;setState(s=>({...s,hand:[...s.hand,...s.deck.slice(0,n)],deck:s.deck.slice(n)}));addLog(`[${label}例外] ${n}枚ドロー`);};
  const doShuffle=()=>{setState(s=>({...s,deck:shuffle([...s.deck])}));addLog(`[${label}例外] 山札シャッフル`);};
  const addShield=()=>{if(state.shields.length>=5||state.deck.length===0)return;setState(s=>({...s,shields:[...s.shields,s.deck[0]],deck:s.deck.slice(1)}));addLog(`[${label}例外] シールド追加`);};
  const Btn=({children,onClick,col="#aaa"})=>(<button onClick={onClick} style={{padding:"6px 10px",borderRadius:5,border:`1px solid ${col}33`,background:"rgba(255,255,255,0.03)",color:col,cursor:"pointer",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</button>);
  if(!open) return(<button onClick={()=>setOpen(true)} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${color}44`,background:`${color}11`,color,cursor:"pointer",fontSize:11,fontWeight:700}}>🔧 {label} 例外処理</button>);
  return(
    <div style={{background:"#07071a",border:`1px solid ${color}44`,borderRadius:12,padding:14,fontSize:11}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{color,fontWeight:700,fontSize:13}}>🔧 {label} 例外処理パネル</span>
        <button onClick={()=>{setOpen(false);clearSel();}} style={{padding:"3px 10px",borderRadius:4,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:11}}>✕</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {ZONES.map(z=>(
          <div key={z} style={{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"8px 10px",border:"1px solid #141428"}}>
            <div style={{color:"#555",fontSize:10,marginBottom:5,fontWeight:700}}>{ZONE_LABELS[z]} ({(state[z]||[]).length}枚)</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {(state[z]||[]).map(c=>z==="deck"?<CardBack key={c.uid} small onClick={()=>toggleSel(z,c.uid)} label={isSel(z,c.uid)?"✓":""}/>:<CardFace key={c.uid} card={c} small selected={isSel(z,c.uid)} onClick={()=>toggleSel(z,c.uid)}/>)}
              {(state[z]||[]).length===0&&<span style={{color:"#1e1e2e",fontSize:10}}>空</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(255,224,102,0.06)",border:"1px solid #ffe06622",borderRadius:6,padding:"6px 10px",marginBottom:10,minHeight:28}}>
        <span style={{color:"#ffe066",fontSize:10,fontWeight:600}}>選択中 {selCards.length}枚: {selCards.map(x=>(state[x.zone]||[]).find(c=>c.uid===x.uid)?.name).filter(Boolean).join(", ")||"なし"}</span>
        {selCards.length>0&&<button onClick={clearSel} style={{marginLeft:8,fontSize:9,color:"#555",background:"none",border:"none",cursor:"pointer"}}>クリア</button>}
      </div>
      <div style={{marginBottom:10}}>
        <div style={{color:"#444",fontSize:10,marginBottom:4}}>移動先:</div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {["self","other"].map(p=><button key={p} onClick={()=>setTargetPid(p)} style={{padding:"4px 12px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${targetPid===p?color:"#333"}`,background:targetPid===p?`${color}22`:"#0a0a14",color:targetPid===p?color:"#555"}}>{p==="self"?"自分":"相手"}</button>)}
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {ZONES.map(z=><button key={z} onClick={()=>setTargetZone(z)} style={{padding:"4px 10px",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",border:`1px solid ${targetZone===z?"#ffe066":"#222"}`,background:targetZone===z?"rgba(255,224,102,0.1)":"#0a0a14",color:targetZone===z?"#ffe066":"#555"}}>{ZONE_LABELS[z]}</button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:10}}>
        <Btn onClick={doMove} col="#4af">選択→移動先</Btn><Btn onClick={doShuffle} col="#8f8">山札シャッフル</Btn>
        <Btn onClick={()=>moveZone("grave")} col="#a8f">墓地全→移動先</Btn><Btn onClick={()=>moveZone("hand")} col="#8af">手札全→移動先</Btn>
        <Btn onClick={()=>moveZone("battle")} col="#fa8">BZ全→移動先</Btn><Btn onClick={addShield} col="#4af">山札上→シールド</Btn>
        <Btn onClick={()=>doTap(true)} col="#ff8">選択タップ</Btn><Btn onClick={()=>doTap(false)} col="#ff8">選択アンタップ</Btn>
        <Btn onClick={()=>tapAllBattle(false)} col="#ff8">BZ全アンタップ</Btn><Btn onClick={()=>tapAllBattle(true)} col="#ff8">BZ全タップ</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"#555",fontSize:10,width:76}}>パワー変更:</span>
          <input type="number" value={powerDelta} step={1000} onChange={e=>setPowerDelta(Number(e.target.value))} style={{width:70,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:4,padding:"3px 6px",fontSize:11}}/>
          <Btn onClick={doPower} col="#f88">選択BZに適用</Btn>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"#555",fontSize:10,width:76}}>ドロー枚数:</span>
          <input type="number" value={drawN} min={1} max={20} onChange={e=>setDrawN(Number(e.target.value))} style={{width:50,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:4,padding:"3px 6px",fontSize:11}}/>
          <Btn onClick={doDrawN} col="#4f8">ドロー実行</Btn>
        </div>
      </div>
    </div>
  );
}

// ===========================
// PLAYER BOARD
// ===========================
function PlayerBoard({pid,state,setState,otherState,setOtherState,isActive,attackingUid,onDraw,onChargeMana,onPlayCard,onStartAttack,onEndTurn,onAttackCreature,onAttackShield,drewThisTurn,chargedThisTurn,addLog}){
  const [selHand,setSelHand]=useState(null);
  const [selBattle,setSelBattle]=useState(null);
  const label=pid==="p1"?"P1":"P2";const color=pid==="p1"?"#4af":"#f84";
  const availMana=state.mana.filter(c=>!c.tapped).length;
  useEffect(()=>{setSelHand(null);setSelBattle(null);},[isActive]);
  const selectedCard=selHand!==null?state.hand[selHand]:null;
  const civCheck=selectedCard?canPayCost(state.mana,selectedCard):null;
  const selBattleCard=selBattle?state.battle.find(c=>c.uid===selBattle):null;
  const handleHandClick=i=>{if(!isActive)return;setSelBattle(null);setSelHand(selHand===i?null:i);};
  const handleBattleClick=card=>{if(attackingUid&&!isActive){onAttackCreature(card.uid);return;}setSelHand(null);setSelBattle(selBattle===card.uid?null:card.uid);};
  const handleCharge=()=>{if(selHand===null)return;onChargeMana(selHand);setSelHand(null);};
  const handlePlay=()=>{if(selHand===null)return;const ok=onPlayCard(selHand);if(ok!==false)setSelHand(null);};
  const Btn=({children,onClick,col,disabled})=>(<button onClick={onClick} disabled={disabled} style={{padding:"6px 12px",borderRadius:5,border:`1px solid ${col}44`,background:disabled?"#111":`${col}18`,color:disabled?"#333":col,cursor:disabled?"not-allowed":"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</button>);
  return(
    <div style={{background:`rgba(${pid==="p1"?"10,30,80":"80,15,10"},0.1)`,border:`1px solid ${color}22`,borderRadius:12,padding:"10px 12px"}}>
      {selBattleCard&&<CreatureDetailPanel card={selBattleCard} isActive={isActive} drewThisTurn={drewThisTurn} onAttack={()=>{onStartAttack(selBattleCard.uid);setSelBattle(null);}} onClose={()=>setSelBattle(null)}/>}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
        <span style={{fontWeight:700,color,fontSize:13}}>{pid==="p1"?"🧑":"👹"} {label}{isActive&&<span style={{fontSize:10,color:"#ffe066",marginLeft:6}}>▶ アクティブ</span>}</span>
        <span style={{fontSize:10,color:"#444"}}>手札:{state.hand.length} BZ:{state.battle.length} 墓地:{state.grave.length} 山:{state.deck.length}</span>
        <ShieldPile shields={state.shields} canClick={!!(attackingUid&&!isActive)} onBreak={onAttackShield} style={{marginLeft:"auto"}}/>
      </div>
      <div style={{marginBottom:8}}><ManaDisplay mana={state.mana}/></div>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:"#333",marginBottom:4}}>バトルゾーン <span style={{color:"#222",fontSize:9}}>(タップで詳細)</span></div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",minHeight:36}}>
          {state.battle.map(c=><CardFace key={c.uid} card={c} selected={selBattle===c.uid||attackingUid===c.uid} dimmed={!!(attackingUid&&attackingUid!==c.uid&&isActive)} onClick={()=>handleBattleClick(c)}/>)}
          {state.battle.length===0&&<span style={{color:"#1e1e2e",fontSize:10,alignSelf:"center"}}>空</span>}
        </div>
      </div>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:"#333",marginBottom:4}}>手札</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {state.hand.map((c,i)=>pid==="p2"&&!isActive?<CardBack key={c.uid} small onClick={()=>handleHandClick(i)}/>:<CardFace key={c.uid} card={c} selected={selHand===i} onClick={()=>handleHandClick(i)}/>)}
          {state.hand.length===0&&<span style={{color:"#1e1e2e",fontSize:10,alignSelf:"center"}}>空</span>}
        </div>
      </div>
      {selectedCard&&(
        <div style={{background:"#080818",border:`1px solid ${CIV[selectedCard.civ]?.color}55`,borderRadius:8,padding:"8px 12px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><span style={{fontWeight:700,color:"#fff",fontSize:12}}>{CIV[selectedCard.civ]?.icon} {selectedCard.name}</span><span style={{color:"#666",fontSize:10,marginLeft:8}}>コスト:{selectedCard.cost}{selectedCard.type==="creature"&&` / パワー:${selectedCard.power}`}</span></div>
            <div style={{fontSize:10,color:civCheck?.ok?"#4f8":"#f84",fontWeight:700}}>{civCheck?.ok?`✓ プレイ可 (${availMana}マナ)`:`✗ ${civCheck?.reason}`}</div>
          </div>
          <div style={{fontSize:10,color:"#999",marginTop:4,lineHeight:1.5}}>{selectedCard.effect}</div>
        </div>
      )}
      {attackingUid&&!isActive&&(
        <div style={{background:"rgba(255,80,0,0.08)",border:"1px dashed #f8444488",borderRadius:6,padding:"6px 10px",marginBottom:8}}>
          <div style={{fontSize:11,color:"#f84",marginBottom:4}}>⚔ 攻撃対象を選択</div>
          <ShieldPile shields={state.shields} canClick onBreak={onAttackShield}/>
        </div>
      )}
      {isActive&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
          {!drewThisTurn&&<Btn onClick={onDraw} col="#44ff88">📥 ドロー</Btn>}
          {drewThisTurn&&!chargedThisTurn&&selHand!==null&&<Btn onClick={handleCharge} col="#8888ff">💎 マナチャージ</Btn>}
          {drewThisTurn&&selHand!==null&&<Btn onClick={handlePlay} col="#ff8844" disabled={!civCheck?.ok}>▶ プレイ</Btn>}
          {drewThisTurn&&attackingUid&&state.shields.length===0&&<Btn onClick={()=>addLog("💥 ダイレクトアタック！勝利！")} col="#ff4444">💥 ダイレクト</Btn>}
          {drewThisTurn&&<Btn onClick={onEndTurn} col="#ffaa44">⏭ ターン終了</Btn>}
        </div>
      )}
      <ExceptionPanel pid={pid} state={state} setState={setState} otherState={otherState} setOtherState={setOtherState} addLog={addLog}/>
    </div>
  );
}

// ===========================
// HANDOFF SCREEN
// ===========================
function HandoffScreen({from,to,onReady}){
  return(
    <div style={{position:"fixed",inset:0,background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:400}}>
      <div style={{fontSize:56,marginBottom:12}}>🔄</div>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:24,color:"#ffe066",textShadow:"0 0 20px #ffe066",marginBottom:8}}>画面を渡してください</div>
      <div style={{color:"#555",fontSize:14,marginBottom:32}}>{from} → {to} のターン</div>
      <button onClick={onReady} style={{padding:"14px 48px",borderRadius:10,fontSize:18,fontWeight:900,background:"linear-gradient(135deg,#ffe066,#ff9900)",border:"none",color:"#000",cursor:"pointer"}}>準備完了 ▶</button>
    </div>
  );
}

// ===========================
// CARD EDITOR (add/edit single card)
// ===========================
function CardEditor({card, onSave, onCancel}){
  const isNew=!card;
  const [form,setForm]=useState(card?{...card}:{
    name:"",cost:1,power:1000,type:"creature",civ:"fire",keywords:[],effect:"",autoEffect:null
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleKw=kw=>set("keywords",form.keywords.includes(kw)?form.keywords.filter(x=>x!==kw):[...form.keywords,kw]);
  const handleSave=()=>{
    if(!form.name.trim()){alert("カード名を入力してください");return;}
    const inferred=inferAutoEffect(form.keywords,form.effect);
    onSave({...form,id:card?.id||mkCardId(),autoEffect:form.autoEffect??inferred,cost:Number(form.cost),power:Number(form.power)});
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a18",border:"1px solid #ffe06644",borderRadius:14,padding:20,maxWidth:440,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontFamily:"'Cinzel',serif",color:"#ffe066",fontSize:16,fontWeight:700,marginBottom:16}}>{isNew?"➕ カード追加":"✏️ カード編集"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <label style={{fontSize:11,color:"#888"}}>カード名 *
            <input value={form.name} onChange={e=>set("name",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}/>
          </label>
          <div style={{display:"flex",gap:8}}>
            <label style={{fontSize:11,color:"#888",flex:1}}>コスト
              <input type="number" min={0} max={20} value={form.cost} onChange={e=>set("cost",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}/>
            </label>
            <label style={{fontSize:11,color:"#888",flex:1}}>種類
              <select value={form.type} onChange={e=>set("type",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}>
                <option value="creature">クリーチャー</option>
                <option value="spell">呪文</option>
              </select>
            </label>
          </div>
          {form.type==="creature"&&(
            <label style={{fontSize:11,color:"#888"}}>パワー
              <input type="number" min={0} step={1000} value={form.power} onChange={e=>set("power",e.target.value)} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:13}}/>
            </label>
          )}
          <label style={{fontSize:11,color:"#888"}}>文明
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              {CIVS.map(civ=>{const c=CIV[civ];return(
                <button key={civ} onClick={()=>set("civ",civ)} style={{padding:"5px 10px",borderRadius:5,border:`2px solid ${form.civ===civ?c.color:"#333"}`,background:form.civ===civ?`${c.color}22`:"#0a0a14",color:form.civ===civ?c.textColor:"#555",cursor:"pointer",fontSize:11,fontWeight:700}}>{c.icon} {c.label}</button>
              );})}
            </div>
          </label>
          <label style={{fontSize:11,color:"#888"}}>キーワード能力
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
              {ALL_KEYWORDS.map(kw=><button key={kw} onClick={()=>toggleKw(kw)} style={{padding:"4px 8px",borderRadius:4,border:`1px solid ${form.keywords.includes(kw)?"#ffe066":"#333"}`,background:form.keywords.includes(kw)?"rgba(255,224,102,0.15)":"#111",color:form.keywords.includes(kw)?"#ffe066":"#555",cursor:"pointer",fontSize:10}}>{KEYWORD_LABELS[kw]||kw}</button>)}
            </div>
          </label>
          <label style={{fontSize:11,color:"#888"}}>効果テキスト
            <textarea value={form.effect} onChange={e=>set("effect",e.target.value)} rows={3} style={{display:"block",width:"100%",marginTop:4,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"7px 10px",fontSize:12,resize:"vertical"}}/>
          </label>
          <div style={{fontSize:10,color:"#555",padding:"6px 8px",background:"#080818",borderRadius:5,border:"1px solid #1a1a2a"}}>
            💡 効果テキストからautoEffectを自動推論します。複雑な効果は例外処理で対応してください。
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={handleSave} style={{flex:1,padding:"10px",borderRadius:7,fontWeight:700,fontSize:13,background:"linear-gradient(135deg,#ffe066,#ff9900)",border:"none",color:"#000",cursor:"pointer"}}>保存</button>
          <button onClick={onCancel} style={{padding:"10px 16px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

// ===========================
// DECK SHEET OCR
// ===========================
function DeckSheetReader({cardDb,onResult,onCancel}){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [parsed,setParsed]=useState(null); // [{name,matched:card|null}]
  const fileRef=useRef();

  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    setLoading(true);setError("");setParsed(null);
    try{
      const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:b64}},
            {type:"text",text:`このデュエル・マスターズのデッキシート画像から、デッキリストのカード名を全て読み取ってください。
番号付きリストになっています。カード名だけを抽出して、JSON配列で返してください。
形式: ["カード名1","カード名2",...] 
JSONのみ返してください。前後の説明は不要です。`}
          ]}]
        })
      });
      const data=await resp.json();
      const text=data.content?.find(b=>b.type==="text")?.text||"";
      const clean=text.replace(/```json|```/g,"").trim();
      const names=JSON.parse(clean);
      const result=names.map(name=>({
        name,
        matched:cardDb.find(c=>c.name===name||c.name.includes(name)||name.includes(c.name))||null
      }));
      setParsed(result);
    }catch(err){
      setError(`読み取りエラー: ${err.message}`);
    }finally{setLoading(false);}
  };

  const unmatchedNames=[...new Set(parsed?.filter(r=>!r.matched).map(r=>r.name)||[])];
  const deckIds=parsed?.map(r=>r.matched?.id).filter(Boolean)||[];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a18",border:"1px solid #4af44",borderRadius:14,padding:20,maxWidth:500,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontFamily:"'Cinzel',serif",color:"#4af",fontSize:16,fontWeight:700,marginBottom:4}}>📷 デッキシート読み取り</div>
        <div style={{fontSize:11,color:"#555",marginBottom:16}}>公式デッキシートの画像をアップロードしてください</div>

        {!parsed&&(
          <div style={{marginBottom:16}}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
            <button onClick={()=>fileRef.current?.click()} disabled={loading} style={{width:"100%",padding:"16px",borderRadius:10,border:"2px dashed #333",background:"#080818",color:loading?"#444":"#888",cursor:loading?"not-allowed":"pointer",fontSize:13}}>
              {loading?"🔍 読み取り中...":"📁 画像を選択（タップでカメラ/ファイル）"}
            </button>
            {error&&<div style={{color:"#f84",fontSize:11,marginTop:8}}>{error}</div>}
          </div>
        )}

        {parsed&&(
          <div>
            <div style={{fontSize:12,color:"#8f8",marginBottom:8}}>✅ {parsed.length}枚読み取り完了（マッチ:{deckIds.length}枚）</div>
            <div style={{maxHeight:240,overflowY:"auto",marginBottom:12,border:"1px solid #1a1a2a",borderRadius:8}}>
              {parsed.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",borderBottom:"1px solid #0a0a18",background:r.matched?"transparent":"rgba(255,80,80,0.05)"}}>
                  <span style={{fontSize:10,color:"#444",width:20}}>{i+1}</span>
                  <span style={{fontSize:12,color:r.matched?"#fff":"#f84",flex:1}}>{r.name}</span>
                  {r.matched?<span style={{fontSize:10,color:"#4f8"}}>✓ マッチ</span>:<span style={{fontSize:10,color:"#f84"}}>未登録</span>}
                </div>
              ))}
            </div>
            {unmatchedNames.length>0&&(
              <div style={{background:"rgba(255,80,80,0.08)",border:"1px solid #f8444433",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
                <div style={{fontSize:11,color:"#f84",fontWeight:700,marginBottom:6}}>⚠ 未登録カード ({unmatchedNames.length}種) — デッキには含まれません</div>
                {unmatchedNames.map(n=><div key={n} style={{fontSize:11,color:"#f88",marginBottom:2}}>・{n}</div>)}
                <div style={{fontSize:10,color:"#555",marginTop:6}}>カード管理から追加後、再度読み込んでください</div>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>onResult(deckIds,parsed)} disabled={deckIds.length===0} style={{flex:1,padding:"10px",borderRadius:7,fontWeight:700,fontSize:13,background:deckIds.length>0?"linear-gradient(135deg,#4af,#08f)":"#111",border:"none",color:deckIds.length>0?"#000":"#444",cursor:deckIds.length>0?"pointer":"not-allowed"}}>
                デッキ編集画面へ ({deckIds.length}枚)
              </button>
              <button onClick={()=>setParsed(null)} style={{padding:"10px 14px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>再読み込み</button>
              <button onClick={onCancel} style={{padding:"10px 14px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>閉じる</button>
            </div>
          </div>
        )}
        {!parsed&&<button onClick={onCancel} style={{width:"100%",padding:"8px",borderRadius:7,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12,marginTop:8}}>キャンセル</button>}
      </div>
    </div>
  );
}

// ===========================
// DECK EDITOR
// ===========================
function DeckEditor({cardDb,initialIds,initialName,onSave,onCancel}){
  const [name,setName]=useState(initialName||"新しいデッキ");
  const [counts,setCounts]=useState(()=>{
    const c={};(initialIds||[]).forEach(id=>{c[id]=(c[id]||0)+1;});return c;
  });
  const [search,setSearch]=useState("");
  const [civFilter,setCivFilter]=useState("all");
  const [typeFilter,setTypeFilter]=useState("all");
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const add=id=>{if((counts[id]||0)>=4||total>=40)return;setCounts(c=>({...c,[id]:(c[id]||0)+1}));};
  const remove=id=>{if((counts[id]||0)===0)return;setCounts(c=>({...c,[id]:c[id]-1}));};
  const deckIds=[];Object.entries(counts).forEach(([id,cnt])=>{for(let i=0;i<cnt;i++)deckIds.push(Number(id));});
  const filtered=cardDb.filter(c=>{
    if(search&&!c.name.includes(search))return false;
    if(civFilter!=="all"&&c.civ!==civFilter)return false;
    if(typeFilter!=="all"&&c.type!==typeFilter)return false;
    return true;
  });
  return(
    <div style={{position:"fixed",inset:0,background:"#050510",zIndex:600,display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}`}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(90deg,#08001a,#100520)",borderBottom:"1px solid #2a1a4a",padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:15,color:"#ffe066"}}>📋 デッキ編集</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="デッキ名" style={{flex:1,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"5px 10px",fontSize:13}}/>
        <div style={{fontSize:13,color:total===40?"#4f8":"#f84",fontWeight:700,whiteSpace:"nowrap"}}>{total}/40</div>
      </div>
      {/* Filters */}
      <div style={{padding:"8px 12px",display:"flex",gap:6,flexWrap:"wrap",borderBottom:"1px solid #141428",background:"#060614"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 カード名検索" style={{flex:1,minWidth:120,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 8px",fontSize:12}}/>
        <select value={civFilter} onChange={e=>setCivFilter(e.target.value)} style={{background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 6px",fontSize:11}}>
          <option value="all">全文明</option>
          {CIVS.map(c=><option key={c} value={c}>{CIV[c].icon} {CIV[c].label}</option>)}
        </select>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 6px",fontSize:11}}>
          <option value="all">全種類</option>
          <option value="creature">クリーチャー</option>
          <option value="spell">呪文</option>
        </select>
      </div>
      {/* Card list */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:5}}>
        {filtered.map(card=>{
          const cnt=counts[card.id]||0;const c=CIV[card.civ];
          return(
            <div key={card.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:`1px solid ${cnt>0?c.color+"44":"#1a1a2a"}`}}>
              <span style={{fontSize:15}}>{c.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{card.name}</div>
                <div style={{fontSize:10,color:"#555"}}>コスト:{card.cost} {card.type==="creature"?`/ P:${card.power}`:"/ 呪文"}{card.keywords?.includes("sTrigger")&&<span style={{color:"#ff8",marginLeft:4}}>ST</span>}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <button onClick={()=>remove(card.id)} style={{width:26,height:26,borderRadius:4,background:"#1a0a0a",border:"1px solid #f8444444",color:"#f84",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                <span style={{fontSize:14,fontWeight:700,color:cnt>0?"#fff":"#333",width:16,textAlign:"center"}}>{cnt}</span>
                <button onClick={()=>add(card.id)} disabled={cnt>=4||total>=40} style={{width:26,height:26,borderRadius:4,background:cnt<4&&total<40?"#0a1a0a":"#0a0a0a",border:`1px solid ${cnt<4&&total<40?"#4f8":"#222"}`,color:cnt<4&&total<40?"#4f8":"#333",cursor:cnt<4&&total<40?"pointer":"not-allowed",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>＋</button>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{color:"#333",fontSize:12,textAlign:"center",padding:20}}>該当カードなし</div>}
      </div>
      {/* Footer */}
      <div style={{padding:"10px 12px",borderTop:"1px solid #141428",background:"#060614",display:"flex",gap:8}}>
        <button onClick={()=>onSave({name,ids:deckIds})} disabled={total!==40} style={{flex:1,padding:"11px",borderRadius:8,fontWeight:700,fontSize:14,background:total===40?"linear-gradient(135deg,#ffe066,#ff9900)":"#1a1a1a",border:"none",color:total===40?"#000":"#444",cursor:total===40?"pointer":"not-allowed"}}>保存 ({total}/40)</button>
        <button onClick={onCancel} style={{padding:"11px 18px",borderRadius:8,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:13}}>キャンセル</button>
      </div>
    </div>
  );
}

// ===========================
// CARD MANAGER
// ===========================
function CardManager({cardDb,setCardDb,onClose}){
  const [search,setSearch]=useState("");
  const [civFilter,setCivFilter]=useState("all");
  const [editing,setEditing]=useState(null); // card or "new"
  const [confirmDelete,setConfirmDelete]=useState(null);

  const filtered=cardDb.filter(c=>{
    if(search&&!c.name.includes(search))return false;
    if(civFilter!=="all"&&c.civ!==civFilter)return false;
    return true;
  });

  const handleSave=card=>{
    setCardDb(db=>db.find(c=>c.id===card.id)?db.map(c=>c.id===card.id?card:c):[...db,card]);
    setEditing(null);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#050510",zIndex:600,display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}`}</style>
      {editing&&<CardEditor card={editing==="new"?null:editing} onSave={handleSave} onCancel={()=>setEditing(null)}/>}
      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#0a0a18",border:"1px solid #f8444455",borderRadius:12,padding:20,maxWidth:320,width:"100%"}}>
            <div style={{color:"#f84",fontWeight:700,fontSize:14,marginBottom:8}}>🗑 削除確認</div>
            <div style={{color:"#aaa",fontSize:12,marginBottom:16}}>「{confirmDelete.name}」を削除しますか？</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setCardDb(db=>db.filter(c=>c.id!==confirmDelete.id));setConfirmDelete(null);}} style={{flex:1,padding:"8px",borderRadius:6,background:"#3a0a0a",border:"1px solid #f84",color:"#f84",cursor:"pointer",fontSize:13,fontWeight:700}}>削除する</button>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"8px",borderRadius:6,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:13}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      <div style={{background:"linear-gradient(90deg,#08001a,#100520)",borderBottom:"1px solid #2a1a4a",padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:15,color:"#ffe066",flex:1}}>🗂 カード管理 ({cardDb.length}種)</div>
        <button onClick={()=>setEditing("new")} style={{padding:"6px 14px",borderRadius:6,background:"rgba(68,255,136,0.15)",border:"1px solid #4f844",color:"#4f8",cursor:"pointer",fontSize:12,fontWeight:700}}>➕ 追加</button>
        <button onClick={onClose} style={{padding:"6px 12px",borderRadius:6,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>← 戻る</button>
      </div>
      <div style={{padding:"8px 12px",display:"flex",gap:6,flexWrap:"wrap",borderBottom:"1px solid #141428",background:"#060614"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 カード名検索" style={{flex:1,minWidth:120,background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 8px",fontSize:12}}/>
        <select value={civFilter} onChange={e=>setCivFilter(e.target.value)} style={{background:"#111",border:"1px solid #333",color:"#fff",borderRadius:5,padding:"4px 6px",fontSize:11}}>
          <option value="all">全文明</option>
          {CIVS.map(c=><option key={c} value={c}>{CIV[c].icon} {CIV[c].label}</option>)}
        </select>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:5}}>
        {filtered.map(card=>{const c=CIV[card.civ];return(
          <div key={card.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid #1a1a2a"}}>
            <span style={{fontSize:15}}>{c.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>{card.name}</div>
              <div style={{fontSize:10,color:"#555"}}>コスト:{card.cost} {card.type==="creature"?`/ P:${card.power}`:"/ 呪文"} {card.keywords?.map(k=><span key={k} style={{color:c.textColor,marginRight:3}}>{KEYWORD_LABELS[k]||k}</span>)}</div>
            </div>
            <button onClick={()=>setEditing(card)} style={{padding:"4px 10px",borderRadius:4,background:"rgba(255,224,102,0.1)",border:"1px solid #ffe06644",color:"#ffe066",cursor:"pointer",fontSize:11}}>編集</button>
            <button onClick={()=>setConfirmDelete(card)} style={{padding:"4px 10px",borderRadius:4,background:"rgba(255,80,80,0.1)",border:"1px solid #f8444444",color:"#f84",cursor:"pointer",fontSize:11}}>削除</button>
          </div>
        );})}
        {filtered.length===0&&<div style={{color:"#333",fontSize:12,textAlign:"center",padding:20}}>該当なし</div>}
      </div>
    </div>
  );
}

// ===========================
// MENU SCREEN
// ===========================
function MenuScreen({cardDb,setCardDb,decks,setDecks,p1DeckIdx,setP1DeckIdx,p2DeckIdx,setP2DeckIdx,onStartGame}){
  const [screen,setScreen]=useState("main"); // main|deckList|deckEdit|cardManager|deckSheet
  const [editingDeckIdx,setEditingDeckIdx]=useState(null);
  const [sheetIds,setSheetIds]=useState(null);
  const [confirmDeleteDeck,setConfirmDeleteDeck]=useState(null);

  const openNewDeck=()=>{setEditingDeckIdx(null);setScreen("deckEdit");};
  const openEditDeck=idx=>{setEditingDeckIdx(idx);setScreen("deckEdit");};
  const saveDeck=({name,ids})=>{
    if(editingDeckIdx===null){setDecks(d=>[...d,{name,ids}]);}
    else{setDecks(d=>d.map((dk,i)=>i===editingDeckIdx?{name,ids}:dk));}
    setScreen("deckList");
  };

  if(screen==="cardManager") return <CardManager cardDb={cardDb} setCardDb={setCardDb} onClose={()=>setScreen("main")}/>;
  if(screen==="deckSheet") return <DeckSheetReader cardDb={cardDb} onResult={(ids,parsed)=>{setSheetIds(ids);setScreen("deckEdit");}} onCancel={()=>setScreen("deckList")}/>;
  if(screen==="deckEdit") return <DeckEditor cardDb={cardDb} initialIds={editingDeckIdx!==null?decks[editingDeckIdx]?.ids:sheetIds||[]} initialName={editingDeckIdx!==null?decks[editingDeckIdx]?.name:""} onSave={saveDeck} onCancel={()=>{setSheetIds(null);setScreen("deckList");}}/>;

  const canStart=decks.length>0&&p1DeckIdx!==null&&p2DeckIdx!==null;

  return(
    <div style={{minHeight:"100vh",background:"#04040e",fontFamily:"'Noto Sans JP','Segoe UI',sans-serif",color:"#fff",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}`}</style>

      {confirmDeleteDeck!==null&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#0a0a18",border:"1px solid #f8444455",borderRadius:12,padding:20,maxWidth:320,width:"100%"}}>
            <div style={{color:"#f84",fontWeight:700,fontSize:14,marginBottom:8}}>🗑 デッキ削除</div>
            <div style={{color:"#aaa",fontSize:12,marginBottom:16}}>「{decks[confirmDeleteDeck]?.name}」を削除しますか？</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setDecks(d=>d.filter((_,i)=>i!==confirmDeleteDeck));if(p1DeckIdx===confirmDeleteDeck)setP1DeckIdx(null);if(p2DeckIdx===confirmDeleteDeck)setP2DeckIdx(null);setConfirmDeleteDeck(null);}} style={{flex:1,padding:"8px",borderRadius:6,background:"#3a0a0a",border:"1px solid #f84",color:"#f84",cursor:"pointer",fontWeight:700}}>削除</button>
              <button onClick={()=>setConfirmDeleteDeck(null)} style={{flex:1,padding:"8px",borderRadius:6,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div style={{textAlign:"center",padding:"40px 20px 20px",background:"radial-gradient(ellipse at 50% 0%,#1a003a,transparent 70%)"}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:36,fontWeight:900,color:"#ffe066",textShadow:"0 0 30px #ffe066aa,0 0 60px #ff990044",letterSpacing:4,marginBottom:8}}>⚔ DUEL MASTERS</div>
        <div style={{fontSize:12,color:"#444",letterSpacing:2}}>CARD GAME SIMULATOR</div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 14px",display:"flex",flexDirection:"column",gap:16,maxWidth:480,margin:"0 auto",width:"100%"}}>

        {/* Deck select */}
        {screen==="main"&&(
          <>
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid #1a1a3a",borderRadius:12,padding:14}}>
              <div style={{fontFamily:"'Cinzel',serif",color:"#ffe066",fontSize:14,fontWeight:700,marginBottom:12}}>🃏 デッキ選択</div>
              {["p1","p2"].map(pid=>{
                const idx=pid==="p1"?p1DeckIdx:p2DeckIdx;
                const setIdx=pid==="p1"?setP1DeckIdx:setP2DeckIdx;
                const color=pid==="p1"?"#4af":"#f84";
                return(
                  <div key={pid} style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:color,fontWeight:700,marginBottom:6}}>{pid==="p1"?"🧑 P1":"👹 P2"}</div>
                    {decks.length===0?(
                      <div style={{fontSize:11,color:"#333",padding:"8px 12px",background:"#080818",borderRadius:6,border:"1px solid #1a1a2a"}}>デッキがありません。先にデッキを作成してください。</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {decks.map((dk,i)=>(
                          <button key={i} onClick={()=>setIdx(i)} style={{padding:"8px 12px",borderRadius:6,textAlign:"left",background:idx===i?`${color}18`:"#080818",border:`1px solid ${idx===i?color:"#1a1a2a"}`,color:idx===i?color:"#666",cursor:"pointer",fontSize:12,fontWeight:idx===i?700:400,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>{dk.name}</span>
                            <span style={{fontSize:10,color:"#444"}}>{dk.ids.length}枚</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Start button */}
            <button onClick={()=>canStart&&onStartGame(decks[p1DeckIdx].ids,decks[p2DeckIdx].ids)} style={{width:"100%",padding:"16px",borderRadius:12,fontFamily:"'Cinzel',serif",fontSize:20,fontWeight:900,background:canStart?"linear-gradient(135deg,#ffe066,#ff9900)":"#1a1a1a",border:"none",color:canStart?"#000":"#333",cursor:canStart?"pointer":"not-allowed",boxShadow:canStart?"0 0 24px #ffe06666":"none",transition:"all 0.2s"}}>
              {canStart?"▶ ゲーム開始":"デッキを選択してください"}
            </button>

            {/* Menu buttons */}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={()=>setScreen("deckList")} style={menuBtn("#ffe066")}>📋 デッキ管理</button>
              <button onClick={()=>setScreen("cardManager")} style={menuBtn("#4af")}>🗂 カード管理</button>
            </div>
          </>
        )}

        {/* Deck list */}
        {screen==="deckList"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontFamily:"'Cinzel',serif",color:"#ffe066",fontSize:14,fontWeight:700}}>📋 デッキ一覧</div>
              <button onClick={()=>setScreen("main")} style={{padding:"4px 12px",borderRadius:5,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>← 戻る</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button onClick={openNewDeck} style={{flex:1,padding:"10px",borderRadius:8,background:"rgba(68,255,136,0.12)",border:"1px solid #4f844",color:"#4f8",cursor:"pointer",fontSize:13,fontWeight:700}}>➕ 新規デッキ作成</button>
              <button onClick={()=>setScreen("deckSheet")} style={{flex:1,padding:"10px",borderRadius:8,background:"rgba(68,170,255,0.12)",border:"1px solid #4af44",color:"#4af",cursor:"pointer",fontSize:13,fontWeight:700}}>📷 シート読み取り</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {decks.map((dk,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:"1px solid #1a1a2a"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{dk.name}</div>
                    <div style={{fontSize:10,color:"#555"}}>{dk.ids.length}枚</div>
                  </div>
                  <button onClick={()=>openEditDeck(i)} style={{padding:"5px 10px",borderRadius:5,background:"rgba(255,224,102,0.1)",border:"1px solid #ffe06644",color:"#ffe066",cursor:"pointer",fontSize:11}}>編集</button>
                  <button onClick={()=>setConfirmDeleteDeck(i)} style={{padding:"5px 10px",borderRadius:5,background:"rgba(255,80,80,0.1)",border:"1px solid #f8444444",color:"#f84",cursor:"pointer",fontSize:11}}>削除</button>
                </div>
              ))}
              {decks.length===0&&<div style={{color:"#333",fontSize:12,textAlign:"center",padding:24}}>デッキがありません</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function menuBtn(col){
  return{width:"100%",padding:"13px",borderRadius:10,background:`${col}11`,border:`1px solid ${col}33`,color:col,cursor:"pointer",fontSize:14,fontWeight:700,textAlign:"left"};
}

// ===========================
// BATTLE SCREEN
// ===========================
function BattleScreen({p1DeckIds,p2DeckIds,cardDb,onBackToMenu}){
  const [p1,setP1]=useState(()=>initPlayerState(p1DeckIds,cardDb));
  const [p2,setP2]=useState(()=>initPlayerState(p2DeckIds,cardDb));
  const [active,setActive]=useState("p1");
  const [drewThisTurn,setDrewThisTurn]=useState(false);
  const [chargedThisTurn,setChargedThisTurn]=useState(false);
  const [attackingUid,setAttackingUid]=useState(null);
  const [logs,setLogs]=useState(["ゲーム開始！P1のターンです。"]);
  const [message,setMessage]=useState("P1: カードをドローしてください");
  const [winner,setWinner]=useState(null);
  const [handoff,setHandoff]=useState(null);
  const [turn,setTurn]=useState(1);
  const [effectModal,setEffectModal]=useState(null);
  const [cutin,setCutin]=useState(null);

  const addLog=useCallback(msg=>setLogs(p=>[...p,msg]),[]);
  const showCutIn=useCallback(data=>setCutin(data),[]);
  const openEffectModal=useCallback(m=>setEffectModal(m),[]);

  const otherPid=active==="p1"?"p2":"p1";
  const activeState=active==="p1"?p1:p2;
  const otherState=active==="p1"?p2:p1;
  const setActiveState=active==="p1"?setP1:setP2;
  const setOtherState=active==="p1"?setP2:setP1;

  const triggerEffect=(effect,ownerPid,selfSnap,setSelf,otherSnap,setOther,sourceName)=>{
    if(!effect) return;
    const srcCard=cardDb.find(c=>c.name===sourceName);
    showCutIn({title:"効果発動！",cardName:sourceName,civ:srcCard?.civ||"fire",icon:CIV[srcCard?.civ||"fire"]?.icon});
    setTimeout(()=>processEffect(effect,ownerPid,selfSnap,setSelf,otherSnap,setOther,addLog,openEffectModal),400);
  };

  const handleDraw=()=>{
    if(drewThisTurn)return;
    if(activeState.deck.length===0){setWinner(otherPid==="p1"?"P1":"P2");return;}
    const[card,...rest]=activeState.deck;
    setActiveState(s=>({...s,hand:[...s.hand,card],deck:rest}));
    setDrewThisTurn(true);addLog(`${active}: ${card.name} ドロー`);setMessage(`${active}: マナチャージorプレイ`);
  };
  const handleChargeMana=idx=>{if(chargedThisTurn)return;const card=activeState.hand[idx];setActiveState(s=>({...s,hand:s.hand.filter((_,i)=>i!==idx),mana:[...s.mana,{...card,tapped:false}]}));setChargedThisTurn(true);addLog(`${active}: ${card.name}→マナ`);};
  const handlePlayCard=idx=>{
    const card=activeState.hand[idx];
    const check=canPayCost(activeState.mana,card);
    if(!check.ok){setMessage(`✗ ${check.reason}`);return false;}
    const newMana=tapManaForCost(activeState.mana,card);
    const newHand=activeState.hand.filter((_,i)=>i!==idx);
    if(card.type==="creature"){
      const isSpeed=card.keywords?.includes("speedAttacker");
      const newBattle=[...activeState.battle,{...card,tapped:false,summonedThisTurn:!isSpeed}];
      setActiveState(s=>({...s,hand:newHand,mana:newMana,battle:newBattle}));
      addLog(`${active}: ${card.name}(${card.power}) 召喚！`);
      showCutIn({title:"召喚！",cardName:card.name,civ:card.civ,icon:CIV[card.civ]?.icon});
      if(card.autoEffect) setTimeout(()=>triggerEffect(card.autoEffect,active,{...activeState,hand:newHand,mana:newMana,battle:newBattle},setActiveState,otherState,setOtherState,card.name),600);
    }else{
      setActiveState(s=>({...s,hand:newHand,mana:newMana,grave:[...s.grave,card]}));
      addLog(`${active}: 呪文「${card.name}」`);
      showCutIn({title:"呪文！",cardName:card.name,civ:card.civ,icon:"📜"});
      if(card.autoEffect) setTimeout(()=>triggerEffect(card.autoEffect,active,{...activeState,hand:newHand,mana:newMana},setActiveState,otherState,setOtherState,card.name),600);
    }
    return true;
  };
  const handleStartAttack=uid=>{setAttackingUid(uid);const card=activeState.battle.find(c=>c.uid===uid);addLog(`${active}: ${card?.name} 攻撃宣言`);setMessage("攻撃対象を選択");};
  const handleAttackCreature=targetUid=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    const target=otherState.battle.find(c=>c.uid===targetUid);
    if(!attacker||!target)return;
    setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attackingUid?{...c,tapped:true}:c)}));
    addLog(`⚔ ${attacker.name}(${attacker.power}) vs ${target.name}(${target.power})`);
    const aWin=attacker.power>=target.power;const dWin=target.power>=attacker.power;
    if(aWin){setOtherState(s=>({...s,battle:s.battle.filter(c=>c.uid!==targetUid),grave:[...s.grave,target]}));addLog(`✅ ${target.name} 破壊`);}
    if(dWin){setActiveState(s=>({...s,battle:s.battle.filter(c=>c.uid!==attackingUid),grave:[...s.grave,attacker]}));addLog(`💔 ${attacker.name} 破壊`);}
    setAttackingUid(null);
  };
  const handleAttackShield=shieldIdx=>{
    const attacker=activeState.battle.find(c=>c.uid===attackingUid);
    if(!attacker)return;
    const breakCount=attacker.keywords?.includes("tBreaker")?3:attacker.keywords?.includes("wBreaker")?2:1;
    setActiveState(s=>({...s,battle:s.battle.map(c=>c.uid===attackingUid?{...c,tapped:true}:c)}));
    let shields=[...otherState.shields];const broken=[];
    for(let i=0;i<breakCount;i++){if(shields.length===0)break;broken.push(shields[0]);shields=shields.slice(1);}
    const isBolmetheus=attacker.name.includes("ボルメテウス");
    const sTriggers=broken.filter(c=>c.keywords?.includes("sTrigger"));
    const normal=broken.filter(c=>!c.keywords?.includes("sTrigger"));
    if(isBolmetheus){setOtherState(s=>({...s,shields,grave:[...s.grave,...broken]}));addLog(`☠ ボルメテウス効果`);}
    else{
      setOtherState(s=>({...s,shields,hand:[...s.hand,...normal,...sTriggers]}));
      sTriggers.forEach(c=>{addLog(`🛡 S・トリガー「${c.name}」`);showCutIn({title:"S・トリガー発動！",cardName:c.name,civ:c.civ,icon:"🛡"});if(c.autoEffect)setTimeout(()=>triggerEffect(c.autoEffect,otherPid,otherState,setOtherState,activeState,setActiveState,c.name),800);});
    }
    addLog(`🔥 ${attacker.name} ${broken.length}枚ブレイク(残${shields.length})`);
    if(shields.length===0)setMessage("シールド全滅！ダイレクトアタック可能");
    setAttackingUid(null);
  };
  const handleEndTurn=()=>{
    setActiveState(s=>({...s,battle:s.battle.map(c=>({...c,tapped:false,summonedThisTurn:false})),mana:s.mana.map(c=>({...c,tapped:false}))}));
    setAttackingUid(null);const next=otherPid;const newTurn=active==="p2"?turn+1:turn;
    addLog(`--- ${next.toUpperCase()} のターン (T${newTurn}) ---`);
    setHandoff({from:active.toUpperCase(),to:next.toUpperCase()});
    setActive(next);setTurn(newTurn);setDrewThisTurn(false);setChargedThisTurn(false);
  };

  return(
    <div style={{minHeight:"100vh",background:"#04040e",fontFamily:"'Noto Sans JP','Segoe UI',sans-serif",color:"#fff",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');*{box-sizing:border-box;}::-webkit-scrollbar{width:4px;background:#111;}::-webkit-scrollbar-thumb{background:#333;border-radius:4px;}`}</style>
      {cutin&&<CutIn cutin={cutin} onDone={()=>setCutin(null)}/>}
      {winner&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:700}}>
          <div style={{fontSize:72}}>🏆</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:48,fontWeight:900,color:"#ffe066",textShadow:"0 0 30px #ffe066",marginTop:12}}>{winner} WIN!</div>
          <div style={{display:"flex",gap:12,marginTop:32}}>
            <button onClick={()=>{setP1(initPlayerState(p1DeckIds,cardDb));setP2(initPlayerState(p2DeckIds,cardDb));setActive("p1");setDrewThisTurn(false);setChargedThisTurn(false);setAttackingUid(null);setWinner(null);setHandoff(null);setTurn(1);setEffectModal(null);setCutin(null);setLogs(["ゲーム開始！"]);setMessage("P1: ドローしてください");}} style={{padding:"14px 32px",borderRadius:8,background:"linear-gradient(135deg,#ffe066,#ff9900)",border:"none",color:"#000",fontWeight:900,fontSize:16,cursor:"pointer"}}>再戦</button>
            <button onClick={onBackToMenu} style={{padding:"14px 32px",borderRadius:8,background:"#111",border:"1px solid #333",color:"#888",fontWeight:700,fontSize:16,cursor:"pointer"}}>メニューへ</button>
          </div>
        </div>
      )}
      {handoff&&<HandoffScreen from={handoff.from} to={handoff.to} onReady={()=>{setHandoff(null);setMessage(`${active.toUpperCase()}: ドローしてください`);}}/>}
      {effectModal&&<EffectModal modal={effectModal} p1State={p1} setP1={setP1} p2State={p2} setP2={setP2} onClose={()=>setEffectModal(null)} addLog={addLog}/>}
      <div style={{background:"linear-gradient(90deg,#08001a,#100520,#08001a)",borderBottom:"1px solid #2a1a4a",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:15,fontWeight:900,color:"#ffe066",textShadow:"0 0 10px #ffe066"}}>⚔ DUEL MASTERS</div>
        <div style={{fontSize:11,color:"#555"}}>T{turn} ｜ <span style={{color:active==="p1"?"#4af":"#f84"}}>{active.toUpperCase()} のターン</span></div>
        <button onClick={onBackToMenu} style={{padding:"3px 10px",borderRadius:4,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:11}}>← メニュー</button>
      </div>
      <div style={{background:"rgba(20,20,50,0.6)",borderBottom:"1px solid #141428",padding:"5px 14px",fontSize:11,color:"#9ae"}}>💬 {message}</div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 10px",display:"flex",flexDirection:"column",gap:8}}>
        <PlayerBoard pid="p2" state={p2} setState={setP2} otherState={p1} setOtherState={setP1} isActive={active==="p2"} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog}/>
        <Log entries={logs}/>
        <PlayerBoard pid="p1" state={p1} setState={setP1} otherState={p2} setOtherState={setP2} isActive={active==="p1"} attackingUid={attackingUid} onDraw={handleDraw} onChargeMana={handleChargeMana} onPlayCard={handlePlayCard} onStartAttack={handleStartAttack} onEndTurn={handleEndTurn} onAttackCreature={handleAttackCreature} onAttackShield={handleAttackShield} drewThisTurn={drewThisTurn} chargedThisTurn={chargedThisTurn} addLog={addLog}/>
      </div>
    </div>
  );
}

// ===========================
// ROOT
// ===========================
export default function App(){
  const [cardDb,setCardDb]=useState(INITIAL_CARD_DB);
  const [decks,setDecks]=useState([
    {name:"サンプルデッキA",ids:defaultDeckIds(INITIAL_CARD_DB)},
    {name:"サンプルデッキB",ids:defaultDeckIds(INITIAL_CARD_DB)},
  ]);
  const [p1DeckIdx,setP1DeckIdx]=useState(0);
  const [p2DeckIdx,setP2DeckIdx]=useState(1);
  const [gameState,setGameState]=useState(null); // null=menu, {p1Ids,p2Ids}=battle

  if(gameState){
    return <BattleScreen p1DeckIds={gameState.p1Ids} p2DeckIds={gameState.p2Ids} cardDb={cardDb} onBackToMenu={()=>setGameState(null)}/>;
  }
  return(
    <MenuScreen
      cardDb={cardDb} setCardDb={setCardDb}
      decks={decks} setDecks={setDecks}
      p1DeckIdx={p1DeckIdx} setP1DeckIdx={setP1DeckIdx}
      p2DeckIdx={p2DeckIdx} setP2DeckIdx={setP2DeckIdx}
      onStartGame={(p1Ids,p2Ids)=>setGameState({p1Ids,p2Ids})}
    />
  );
}