import { useState } from "react";
import { CardFace } from "../CardFace";

// ===========================
// STEP EXCEPTION MENU（効果の解決中に開く例外処理メニュー）
// 効果ステップのモーダルは盤面を隠してしまうので、解決の途中でも
// 「いま墓地に何があるか」などを確認できるようにする。
//
// 出せるのは公開ゾーンだけ。相手の手札と両者の山札は非公開なので出さない。
// シールドゾーンは裏向きなので、表向きのカード（G城など）だけを出す。
// ===========================

// selfOnly: 解決しているプレイヤー自身のものだけ見せる（自分の手札は自分には公開）
// pick: そのゾーンから見せられるカードを絞る（シールドは表向きだけ）
const VIEW_ZONES = [
  { key: "battle",  label: "バトルゾーン" },
  { key: "mana",    label: "マナゾーン" },
  { key: "grave",   label: "墓地" },
  { key: "hyper",   label: "超次元ゾーン" },
  { key: "shields", label: "表向きシールド", pick: cards => cards.filter(c => c.faceUp) },
  { key: "hand",    label: "手札", selfOnly: true },
];

const zoneCards = (state, z) => {
  const cards = state?.[z.key] || [];
  return z.pick ? z.pick(cards) : cards;
};

function Frame({ children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 420,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "linear-gradient(160deg,#0b0b1a,#08080f)", border: "2px solid #888",
        borderRadius: 14, padding: 20, maxWidth: 560, width: "100%", boxShadow: "0 0 30px #8886",
        maxHeight: "calc(88vh / var(--ui-scale))", display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

// そのプレイヤーの公開ゾーンを並べる。枚数も出して、開く前に見当が付くようにする
function ZoneRow({ pid, mine, state, onPick }) {
  const zones = VIEW_ZONES.filter(z => !z.selfOnly || mine);
  return (
    <div>
      <div style={{ fontSize: 10, color: "#666", marginBottom: 4, fontWeight: 700 }}>
        {pid.toUpperCase()}（{mine ? "自分" : "相手"}）
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {zones.map(z => {
          const n = zoneCards(state, z).length;
          return (
            <button key={z.key} onClick={() => onPick(z.key)}
              style={{ padding: "7px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                background: "#111", border: "1px solid #333", color: n ? "#ccc" : "#555" }}>
              {z.label} <span style={{ color: "#777" }}>({n})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepExceptionMenu({ p1, p2, ownerPid, onCancelEffect, onClose }) {
  // null ならメニュー、選ぶと { pid, zone } でそのゾーンの中身を出す
  const [viewing, setViewing] = useState(null);
  const stateOf = pid => (pid === "p1" ? p1 : p2);
  const oppPid = ownerPid === "p1" ? "p2" : "p1";

  if (viewing) {
    const zone = VIEW_ZONES.find(z => z.key === viewing.zone);
    const cards = zoneCards(stateOf(viewing.pid), zone);
    const mine = viewing.pid === ownerPid;
    return (
      <Frame>
        <div style={{ fontFamily: "'Cinzel',serif", color: "#ddd", fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>
          {viewing.pid.toUpperCase()}（{mine ? "自分" : "相手"}）の{zone.label}（{cards.length}枚）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, overflowY: "auto",
          alignContent: "flex-start", minHeight: 80 }}>
          {cards.length === 0 && <div style={{ fontSize: 11, color: "#444", alignSelf: "center" }}>カードがありません</div>}
          {cards.map(card => (
            <div key={card.uid} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 56 }}>
              <CardFace card={card} small />
              <div style={{ fontSize: 8, color: "#888", textAlign: "center", maxWidth: 56,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setViewing(null)}
          style={{ padding: "9px", borderRadius: 6, background: "#1a1a2a", border: "1px solid #888",
            color: "#eee", cursor: "pointer", fontSize: 12 }}>
          ← メニューへ戻る
        </button>
      </Frame>
    );
  }

  return (
    <Frame>
      <div>
        <div style={{ fontFamily: "'Cinzel',serif", color: "#ddd", fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>
          例外処理
        </div>
        <div style={{ fontSize: 10, color: "#666", marginTop: 3 }}>
          公開ゾーンの中身を確認できます（相手の手札と山札は非公開なので出せません）
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        <ZoneRow pid={ownerPid} mine state={stateOf(ownerPid)} onPick={z => setViewing({ pid: ownerPid, zone: z })} />
        <ZoneRow pid={oppPid} mine={false} state={stateOf(oppPid)} onPick={z => setViewing({ pid: oppPid, zone: z })} />
      </div>

      <div style={{ display: "flex", gap: 8, borderTop: "1px solid #222", paddingTop: 12 }}>
        <button onClick={onCancelEffect}
          style={{ flex: 1, padding: "10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: "#1a0a0a", border: "1px solid #aa5555", color: "#e88" }}>
          効果を中止する
        </button>
        <button onClick={onClose}
          style={{ padding: "10px 16px", borderRadius: 6, background: "#1a1a2a", border: "1px solid #888",
            color: "#eee", cursor: "pointer", fontSize: 12 }}>
          閉じる
        </button>
      </div>
    </Frame>
  );
}
