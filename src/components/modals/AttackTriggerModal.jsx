import { CIV } from "../../constants";
import { getCardCivs, displayPower, revolutionChangeCandidates } from "../../gameLogic";
import { CardFace } from "../CardFace";

// ===========================
// ATTACK TRIGGER MODAL
// 攻撃宣言時: 革命チェンジ・手札誘発・アタックトリガーを処理
// ===========================
export function AttackTriggerModal({ attacker, ownerState, onRevChange, onSkip }) {
  // 判定は gameLogic に集約してある（BattleScreen 側の提示判断と食い違わないように）
  const revChangeable = revolutionChangeCandidates(attacker, ownerState);

  if (revChangeable.length === 0) return null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:350, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"linear-gradient(160deg,#1a0505,#08080f)", border:"2px solid #ff6600", borderRadius:14, padding:20, maxWidth:360, width:"100%", boxShadow:"0 0 30px #ff660066" }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:"#ff8844", fontSize:14, fontWeight:900, marginBottom:4, letterSpacing:2 }}>革命チェンジ</div>
        <div style={{ fontSize:11, color:"#888", marginBottom:12 }}>
          <span style={{ color:"#fff", fontWeight:700 }}>{attacker.name}</span> が攻撃！<br/>
          以下のカードと革命チェンジできます。
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
          {revChangeable.map(c => {
            const civs = getCardCivs(c);
            const cv = CIV[civs[0]];
            return (
              <button key={c.uid} onClick={() => onRevChange(c)} style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                background:"rgba(255,100,0,0.1)", border:"1px solid #ff660055",
                borderRadius:8, cursor:"pointer", textAlign:"left",
              }}>
                <CardFace card={c} small />
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{c.name}</div>
                  <div style={{ fontSize:10, color:cv?.textColor }}>{c.race}</div>
                  <div style={{ fontSize:10, color:"#888" }}>コスト:{c.cost} / パワー:{displayPower(c)}</div>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={onSkip} style={{ width:"100%", padding:"9px", borderRadius:6, background:"#111", border:"1px solid #333", color:"#888", cursor:"pointer", fontSize:12 }}>
          チェンジしない → そのまま攻撃
        </button>
      </div>
    </div>
  );
}
