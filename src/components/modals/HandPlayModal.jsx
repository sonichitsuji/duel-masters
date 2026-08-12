import { useState } from "react";
import { CardFace } from "../CardFace";
import { CARD_TYPE_LABELS, CIV } from "../../constants";
import { cardDisplayName, isCreatureSide, handPlayLabel } from "../../gameLogic";

// ===========================
// HAND PLAY MODAL（鬼エンド / D・D・D）
// ===========================
// 誘発のタイミングで、手札のカードをプレイしてよいか聞く。
// 「〜してもよい」なので必ず見送れる。コストが要るものは支払いの前段になる。
export function HandPlayModal({ pid, plays, onPlay, onSkip }) {
  const [selected, setSelected] = useState(plays.length === 1 ? plays[0].card.uid : null);
  const picked = plays.find(p => p.card.uid === selected);
  // ツインパクトを呪文面で実行する時は face が付く。表示も判定もその面で行う
  const faceOf = p => p?.face || p?.card;
  // 呪文は「唱える」、クリーチャーは「召喚する」。未選択のうちはどちらとも言えないので中立の語にする
  const verb = !picked ? "プレイする" : isCreatureSide(faceOf(picked)) ? "召喚する" : "唱える";
  const costLabel = cost => `[${(cost.civs || []).map(cv => CIV[cv]?.label || cv).join("/")}(${cost.cost})]`;
  const kinds = [...new Set(plays.map(p => p.kind))].map(handPlayLabel).join(" / ");

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#1a0008,#08080f)", border:"2px solid #ff4466", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #ff446666", maxHeight:"calc(90vh / var(--ui-scale))", display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", color:"#ff8899", fontSize:14, fontWeight:900, letterSpacing:2 }}>{kinds}</div>
          <div style={{ fontSize:11, color:"#888", marginTop:4 }}>
            {pid.toUpperCase()}: 手札のカードをプレイできます。
          </div>
        </div>

        <div style={{ overflowY:"auto" }}>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {plays.map(p => (
              <div key={p.card.uid} onClick={() => setSelected(selected === p.card.uid ? null : p.card.uid)} style={{ cursor:"pointer" }}>
                <CardFace card={faceOf(p)} small selected={selected === p.card.uid} />
              </div>
            ))}
          </div>
          {picked && (
            <div style={{ marginTop:8, fontSize:11, color:"#ccc", background:"rgba(0,0,0,0.4)", borderRadius:6, padding:"6px 8px", border:"1px solid #ff446633" }}>
              <b style={{ color:"#fff" }}>{cardDisplayName(faceOf(picked))}</b>
              <span style={{ color:"#777", marginLeft:6 }}>
                {faceOf(picked).side === "spell" ? CARD_TYPE_LABELS.spell : (CARD_TYPE_LABELS[faceOf(picked).type] || faceOf(picked).type)}
              </span>
              <span style={{ color:"#ff8899", marginLeft:6 }}>{handPlayLabel(picked.kind)}</span>
              <div style={{ color:"#aaa", marginTop:2 }}>
                {picked.cost ? `支払うコスト ${costLabel(picked.cost)}` : "コストを支払いません"}
              </div>
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onPlay(picked)} disabled={!picked}
            style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:picked?"linear-gradient(135deg,#ff446633,#ff446611)":"#111", border:`1px solid ${picked?"#ff4466":"#333"}`, color:picked?"#ff8899":"#444", cursor:picked?"pointer":"not-allowed" }}>
            {picked?.cost ? `${costLabel(picked.cost)} を支払って${verb}` : `コストを支払わずに${verb}`}
          </button>
          <button onClick={onSkip} style={{ padding:"10px 16px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#666", cursor:"pointer", fontSize:12 }}>
            使わない
          </button>
        </div>
      </div>
    </div>
  );
}
