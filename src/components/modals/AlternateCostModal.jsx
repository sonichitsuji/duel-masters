import { CIV } from "../../constants";
import { getCardCivs } from "../../gameLogic";

// ===========================
// ALTERNATE COST MODAL
// ===========================
export function AlternateCostModal({ card, onSelectNormal, onSelectAlternate, onCancel }) {
  const civs = getCardCivs(card);
  const c = CIV[civs[0]] || CIV.fire;
  const altCivLabel = (card.alternateCost.civs || []).map(cv => CIV[cv]?.label || cv).join("/");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:395, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:380, width:"100%", boxShadow:`0 0 30px ${c.glow}55` }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:14, fontWeight:900, marginBottom:4, letterSpacing:2 }}>代替コスト</div>
        <div style={{ fontSize:12, color:"#ccc", marginBottom:14 }}>{card.name} をどちらのコストで唱えますか？</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
          <button onClick={onSelectNormal} style={{ padding:"14px 16px", borderRadius:8, background:"rgba(255,180,0,0.1)", border:"1px solid #ffbb0055", cursor:"pointer", textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>通常コストで唱える</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>コスト {card.cost}</div>
          </button>
          <button onClick={onSelectAlternate} style={{ padding:"14px 16px", borderRadius:8, background:"rgba(100,180,255,0.1)", border:"1px solid #44aaff55", cursor:"pointer", textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>代替コストで唱える</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>コスト [{altCivLabel}({card.alternateCost.cost})]</div>
          </button>
        </div>
        <button onClick={onCancel} style={{ width:"100%", padding:"9px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#888", cursor:"pointer", fontSize:12 }}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
