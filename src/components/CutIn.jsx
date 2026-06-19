import { useState, useEffect } from "react";
import { CIV } from "../constants";

// ===========================
// CUT-IN
// ===========================
export function CutIn({cutin,onDone}){
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
        <div style={{fontFamily:"'Cinzel',serif",fontSize:30,fontWeight:900,color:c.color,textShadow:`0 0 16px ${c.glow}`,marginBottom:6,letterSpacing:2}}>{c.label}</div>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:22,fontWeight:900,color:c.color,textShadow:`0 0 16px ${c.glow}`,letterSpacing:2,marginBottom:4,textAlign:"center"}}>{cutin.title}</div>
        {cutin.cardName&&<div style={{marginTop:8,padding:"4px 12px",borderRadius:4,background:`${c.color}22`,border:`1px solid ${c.color}55`,fontSize:12,color:c.textColor,fontWeight:700}}>{cutin.cardName}</div>}
      </div>
    </div>
  );
}

export function HyperModeCutIn({creature,onDismiss}){
  const civKey=Array.isArray(creature.civ)?creature.civ[0]:creature.civ||"fire";
  const c=CIV[civKey]||CIV.fire;
  return(
    <div onClick={onDismiss} style={{position:"fixed",inset:0,zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.55)",cursor:"pointer"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",background:`linear-gradient(135deg,#1a0500ee,#000000ff)`,border:`3px solid #ffcc00`,borderRadius:20,padding:"24px 48px",boxShadow:`0 0 60px #ffcc0099,0 0 120px #ff880055`,minWidth:260,animation:"hyperGlow 1.2s ease-in-out infinite alternate"}}>
        <div style={{fontSize:36,marginBottom:4,fontFamily:"'Cinzel',serif",fontWeight:900,color:"#ffcc00",textShadow:"0 0 20px #ffcc00",letterSpacing:2}}>✦</div>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:20,fontWeight:900,color:"#ffcc00",textShadow:"0 0 16px #ffcc00",letterSpacing:3,marginBottom:6}}>HYPER MODE</div>
        <div style={{fontSize:13,fontWeight:900,color:"#ffcc00",textShadow:"0 0 10px #ff8800",marginBottom:4}}>ハイパーモード解放！</div>
        <div style={{marginTop:8,padding:"4px 14px",borderRadius:4,background:"rgba(255,200,0,0.12)",border:"1px solid #ffcc0066",fontSize:12,color:"#ffe066",fontWeight:700}}>{creature.name}</div>
        <div style={{marginTop:16,fontSize:10,color:"#888"}}>タップでスキップ</div>
      </div>
      <style>{`@keyframes hyperGlow{from{box-shadow:0 0 40px #ffcc0088,0 0 80px #ff880044;}to{box-shadow:0 0 80px #ffcc00cc,0 0 160px #ff880088;}}`}</style>
    </div>
  );
}
