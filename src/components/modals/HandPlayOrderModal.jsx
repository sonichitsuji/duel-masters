import { useState } from "react";
import { CardFace } from "../CardFace";
import { CIV } from "../../constants";
import { cardDisplayName, handPlayLabel, getCardCivs } from "../../gameLogic";

// ===========================
// HAND PLAY ORDER MODAL（宣言した手札プレイの解決順を決める）
// ===========================
// 鬼エンドやS・トリガーを2枚以上まとめて宣言した時、どれから解決するかを選ばせる。
// 先に解決したものの効果で盤面が変わるので、順番はプレイヤーが決められないといけない。
// 選んだ順がそのまま解決順になる（TriggerOrderModal と同じで、上から1つずつ選ぶ）。
export function HandPlayOrderModal({ pid, plays, onConfirm, onCancel }) {
  const [order, setOrder] = useState([]);   // uid[] 選んだ順
  const faceOf = p => p.face || p.card;
  const rest = plays.filter(p => !order.includes(p.card.uid));
  const done = order.length === plays.length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 410,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "linear-gradient(160deg,#1a0008,#08080f)", border: "2px solid #ff4466",
        borderRadius: 14, padding: 20, maxWidth: 460, width: "100%", boxShadow: "0 0 30px #ff446666",
        maxHeight: "calc(90vh / var(--ui-scale))", display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Cinzel',serif", color: "#ff8899", fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>
            解決する順番
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            {pid.toUpperCase()}: {plays.length}枚を宣言しました。解決する順に1枚ずつ選んでください。
          </div>
        </div>

        {/* 選んだ順（決まったぶん） */}
        {order.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {order.map((uid, i) => {
              const p = plays.find(x => x.card.uid === uid);
              const civs = getCardCivs(faceOf(p));
              const c = CIV[civs[0]] || CIV.fire;
              return (
                <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                  borderRadius: 6, background: `${c.color}14`, border: `1px solid ${c.color}55` }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#ffe066", color: "#000",
                    fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{cardDisplayName(faceOf(p))}</span>
                  <span style={{ fontSize: 10, color: "#ff8899", marginLeft: "auto" }}>{handPlayLabel(p.kind)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* 残り。押した順に上へ積まれる */}
        {rest.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>
              次に解決するものを選択（残り{rest.length}枚）：
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", overflowY: "auto" }}>
              {rest.map(p => (
                <div key={p.card.uid} onClick={() => setOrder(o => [...o, p.card.uid])}
                  style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 56 }}>
                  <CardFace card={faceOf(p)} small />
                  <div style={{ fontSize: 8, color: "#888", textAlign: "center", maxWidth: 56,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{faceOf(p).name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => done && onConfirm(order)} disabled={!done}
            style={{ flex: 1, padding: "10px", borderRadius: 6, fontWeight: 700, fontSize: 12,
              background: done ? "linear-gradient(135deg,#ff446633,#ff446611)" : "#111",
              border: `1px solid ${done ? "#ff4466" : "#333"}`, color: done ? "#ff8899" : "#444",
              cursor: done ? "pointer" : "not-allowed" }}>
            ✓ この順で解決する ({order.length}/{plays.length})
          </button>
          {order.length > 0 && (
            <button onClick={() => setOrder([])}
              style={{ padding: "10px 14px", borderRadius: 6, background: "#111", border: "1px solid #555",
                color: "#aaa", cursor: "pointer", fontSize: 12 }}>
              選び直す
            </button>
          )}
          <button onClick={onCancel}
            style={{ padding: "10px 14px", borderRadius: 6, background: "#111", border: "1px solid #333",
              color: "#666", cursor: "pointer", fontSize: 12 }}>
            やめる
          </button>
        </div>
      </div>
    </div>
  );
}
