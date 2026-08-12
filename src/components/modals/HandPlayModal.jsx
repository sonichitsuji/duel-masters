import { useState } from "react";
import { CardFace } from "../CardFace";
import { CARD_TYPE_LABELS, CIV } from "../../constants";
import { cardDisplayName, isCreatureSide, handPlayLabel } from "../../gameLogic";

// ===========================
// HAND PLAY MODAL（鬼エンド / D・D・D / S・トリガー）
// ===========================
// 誘発のタイミングで、手札のカードをプレイしてよいか聞く。
// 「〜してもよい」なので必ず見送れる。コストが要るものは支払いの前段になる。
//
// 複数枚まとめて宣言できる。2枚以上選んだ場合は、この後に解決順を選ぶモーダルが出る
// （1枚ずつ提示していると、実行するたびに条件が取り直されて解決順が読めなくなるため）。
export function HandPlayModal({ pid, plays, onPlay, onSkip }) {
  const [selected, setSelected] = useState(plays.length === 1 ? [plays[0].card.uid] : []);
  const picks = selected.map(uid => plays.find(p => p.card.uid === uid)).filter(Boolean);
  const one = picks.length === 1 ? picks[0] : null;
  // ツインパクトを呪文面で実行する時は face が付く。表示も判定もその面で行う
  const faceOf = p => p?.face || p?.card;
  // 呪文は「唱える」、クリーチャーは「召喚する」。1枚に絞れていない間は中立の語にする
  const verb = !one ? "プレイする" : isCreatureSide(faceOf(one)) ? "召喚する" : "唱える";
  const costLabel = cost => `[${(cost.civs || []).map(cv => CIV[cv]?.label || cv).join("/")}(${cost.cost})]`;
  const kinds = [...new Set(plays.map(p => p.kind))].map(handPlayLabel).join(" / ");
  const toggle = uid => setSelected(s => s.includes(uid) ? s.filter(u => u !== uid) : [...s, uid]);

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
              <div key={p.card.uid} onClick={() => toggle(p.card.uid)} style={{ cursor:"pointer" }}>
                <CardFace card={faceOf(p)} small selected={selected.includes(p.card.uid)} />
              </div>
            ))}
          </div>
          {picks.map(p => (
            <div key={p.card.uid} style={{ marginTop:8, fontSize:11, color:"#ccc", background:"rgba(0,0,0,0.4)", borderRadius:6, padding:"6px 8px", border:"1px solid #ff446633" }}>
              <b style={{ color:"#fff" }}>{cardDisplayName(faceOf(p))}</b>
              <span style={{ color:"#777", marginLeft:6 }}>
                {faceOf(p).side === "spell" ? CARD_TYPE_LABELS.spell : (CARD_TYPE_LABELS[faceOf(p).type] || faceOf(p).type)}
              </span>
              <span style={{ color:"#ff8899", marginLeft:6 }}>{handPlayLabel(p.kind)}</span>
              <div style={{ color:"#aaa", marginTop:2 }}>
                {p.cost ? `支払うコスト ${costLabel(p.cost)}` : "コストを支払いません"}
              </div>
            </div>
          ))}
          {picks.length > 1 && (
            <div style={{ marginTop:8, fontSize:11, color:"#ffcc66" }}>
              このあと、どれから解決するかを選びます
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => picks.length && onPlay(picks)} disabled={!picks.length}
            style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:picks.length?"linear-gradient(135deg,#ff446633,#ff446611)":"#111", border:`1px solid ${picks.length?"#ff4466":"#333"}`, color:picks.length?"#ff8899":"#444", cursor:picks.length?"pointer":"not-allowed" }}>
            {one
              ? (one.cost ? `${costLabel(one.cost)} を支払って${verb}` : `コストを支払わずに${verb}`)
              : `${picks.length}枚をプレイする`}
          </button>
          <button onClick={onSkip} style={{ padding:"10px 16px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#666", cursor:"pointer", fontSize:12 }}>
            使わない
          </button>
        </div>
      </div>
    </div>
  );
}
