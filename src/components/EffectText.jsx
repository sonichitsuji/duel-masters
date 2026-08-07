import { KEYWORD_REGEX, CIV } from "../constants";
import { getCardCivs } from "../gameLogic";

// キーワードは行頭かどうかに関係なく、その語だけを光らせる。
// 行全体を色付けするより、どこが能力名でどこが説明文かが読み取りやすい。
export function EffectText({text}){
  const lines = text?.split("\n")||[];
  return (
    <>
      {lines.map((line,i)=>(
        <div key={i} style={{fontSize:11, lineHeight:1.6, color:"#ccc"}}>
          {line.split(KEYWORD_REGEX).map((part,j)=>
            j%2 ? <b key={j} style={{color:"#ffe066", fontWeight:700}}>{part}</b> : part
          )}
        </div>
      ))}
    </>
  );
}

// カード1枚ぶんの能力表示。
// ツインパクトは1枚のカードに2つの面があるので、クリーチャー面の下に呪文面も並べる。
// クリーチャー面のコスト・文明はカード本体の値そのものなので、上のヘッダーと重複させない。
// 呪文面は値が違うので、そちらにだけコストと文明を付ける。
export function CardEffectText({card}){
  const spell=card?.type==="twinpact"?card.spellSide:null;
  if(!spell) return <EffectText text={card?.effect}/>;

  const sideHead=(label,name,cost,civ)=>{
    const civs=civ==null?[]:getCardCivs({civ});
    return (
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
        <span style={{fontSize:9,color:"#777",border:"1px solid #333",borderRadius:3,padding:"0 5px",letterSpacing:1}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{name}</span>
        {cost!=null&&<span style={{fontSize:10,color:"#888"}}>コスト{cost}</span>}
        {civs.map(cv=>CIV[cv]?(
          <span key={cv} style={{fontSize:9,fontWeight:900,color:CIV[cv].textColor,background:`${CIV[cv].color}33`,border:`1px solid ${CIV[cv].color}66`,borderRadius:3,padding:"0 4px",fontFamily:"'Noto Sans JP',sans-serif"}}>{CIV[cv].label}</span>
        ):null)}
      </div>
    );
  };
  return (
    <>
      <div>
        {sideHead("クリーチャー",card.name)}
        <EffectText text={card.effect}/>
      </div>
      <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #333"}}>
        {sideHead("呪文",spell.name,spell.cost,spell.civ??card.civ)}
        <EffectText text={spell.effect}/>
      </div>
    </>
  );
}
