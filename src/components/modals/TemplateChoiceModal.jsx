import { CIV } from "../../constants";
import { getCardCivs } from "../../gameLogic";

// ===========================
// TEMPLATE CHOICE MODAL (chooseTimes)
// ===========================
export function TemplateChoiceModal({ modal, onChoose, onAbandon }) {
  if (!modal) return null;
  const { templates, srcCard, count } = modal;
  const civs = getCardCivs(srcCard || {});
  const c = CIV[civs[0]] || CIV.fire;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:385, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:440, width:"100%", boxShadow:`0 0 30px ${c.glow}55` }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:14, fontWeight:900, marginBottom:4, letterSpacing:1 }}>{srcCard?.name || ""}</div>
        <div style={{ fontSize:11, color:"#aaa", marginBottom:12 }}>残り{count}回選択（同じものを選んでもよい）</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
          {templates.map((tpl, i) => (
            <button key={i} onClick={() => onChoose(i)} style={{ padding:"12px 14px", borderRadius:8, background:`${c.color}14`, border:`1px solid ${c.color}55`, cursor:"pointer", textAlign:"left", fontSize:12, color:"#fff" }}>
              {tpl.label}
            </button>
          ))}
        </div>
        <button onClick={onAbandon} style={{ width:"100%", padding:"9px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#888", cursor:"pointer", fontSize:12 }}>
          残りを放棄（例外処理）
        </button>
      </div>
    </div>
  );
}
