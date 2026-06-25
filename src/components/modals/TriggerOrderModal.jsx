import { CIV, EFFECT_TYPE_LABELS } from "../../constants";
import { getCardCivs } from "../../gameLogic";

// 同時に誘発した複数の能力の解決順をプレイヤーに選ばせるモーダル。
// リゾルバが「ターンプレイヤー優先」で抽出した群（entries）を一覧表示し、1つ選ぶ。
function summarize(entry){
  const eff=entry.effect||{};
  if(eff.type==="steps"){
    const s=(eff.steps||[]).find(x=>x.label);
    if(s) return s.label;
    const first=eff.steps?.[0];
    return first?.type||"効果";
  }
  if(eff.type==="chooseTimes") return `${eff.count}回選んで実行`;
  return EFFECT_TYPE_LABELS[eff.type]||eff.type||"効果";
}

export function TriggerOrderModal({ entries, onChoose }) {
  if(!entries||entries.length===0) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:420, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#0a0a1e,#08080f)", border:"2px solid #ffe066", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #ffe06655" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#ffe066", fontSize:13, fontWeight:900, marginBottom:4, letterSpacing:2 }}>解決する能力を選択</div>
        <div style={{ fontSize:11, color:"#aaa", marginBottom:12 }}>同時に誘発した能力です。解決する順に1つずつ選んでください（ターンプレイヤーの能力から）。</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {entries.map(entry=>{
            const civs=getCardCivs(entry.srcCard||{civ:"fire"});
            const c=CIV[civs[0]]||CIV.fire;
            return (
              <button key={entry.id} onClick={()=>onChoose(entry.id)} style={{ textAlign:"left", padding:"10px 12px", borderRadius:8, border:`1px solid ${c.color}88`, background:`${c.color}14`, color:"#fff", cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:10, fontWeight:900, color:c.textColor, background:`${c.color}33`, border:`1px solid ${c.color}66`, borderRadius:3, padding:"0 5px" }}>{civs.map(cv=>CIV[cv]?.label).join("")}</span>
                  <span style={{ fontWeight:700, fontSize:13 }}>{entry.srcCard?.name||entry.sourceName}</span>
                </div>
                <div style={{ fontSize:11, color:"#bbb" }}>{summarize(entry)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
