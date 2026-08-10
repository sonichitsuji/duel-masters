import { useState } from "react";
import { CardFace } from "../CardFace";
import { CARD_TYPE_LABELS } from "../../constants";
import { cardDisplayName, isCreatureSide } from "../../gameLogic";

// ===========================
// ONI END MODAL（鬼エンド）
// ===========================
// シールドが1つもないプレイヤーがいる時、手札のカードをコストを支払わずにプレイできる。
// 「〜してもよい」なので、必ず見送れる形にする。
export function OniEndModal({ pid, cards, onCast, onSkip }) {
  const [selected, setSelected] = useState(cards.length === 1 ? cards[0].uid : null);
  const picked = cards.find(c => c.uid === selected);
  // 呪文は「唱える」、クリーチャーは「召喚する」。未選択のうちはどちらとも言えないので中立の語にする
  const verb = !picked ? "プレイする" : isCreatureSide(picked) ? "召喚する" : "唱える";
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#1a0008,#08080f)", border:"2px solid #ff4466", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #ff446666", maxHeight:"calc(90vh / var(--ui-scale))", display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", color:"#ff8899", fontSize:14, fontWeight:900, letterSpacing:2 }}>鬼エンド</div>
          <div style={{ fontSize:11, color:"#888", marginTop:4 }}>
            {pid.toUpperCase()}: シールドが1つもないプレイヤーがいます。<br/>
            手札のカードを、コストを支払わずにプレイできます。
          </div>
        </div>

        <div style={{ overflowY:"auto" }}>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {cards.map(c => (
              <div key={c.uid} onClick={() => setSelected(selected === c.uid ? null : c.uid)} style={{ cursor:"pointer" }}>
                <CardFace card={c} small selected={selected === c.uid} />
              </div>
            ))}
          </div>
          {picked && (
            <div style={{ marginTop:8, fontSize:11, color:"#ccc", background:"rgba(0,0,0,0.4)", borderRadius:6, padding:"6px 8px", border:"1px solid #ff446633" }}>
              <b style={{ color:"#fff" }}>{cardDisplayName(picked)}</b>
              <span style={{ color:"#777", marginLeft:6 }}>{CARD_TYPE_LABELS[picked.type] || picked.type}</span>
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onCast(picked)} disabled={!picked}
            style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:picked?"linear-gradient(135deg,#ff446633,#ff446611)":"#111", border:`1px solid ${picked?"#ff4466":"#333"}`, color:picked?"#ff8899":"#444", cursor:picked?"pointer":"not-allowed" }}>
            コストを支払わずに{verb}
          </button>
          <button onClick={onSkip} style={{ padding:"10px 16px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#666", cursor:"pointer", fontSize:12 }}>
            使わない
          </button>
        </div>
      </div>
    </div>
  );
}
