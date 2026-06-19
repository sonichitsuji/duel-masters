import { CIV } from "../../constants";
import { getCardCivs } from "../../gameLogic";
import { CardFace } from "../CardFace";

// ===========================
// EVOLUTION SELECT MODAL
// ===========================
export function EvolutionSelectModal({ eligible, card, onSelect, onCancel }) {
  const civs = getCardCivs(card);
  const c = CIV[civs[0]] || CIV.fire;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:395, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:420, width:"100%", boxShadow:`0 0 30px ${c.glow}55` }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:14, fontWeight:900, marginBottom:4 }}>🔺 進化元を選択</div>
        <div style={{ fontSize:11, color:"#ccc", marginBottom:4 }}>{card.name} の進化元となるクリーチャーを選んでください</div>
        <div style={{ fontSize:10, color:"#555", marginBottom:10 }}>
          条件: {card.evolution?.civFilter ? `${CIV[card.evolution.civFilter]?.label}文明` : ""}
          {card.evolution?.raceContains ? ` ${card.evolution.raceContains}` : ""}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {eligible.map(bc => (
            <div key={bc.uid} onClick={() => onSelect(bc.uid)} style={{ cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <CardFace card={bc} small />
              <div style={{ fontSize:8, color:"#aaa", textAlign:"center", maxWidth:52, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bc.name}</div>
            </div>
          ))}
          {eligible.length === 0 && <div style={{ color:"#f84", fontSize:12 }}>進化元なし</div>}
        </div>
        <button onClick={onCancel} style={{ width:"100%", padding:"9px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#888", cursor:"pointer", fontSize:12 }}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
