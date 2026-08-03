import { CIV } from "../constants";
import { getCardCivs, makeCardBg, ssxKeywords } from "../gameLogic";

// ===========================
// CARD COMPONENTS
// ===========================
export function CardFace({card,selected,onClick,small,dimmed,grantedKeywords,inBattle}){
  const civs=getCardCivs(card);
  const c=CIV[civs[0]]||CIV.fire;
  const w=small?52:74;const h=small?72:106;
  // 超魂X(SSX)はそのカードの通常能力。下のカードの超魂Xもここに合流する
  const ownKw=[...(card.keywords||[]), ...ssxKeywords(card),
    // ツインパクトの呪文面が持つS・トリガーはシールドゾーンで機能するのでバッジに出す
    ...((card.spellSide?.keywords||[]).filter(k=>k==="sTrigger"))];
  const hyper=card.hyperMode;
  // フィールドは「バトルゾーンに」横向きで置かれる。タップではないので回転だけさせる。
  // 手札や一覧では普通の向きで見せたいので、バトルゾーンの描画だけ inBattle を渡す。
  const sideways=inBattle&&card.type==="field";
  const effPower=((hyper&&card.hyperPower!=null)?card.hyperPower:(card.power||0))+(card.tempBuff?.power||0);
  const hyperTBreaker=hyper&&card.hyperKeywords?.includes("tBreaker");
  const hyperWBreaker=hyper&&card.hyperKeywords?.includes("wBreaker");
  return(
    <div onClick={onClick} title={card.name} style={{width:w,height:h,borderRadius:7,flexShrink:0,border:`2px solid ${selected?"#ffe066":hyper?"#ffcc00":c.color}`,background:makeCardBg(civs),cursor:"pointer",position:"relative",transform:(card.tapped||sideways)?"rotate(90deg)":selected?"translateY(-8px) scale(1.07)":"none",opacity:dimmed?0.4:1,boxShadow:selected?`0 0 18px #ffe066`:hyper?`0 0 16px #ffcc00cc,0 0 32px #ff880066,inset 0 0 12px #ffcc0033`:`0 0 8px ${c.glow}33`,transition:"all 0.15s",display:"flex",flexDirection:"column",padding:"3px 4px",userSelect:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}>
        <span style={{background:c.color,color:"#fff",fontWeight:700,fontSize:small?8:10,borderRadius:3,padding:"0 3px",lineHeight:"15px"}}>{card.cost}</span>
        <div style={{display:"flex",gap:1}}>{civs.map(cv=>{const cv_=CIV[cv];return cv_?<span key={cv} style={{fontSize:small?6:8,fontWeight:900,color:cv_.textColor,background:`${cv_.color}44`,borderRadius:2,padding:"0 2px",lineHeight:"13px",fontFamily:"'Noto Sans JP',sans-serif"}}>{cv_.label}</span>:null;})}</div>
      </div>
      <div style={{color:"#fff",fontSize:small?6.5:8.5,fontWeight:700,lineHeight:1.2,textAlign:"center",flex:1,overflow:"hidden",wordBreak:"break-all",margin:"2px 0",textShadow:`0 0 5px ${c.glow}`}}>{card.name.length>13?card.name.slice(0,12)+"…":card.name}</div>
      {/* Race */}
      {card.race&&!small&&<div style={{color:c.color,fontSize:6.5,textAlign:"center",opacity:0.8,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",marginBottom:1}}>{card.race}</div>}
      {/* Power */}
      <div style={{color:c.color,fontSize:small?7:9,textAlign:"center",borderTop:`1px solid ${c.color}44`,paddingTop:2,fontWeight:700}}>{card.type==="creature"||card.type==="evo_creature"?`${effPower}`:card.type==="twinpact"?"TWIN":card.type==="tamaseed"?"タマシード":card.type==="field"?"フィールド":card.type==="castle"?"城":"SPELL"}</div>
      {card.type==="evo_creature"&&!small&&<div style={{position:"absolute",top:14,left:2,fontSize:6,color:"#adf",background:"rgba(0,0,80,0.7)",borderRadius:2,padding:"0 2px"}}>進化</div>}
      <div style={{position:"absolute",top:2,right:2,display:"flex",flexDirection:"column",gap:1}}>
        {ownKw.includes("speedAttacker")&&<span style={{fontSize:6,fontWeight:700,color:"#ff6644",letterSpacing:0}}>SA</span>}
        {!ownKw.includes("speedAttacker")&&grantedKeywords?.includes("speedAttacker")&&<span style={{fontSize:6,fontWeight:700,color:"#ffe066",textShadow:"0 0 4px #ffe066",letterSpacing:0}}>SA</span>}
        {ownKw.includes("blocker")&&<span style={{fontSize:6,fontWeight:700,color:"#8888ff",letterSpacing:0}}>BK</span>}
        {!ownKw.includes("blocker")&&grantedKeywords?.includes("blocker")&&<span style={{fontSize:6,fontWeight:700,color:"#ffe066",textShadow:"0 0 4px #ffe066",letterSpacing:0}}>BK</span>}
        {ownKw.includes("slayer")&&<span style={{fontSize:6,fontWeight:700,color:"#e066ff",letterSpacing:0}}>SL</span>}
        {!ownKw.includes("slayer")&&grantedKeywords?.includes("slayer")&&<span style={{fontSize:6,fontWeight:700,color:"#ffe066",textShadow:"0 0 4px #ffe066",letterSpacing:0}}>SL</span>}
        {ownKw.includes("guardman")&&<span style={{fontSize:6,fontWeight:700,color:"#66dd99",letterSpacing:0}}>GM</span>}
        {!ownKw.includes("guardman")&&grantedKeywords?.includes("guardman")&&<span style={{fontSize:6,fontWeight:700,color:"#ffe066",textShadow:"0 0 4px #ffe066",letterSpacing:0}}>GM</span>}
        {!ownKw.includes("escape")&&grantedKeywords?.includes("escape")&&<span style={{fontSize:6,fontWeight:700,color:"#ffe066",textShadow:"0 0 4px #ffe066",letterSpacing:0}}>ES</span>}
        {ownKw.includes("escape")&&<span style={{fontSize:6,fontWeight:700,color:"#66ddff",letterSpacing:0}}>ES</span>}
        {!(ownKw.includes("tBreaker")||hyperTBreaker)&&(ownKw.includes("wBreaker")||hyperWBreaker)&&<span style={{fontSize:7}}>✦✦</span>}
        {(ownKw.includes("tBreaker")||hyperTBreaker)&&<span style={{fontSize:7}}>✦✦✦</span>}
        {ownKw.includes("sTrigger")&&<span style={{fontSize:7,color:"#ff8"}}>ST</span>}
        {ownKw.includes("gStrike")&&<span style={{fontSize:7,color:"#f8f"}}>GS</span>}
        {ownKw.includes("zRush")&&<span style={{fontSize:7,color:"#fc0"}}>ZR</span>}
        {card.ssx&&<span style={{fontSize:6,fontWeight:900,color:"#c9f",textShadow:"0 0 4px #a0f"}}>SSX</span>}
      </div>
      {hyper&&<div style={{position:"absolute",top:0,left:0,right:0,textAlign:"center",fontSize:6,fontWeight:900,color:"#ffcc00",background:"rgba(0,0,0,0.75)",borderRadius:"5px 5px 0 0",letterSpacing:1,lineHeight:"12px"}}>HYPER</div>}
      {card.summonedThisTurn&&!ownKw.includes("speedAttacker")&&!grantedKeywords?.includes("speedAttacker")&&<div style={{position:"absolute",bottom:14,left:0,right:0,textAlign:"center",fontSize:7,color:"#888"}}>酔</div>}
      {card.evolutionBase?.length > 0 && <div style={{position:"absolute",bottom:2,right:2,fontSize:7,background:"rgba(0,0,0,0.75)",color:"#ffe066",borderRadius:3,padding:"1px 3px",fontWeight:700,letterSpacing:0}}>EVO×{card.evolutionBase.length + 1}</div>}
    </div>
  );
}

export function CardBack({small,tiny,onClick,label}){
  const w=tiny?32:small?52:74;
  const h=tiny?44:small?72:106;
  return(
    <div onClick={onClick} style={{width:w,height:h,borderRadius:7,border:"2px solid #2a2a4a",flexShrink:0,background:"linear-gradient(135deg,#080814,#111830,#080814)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",userSelect:"none",gap:3,position:"relative",overflow:"hidden",boxShadow:"inset 0 0 12px rgba(100,100,255,0.08)"}}>
      <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(255,255,255,0.015) 8px,rgba(255,255,255,0.015) 9px)"}}/>
      <div style={{fontFamily:"'Cinzel',serif",fontWeight:900,fontSize:tiny?7:small?9:11,color:"#2a2a5a",letterSpacing:2,textTransform:"uppercase",zIndex:1}}>DM</div>
      {label&&<span style={{fontSize:8,color:"#3a3a6a",zIndex:1}}>{label}</span>}
    </div>
  );
}
