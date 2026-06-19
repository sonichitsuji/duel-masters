import { CIV } from "../../constants";
import { getCardCivs } from "../../gameLogic";
import { EffectText } from "../EffectText";

// ===========================
// TWIN PACT CHOICE MODAL
// ===========================
export function TwinPactChoiceModal({ card, onSelectCreature, onSelectSpell, onCancel }) {
  const civs = getCardCivs(card);
  const c = CIV[civs[0]] || CIV.fire;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:395, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:380, width:"100%", boxShadow:`0 0 30px ${c.glow}55` }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:14, fontWeight:900, marginBottom:4, letterSpacing:2 }}>TWIN PACT</div>
        <div style={{ fontSize:12, color:"#ccc", marginBottom:14 }}>{card.name} をどちらとして使いますか？</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
          <button onClick={onSelectCreature} style={{ padding:"14px 16px", borderRadius:8, background:"rgba(255,180,0,0.1)", border:"1px solid #ffbb0055", cursor:"pointer", textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>クリーチャーとして召喚</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>コスト {card.cost} / パワー {card.power} / {card.race}</div>
          </button>
          <button onClick={onSelectSpell} style={{ padding:"14px 16px", borderRadius:8, background:"rgba(100,180,255,0.1)", border:"1px solid #44aaff55", cursor:"pointer", textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>呪文として唱える</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>コスト {card.spellSide?.cost} / {card.spellSide?.name}</div>
            {card.spellSide?.subtype&&<div style={{ fontSize:10, color:"#88aacc", marginTop:1, fontStyle:"italic" }}>{card.spellSide.subtype}</div>}
            <div style={{ fontSize:10, color:"#666", marginTop:2 }}><EffectText text={card.spellSide?.effect}/></div>
          </button>
        </div>
        <button onClick={onCancel} style={{ width:"100%", padding:"9px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#888", cursor:"pointer", fontSize:12 }}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
