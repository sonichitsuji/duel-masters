import { useState } from "react";
import { CIV } from "../constants";
import { getCardCivs, computeGrantedKeywords } from "../gameLogic";
import { EffectText } from "./EffectText";
import { CardFace } from "./CardFace";

// ===========================
// CREATURE DETAIL PANEL
// ===========================
export function CreatureDetailPanel({card,isActive,drewThisTurn,onAttack,onClose,battleZone,ownerState}){
  const [showStack,setShowStack]=useState(false);
  const civs=getCardCivs(card);
  const c=CIV[civs[0]]||CIV.fire;
  const c2=civs[1]?CIV[civs[1]]:null;
  const isCreature=card.type==="creature"||card.type==="evo_creature";
  const effectiveSA=card.keywords?.includes("speedAttacker")||computeGrantedKeywords(card,battleZone||[],ownerState).includes("speedAttacker");
  const canAtk=isCreature&&isActive&&drewThisTurn&&!card.tapped&&!card.keywords?.includes("cantAttack")&&!(card.summonedThisTurn&&!effectiveSA)&&!card.cantAttackThisTurn&&!card.cantAttackUntilMyTurn;
  const reason=!isActive?null:!isCreature?"攻撃できない":card.tapped?"攻撃済み":card.keywords?.includes("cantAttack")?"攻撃不可":(card.summonedThisTurn&&!effectiveSA)?"召喚酔い":card.cantAttackThisTurn?"G・ストライクで攻撃不可":card.cantAttackUntilMyTurn?"相手の効果で攻撃不可":!drewThisTurn?"ドロー前":null;

  const hyper=card.hyperMode;
  const effPower=((hyper&&card.hyperPower!=null)?card.hyperPower:(card.power||0))+(card.tempBuff?.power||0);
  const hyperTBreaker=hyper&&card.hyperKeywords?.includes("tBreaker");
  const hyperWBreaker=hyper&&card.hyperKeywords?.includes("wBreaker");

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:`linear-gradient(170deg,${c.bg} 0%,${c2?c2.bg:"#08080f"} 100%)`,
        border:`2px solid ${c.color}`,borderRadius:12,maxWidth:340,width:"100%",
        boxShadow:`0 0 30px ${c.glow}55`,overflow:"hidden",
      }}>
        {/* Card header - official style */}
        <div style={{background:`linear-gradient(90deg,${c.color}33,${c2?c2.color+"22":"transparent"})`,padding:"10px 14px",borderBottom:`1px solid ${c.color}44`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              {/* Cost badge */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:"#fff",boxShadow:`0 0 8px ${c.glow}`}}>{card.cost}</div>
                {c2&&<div style={{width:24,height:24,borderRadius:"50%",background:c2.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:10,color:"#fff",fontFamily:"'Noto Sans JP',sans-serif"}}>{c2.label}</div>}
              </div>
              {/* Name */}
              <div style={{fontWeight:900,color:"#fff",fontSize:15,lineHeight:1.2,textShadow:`0 0 8px ${c.glow}`}}>{card.name}</div>
              {/* Race */}
              {card.race&&<div style={{fontSize:11,color:c.textColor,marginTop:2,fontStyle:"italic"}}>{card.race}</div>}
            </div>
            {/* Civ icons */}
            <div style={{display:"flex",gap:4}}>{civs.map(cv=>{const cv_=CIV[cv];return cv_?<span key={cv} style={{fontSize:14,fontWeight:900,color:cv_.textColor,background:`${cv_.color}33`,border:`1px solid ${cv_.color}66`,borderRadius:4,padding:"2px 8px",fontFamily:"'Noto Sans JP',sans-serif",textShadow:`0 0 8px ${cv_.glow}`}}>{cv_.label}</span>:null;})}</div>
          </div>
        </div>

        {/* Effect text box - official style */}
        <div style={{margin:"10px 12px",background:"rgba(0,0,0,0.5)",border:`1px solid ${c.color}44`,borderRadius:6,padding:"10px 12px",minHeight:80}}>
          <EffectText text={card.effect} civColor={c.textColor}/>
        </div>

        {/* Power - big and prominent */}
        {card.type==="creature"&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 14px 10px"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontSize:28,fontWeight:900,color:"#fff",textShadow:`0 0 10px ${c.glow}`,fontFamily:"'Cinzel',serif"}}>{effPower}</span>
              <span style={{fontSize:12,color:c.textColor,fontWeight:600}}>POWER</span>
            </div>
            <div style={{display:"flex",gap:4}}>
              {card.keywords?.includes("speedAttacker")&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:3,background:"#ff440022",border:"1px solid #ff4444",color:"#ff8877"}}>SA</span>}
              {!(card.keywords?.includes("tBreaker")||hyperTBreaker)&&(card.keywords?.includes("wBreaker")||hyperWBreaker)&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:3,background:`${c.color}22`,border:`1px solid ${c.color}`,color:c.textColor}}>W.BRK</span>}
              {(card.keywords?.includes("tBreaker")||hyperTBreaker)&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:3,background:`${c.color}22`,border:`1px solid ${c.color}`,color:c.textColor}}>T.BRK</span>}
              {card.keywords?.includes("blocker")&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:3,background:"#4444ff22",border:"1px solid #4444ff",color:"#8888ff"}}>BLK</span>}
            </div>
          </div>
        )}

        {/* Status indicators */}
        <div style={{padding:"0 12px 8px",display:"flex",gap:6,flexWrap:"wrap"}}>
          {card.tapped&&<div style={{fontSize:10,color:"#888",padding:"2px 8px",background:"#111",borderRadius:3}}>TAPPED</div>}
          {card.summonedThisTurn&&!card.keywords?.includes("speedAttacker")&&<div style={{fontSize:10,color:"#888",padding:"2px 8px",background:"#111",borderRadius:3}}>召喚酔い</div>}
        </div>

        {/* Evolution base viewer */}
        {card.evolutionBase?.length>0&&(
          <div style={{padding:"0 12px 8px"}}>
            <button onClick={()=>setShowStack(v=>!v)} style={{width:"100%",padding:"6px 10px",borderRadius:6,background:"#111",border:`1px solid ${c.color}66`,color:c.textColor,cursor:"pointer",fontSize:11,fontWeight:700}}>
              {showStack?"進化元を隠す":`進化元を見る (${card.evolutionBase.length}枚)`}
            </button>
            {showStack&&(
              <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap",background:"rgba(0,0,0,0.4)",border:`1px solid ${c.color}33`,borderRadius:6,padding:8}}>
                {card.evolutionBase.map((bc,i)=>(
                  <div key={bc.uid||i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <CardFace card={bc} small/>
                    <div style={{fontSize:8,color:"#aaa",textAlign:"center",maxWidth:52,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i+1}. {bc.name}</div>
                    {bc.race&&<div style={{fontSize:7,color:"#777",textAlign:"center"}}>{bc.race}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div style={{display:"flex",gap:8,padding:"8px 12px 12px"}}>
          {isActive&&<button onClick={()=>{if(canAtk)onAttack();}} style={{flex:1,padding:"10px",borderRadius:6,fontWeight:700,fontSize:13,background:canAtk?`linear-gradient(135deg,${c.color}55,${c.color}22)`:"#111",border:`1px solid ${canAtk?c.color:"#333"}`,color:canAtk?c.textColor:"#444",cursor:canAtk?"pointer":"not-allowed",letterSpacing:1,fontFamily:"'Cinzel',serif"}}>{canAtk?"ATTACK":`攻撃不可 (${reason})`}</button>}
          <button onClick={onClose} style={{padding:"10px 16px",borderRadius:6,background:"#111",border:"1px solid #333",color:"#666",cursor:"pointer",fontSize:12}}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
