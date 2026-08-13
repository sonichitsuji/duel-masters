import { CIV, EFFECT_TYPE_LABELS } from "../../constants";
import { getCardCivs } from "../../gameLogic";

// いま解決を待っている能力を一覧表示し、そこから1つ選ばせるモーダル。
// リゾルバが「ターンプレイヤー優先」で抽出した群（entries）を並べる。
// 順番をまとめて決めるのではなく毎回1つだけ選ぶので、解決の途中で新しく誘発した能力
// （出たクリーチャーの cip など）も、次に開いた時には同じ一覧に並ぶ。
// 解決前に「何が起きるのか」を確認できるよう、能力の中身を行単位で書き出す。
// 現行の記法は effects 配列。steps は旧記法、type 直書きは単発効果。
function stepLine(st){
  if(!st) return null;
  const label=st.label||EFFECT_TYPE_LABELS[st.type]||st.type;
  // label が既に「〜てもよい」で終わっているなら重ねて付けない
  return st.optional&&!/てもよい/.test(label||"") ? `${label}（してもよい）` : label;
}
function describe(entry){
  const eff=entry.effect||{};
  if(eff.type==="chooseTimes"){
    const names=(eff.templates||[]).map(t=>t.label||t.name).filter(Boolean);
    return [`${eff.count||1}回、次から選んで実行`, ...names.map(n=>`・${n}`)];
  }
  const list=eff.effects||eff.steps;
  if(Array.isArray(list)&&list.length) return list.map(stepLine).filter(Boolean);
  const one=stepLine(eff);
  return one?[one]:["効果"];
}

export function TriggerOrderModal({ entries, onChoose, onDecline, onDeclineAll }) {
  if(!entries||entries.length===0) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:420, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#0a0a1e,#08080f)", border:"2px solid #ffe066", borderRadius:14, padding:20, maxWidth:460, width:"100%", boxShadow:"0 0 30px #ffe06655" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#ffe066", fontSize:13, fontWeight:900, marginBottom:4, letterSpacing:2 }}>解決する能力を選択</div>
        <div style={{ fontSize:11, color:"#aaa", marginBottom:12 }}>いま解決を待っている能力です（ターンプレイヤーの能力から）。1つ選ぶとそれだけを解決し、そのあと新しく誘発した能力も含めてまた選び直します。「〜してもよい」の能力は発動しないことも選べます。</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {entries.map(entry=>{
            const civs=getCardCivs(entry.srcCard||{civ:"fire"});
            const c=CIV[civs[0]]||CIV.fire;
            const isOptional = !!entry.effect?.optional;
            const lines = describe(entry);
            return (
              <div key={entry.id} style={{ display:"flex", gap:6, alignItems:"stretch" }}>
                <button onClick={()=>onChoose(entry.id)} style={{ flex:1, textAlign:"left", padding:"10px 12px", borderRadius:8, border:`1px solid ${c.color}88`, background:`${c.color}14`, color:"#fff", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                    <span style={{ fontSize:10, fontWeight:900, color:c.textColor, background:`${c.color}33`, border:`1px solid ${c.color}66`, borderRadius:3, padding:"0 5px" }}>{civs.map(cv=>CIV[cv]?.label).join("")}</span>
                    <span style={{ fontWeight:700, fontSize:13 }}>{entry.srcCard?.name||entry.sourceName}</span>
                    {entry.onceLabel && <span style={{ fontSize:9, color:"#ffcc66", marginLeft:"auto" }}>{entry.onceLabel}</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#bbb", display:"flex", flexDirection:"column", gap:2 }}>
                    {lines.map((line,i)=>(
                      <div key={i} style={{ display:"flex", gap:5 }}>
                        {lines.length>1 && <span style={{ color:c.textColor, flexShrink:0 }}>{i+1}.</span>}
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </button>
                {isOptional && onDecline && (
                  <button onClick={()=>onDecline(entry.id)} title="この能力を発動しない" style={{ padding:"0 10px", borderRadius:8, background:"#1a1a2a", border:"1px solid #666", color:"#ddd", cursor:"pointer", fontSize:11, whiteSpace:"nowrap" }}>
                    発動しない
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {onDeclineAll && entries.some(e=>e.effect?.optional) && (
          <button onClick={onDeclineAll} style={{ marginTop:12, width:"100%", padding:"9px", borderRadius:6, background:"#1a1a2a", border:"1px solid #555", color:"#aaa", cursor:"pointer", fontSize:12 }}>
            すべて発動しない
          </button>
        )}
      </div>
    </div>
  );
}
