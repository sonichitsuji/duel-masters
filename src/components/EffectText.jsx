import { KEYWORD_PATTERNS, CIV } from "../constants";
import { getCardCivs } from "../gameLogic";

export function EffectText({text,civColor}){
  const lines = text?.split("\n")||[];
  return (
    <>
      {lines.map((line,i)=>{
        const isKw=KEYWORD_PATTERNS.some(k=>line.startsWith(k));
        const isSTrigger=line.startsWith("S・トリガー");
        return (
          <div key={i} style={{
            fontSize:11,lineHeight:1.6,marginBottom:isKw?2:0,
            color: isSTrigger?"#ffcc44":isKw?(civColor||"#ccc"):"#ccc",
            fontWeight: isKw?700:400,
          }}>{line}</div>
        );
      })}
    </>
  );
}

// カード1枚ぶんの能力表示。
// ツインパクトは1枚のカードに2つの面があるので、クリーチャー面の下に呪文面も並べる。
// （面ごとに名前・コスト・文明が違うため、それぞれ見出しを付ける）
export function CardEffectText({card,civColor}){
  const spell=card?.type==="twinpact"?card.spellSide:null;
  if(!spell) return <EffectText text={card?.effect} civColor={civColor}/>;

  const sideHead=(label,name,cost,civ)=>{
    const civs=getCardCivs({civ});
    return (
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
        <span style={{fontSize:9,color:"#777",border:"1px solid #333",borderRadius:3,padding:"0 5px",letterSpacing:1}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{name}</span>
        <span style={{fontSize:10,color:"#888"}}>コスト{cost}</span>
        {civs.map(cv=>CIV[cv]?(
          <span key={cv} style={{fontSize:9,fontWeight:900,color:CIV[cv].textColor,background:`${CIV[cv].color}33`,border:`1px solid ${CIV[cv].color}66`,borderRadius:3,padding:"0 4px",fontFamily:"'Noto Sans JP',sans-serif"}}>{CIV[cv].label}</span>
        ):null)}
      </div>
    );
  };
  return (
    <>
      <div>
        {sideHead("クリーチャー",card.name,card.cost,card.civ)}
        <EffectText text={card.effect} civColor={civColor}/>
      </div>
      <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #333"}}>
        {sideHead("呪文",spell.name,spell.cost,spell.civ??card.civ)}
        <EffectText text={spell.effect} civColor={civColor}/>
      </div>
    </>
  );
}
