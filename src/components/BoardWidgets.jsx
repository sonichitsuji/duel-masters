import { CIV } from "../constants";
import { getCardCivs } from "../gameLogic";

// ===========================
// MANA DISPLAY
// ===========================
export function ManaDisplay({mana}){
  const civCounts={};
  mana.forEach(c=>{
    const civKey=getCardCivs(c)[0];
    if(!civCounts[civKey])civCounts[civKey]={total:0,available:0};
    civCounts[civKey].total++;
    if(!c.tapped)civCounts[civKey].available++;
  });
  const available=mana.filter(c=>!c.tapped).length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#555"}}>マナ:</span>
        <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{available}</span>
        <span style={{fontSize:10,color:"#333"}}>/ {mana.length}</span>
        {Object.entries(civCounts).map(([civ,cnt])=>{const c=CIV[civ];if(!c)return null;return(
          <div key={civ} style={{display:"flex",alignItems:"center",gap:2,background:`${c.color}18`,border:`1px solid ${c.color}44`,borderRadius:4,padding:"1px 5px"}}>
            <span style={{fontSize:9,fontWeight:900,color:c.textColor,fontFamily:"'Noto Sans JP',sans-serif"}}>{c.label}</span>
            <span style={{fontSize:11,fontWeight:700,color:cnt.available>0?c.textColor:"#333"}}>{cnt.available}</span>
            {cnt.total>cnt.available&&<span style={{fontSize:9,color:"#333"}}>/{cnt.total}</span>}
          </div>
        );})}
      </div>
      <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
        {mana.map(c=>{const cv=CIV[getCardCivs(c)[0]];return(
          <div key={c.uid} title={c.name} style={{width:18,height:18,borderRadius:3,background:c.tapped?"#111":cv?.color,border:`1px solid ${c.tapped?"#222":cv?.color}`,opacity:c.tapped?0.3:1,transition:"all 0.2s",boxShadow:c.tapped?"none":`0 0 4px ${cv?.glow}66`}}/>
        );})}
      </div>
    </div>
  );
}

export function ShieldPile({shields,canClick,onBreak}){
  return(
    <div style={{display:"flex",gap:3}}>
      {[0,1,2,3,4].map(i=>{const exists=!!shields[i];return(
        <div key={i} onClick={()=>exists&&canClick&&onBreak(i)} style={{width:26,height:36,borderRadius:5,border:exists?(canClick?"2px solid #ffe066":"2px solid #4a6fa5"):"2px solid #1a1a2a",background:exists?(canClick?"linear-gradient(135deg,#2a2000,#443300)":"linear-gradient(135deg,#0d1b2a,#1b3a5c)"):"#080810",display:"flex",alignItems:"center",justifyContent:"center",opacity:exists?1:0.15,cursor:exists&&canClick?"pointer":"default",boxShadow:canClick&&exists?"0 0 10px #ffe066aa,inset 0 0 6px #ffe06633":"none",transition:"all 0.15s"}}></div>
      );})}
    </div>
  );
}

export function StepIndicator({drewThisTurn,attackingUid}){
  const step=!drewThisTurn?"ターン開始ステップ":attackingUid?"攻撃ステップ":"メインステップ";
  const color=!drewThisTurn?"#4af":attackingUid?"#f74":"#8f4";
  return(
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.55)",borderTop:"1px solid #1a1a2a",borderBottom:"1px solid #1a1a2a"}}>
      <span style={{fontSize:15,fontWeight:700,color,letterSpacing:3}}>{step}</span>
    </div>
  );
}
