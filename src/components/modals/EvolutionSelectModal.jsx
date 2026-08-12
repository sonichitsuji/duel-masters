import { useState } from "react";
import { CIV } from "../../constants";
import { getCardCivs, evolutionLabel, evolutionNeeded, getEffectiveCost } from "../../gameLogic";
import { CardFace } from "../CardFace";

const ZONE_LABEL = { bz:"バトルゾーン", grave:"墓地", mana:"マナゾーン" };

// 進化元の条件を人が読める形に。配列は「または」でつなぐ
const orList = (v, fmt = x => x) => (Array.isArray(v) ? v.map(fmt).join("または") : fmt(v));

function describeFilter(filter) {
  if (!filter) return "クリーチャー";
  const parts = [];
  if (filter.civ) parts.push(`${orList(filter.civ, x => CIV[x]?.label ?? x)}文明`);
  if (filter.raceContains) parts.push(orList(filter.raceContains));
  if (filter.nameContains) parts.push(`名前に「${orList(filter.nameContains)}」`);
  if (filter.maxCost != null) parts.push(`コスト${filter.maxCost}以下`);
  parts.push("クリーチャー");
  return parts.join("の");
}

// ===========================
// EVOLUTION SELECT MODAL
// 進化元を選ぶ。選んだ順がそのまま重ねる順になる（バトルゾーンに出た後は変更できない）。
// NEO進化は「重ねてもよい」なので、「重ねずに出す」で進化元なしのまま出せる。
// ===========================
export function EvolutionSelectModal({ candidates, card, spec, ownerState, onConfirm, onCancel }) {
  const [picked, setPicked] = useState([]); // uid[] 選択順
  const civs = getCardCivs(card);
  const c = CIV[civs[0]] || CIV.fire;
  const need = evolutionNeeded(spec);
  const exact = spec?.min == null;                       // count 指定なら「ちょうど need 枚」
  const isNeo = !!spec?.neo;
  const canConfirm = exact ? picked.length === need : picked.length >= need;
  // 「進化元1体につきコスト-1」等、重ねる枚数でコストが変わるカードがあるので選択中のコストを出す
  const costNow = ownerState ? getEffectiveCost(card, ownerState, { evolutionBaseCount: picked.length }) : null;
  const costVaries = ownerState && getEffectiveCost(card, ownerState, { evolutionBaseCount: 0 })
                                !== getEffectiveCost(card, ownerState, { evolutionBaseCount: candidates.length });

  const toggle = uid => setPicked(p => {
    if (p.includes(uid)) return p.filter(u => u !== uid);       // 解除すると以降の番号は詰まる
    if (exact && p.length >= need) return need === 1 ? [uid] : p;
    return [...p, uid];
  });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:395, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:`linear-gradient(160deg,${c.bg},#08080f)`, border:`2px solid ${c.color}`, borderRadius:14, padding:20, maxWidth:520, width:"100%", boxShadow:`0 0 30px ${c.glow}55`, maxHeight:"calc(88vh / var(--ui-scale))", display:"flex", flexDirection:"column", gap:8 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", color:c.textColor, fontSize:14, fontWeight:900 }}>🔺 {evolutionLabel(spec)}</div>
          <div style={{ fontSize:11, color:"#ccc", marginTop:3 }}>
            {card.name} の進化元を{ZONE_LABEL[spec?.zone] || "バトルゾーン"}から
            {exact ? `${need}体` : `${need}体以上`}選んでください
            {isNeo && <span style={{ color:"#7fe" }}>（重ねずに出すこともできます）</span>}
          </div>
          <div style={{ fontSize:10, color:"#666", marginTop:2 }}>
            条件: {describeFilter(spec?.filter)}
            {need > 1 && <span style={{ color:"#ffcc66" }}>／選んだ順に下から重なります</span>}
            {spec?.zone === "mana" && <span style={{ color:"#4a8" }}>／タップ済みでも選べます</span>}
          </div>
          {spec?.neo === "g" && (
            <div style={{ fontSize:10, color:"#7fe", marginTop:3 }}>
              重ねると、離れる時にかわりに下のカードすべてが離れます（重ねなければこの耐性はありません）
            </div>
          )}
          {costVaries && (
            <div style={{ fontSize:11, color:"#ffcc66", marginTop:4 }}>
              重ねる枚数でコストが変わります — 現在のコスト <b style={{ fontSize:14 }}>{costNow}</b>
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:6, flexWrap:"wrap", overflowY:"auto", alignContent:"flex-start", minHeight:80 }}>
          {candidates.map(bc => {
            const idx = picked.indexOf(bc.uid);
            return (
              <div key={bc.uid} onClick={() => toggle(bc.uid)} style={{ cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, position:"relative" }}>
                <CardFace card={bc} small selected={idx >= 0} />
                {idx >= 0 && (
                  <span style={{ position:"absolute", top:-4, left:-4, width:17, height:17, borderRadius:"50%", background:"#ffe066", color:"#000", fontSize:10, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 8px #ffe066" }}>
                    {idx + 1}
                  </span>
                )}
                <div style={{ fontSize:8, color:"#aaa", textAlign:"center", maxWidth:52, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bc.name}</div>
              </div>
            );
          })}
          {candidates.length === 0 && <div style={{ color:"#f84", fontSize:12, alignSelf:"center" }}>進化元なし</div>}
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => canConfirm && onConfirm(picked)} disabled={!canConfirm}
            style={{ flex:1, padding:"10px", borderRadius:6, fontWeight:700, fontSize:12, background:canConfirm?`linear-gradient(135deg,${c.color}55,${c.color}22)`:"#111", border:`1px solid ${canConfirm?c.color:"#333"}`, color:canConfirm?c.textColor:"#444", cursor:canConfirm?"pointer":"not-allowed" }}>
            ✓ 決定 ({picked.length}/{exact ? need : `${need}+`})
          </button>
          {isNeo && (
            <button onClick={() => onConfirm([])}
              style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #7fe", color:"#7fe", cursor:"pointer", fontSize:12, fontWeight:700, whiteSpace:"nowrap" }}>
              重ねずに出す
            </button>
          )}
          <button onClick={onCancel} style={{ padding:"10px 14px", borderRadius:6, background:"#111", border:"1px solid #666", color:"#ddd", cursor:"pointer", fontSize:12 }}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
