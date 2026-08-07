import { useState, useRef, useEffect, useLayoutEffect, useCallback, useSyncExternalStore } from "react";
import { CIV, CIVS, CARD_TYPE_LABELS } from "../constants";
import { getCardCivs, makeCardBg, cardDisplayName } from "../gameLogic";
import { CardEffectText } from "../components/EffectText";

// ===========================
// DECK EDITOR
// ===========================
// スマホ: ヘッダー / 枚数 / デッキ / 一覧 / 検索 / 詳細 の縦積み。
// PC:     ヘッダーと枚数は全幅。その下を左右に割り、
//           左 = デッキ（全高）
//           右 = 上が能力、下が一覧＋検索
//         .sidecol / .detail-slot をスマホでは display:contents にして
//         右列の入れ物を消し、上の縦積み順に戻す。
const COLS = 8;   // デッキの横列は8枚固定（デッキ全体を一目で見るため）
const GAP = 4;
const MAX_COPIES = 4;
const DECK_SIZE = 40;

const CSS = `
.deck-editor{--ground:#04040e; --panel:#0a0a18; --panel-2:#0d0d1c;
  --line:#2a1a4a; --line-soft:#1a1a2e; --ink:#e8e8f4; --ink-2:#8a8aa8; --ink-3:#4a4a68;
  --gold:#ffe066; --danger:#ff6b6b; --confirm:#44ff88;
  --sans:'Noto Sans JP','Hiragino Sans','Segoe UI',system-ui,sans-serif;
  background:var(--ground);color:var(--ink);font-family:var(--sans);
  display:flex;flex-direction:column;font-size:14px;line-height:1.5}

/* ---------- スクロールバー ----------
   Chrome/Edge/Safari は ::-webkit-scrollbar で1px単位まで指定できる。
   Firefox には scrollbar-width と scrollbar-color しかない。
   Chrome は scrollbar-color を書くと ::-webkit-scrollbar を無視するので、
   標準プロパティは疑似要素が使えないブラウザにだけ当てる。 */
.deck-editor .scroll{--track:#080814; --thumb:#4a3480; --thumb-hi:#6b4dbb}
.deck-editor .scroll::-webkit-scrollbar{width:11px;height:11px}
.deck-editor .scroll::-webkit-scrollbar-track{background-color:var(--track)}
.deck-editor .scroll::-webkit-scrollbar-thumb{background-color:var(--thumb);
  border:3px solid var(--track);border-radius:99px;background-clip:padding-box}
.deck-editor .scroll::-webkit-scrollbar-thumb:hover{background-color:var(--thumb-hi);border-width:2px}
.deck-editor .scroll::-webkit-scrollbar-thumb:active{background-color:var(--gold)}
@supports not selector(::-webkit-scrollbar){
  .deck-editor .scroll{scrollbar-width:thin;scrollbar-color:var(--thumb-hi) var(--track)}
}

/* ---------- レイアウト ---------- */
.deck-editor .main{display:flex;flex-direction:column;min-height:0}
.deck-editor .sidecol,.deck-editor .detail-slot{display:contents}

/* ---------- ヘッダー ---------- */
.deck-editor .top{display:flex;align-items:center;gap:9px;padding:10px 14px;
  background:linear-gradient(90deg,#08001a,#100520,#08001a);border-bottom:1px solid var(--line)}
.deck-editor .top .ttl{font-family:'Cinzel',serif;font-size:14px;letter-spacing:.1em;
  color:var(--gold);white-space:nowrap}
.deck-editor .namein{flex:1;min-width:80px;background:#050510;border:1px solid var(--line);
  border-radius:7px;color:var(--ink);font-family:var(--sans);font-size:13px;padding:7px 10px}
.deck-editor .namein:focus{outline:none;border-color:var(--gold)}
.deck-editor .act{padding:7px 12px;background:transparent;border:1px solid var(--line);
  border-radius:7px;color:var(--ink-2);font-family:var(--sans);font-size:12px;
  cursor:pointer;white-space:nowrap;transition:.15s}
.deck-editor .act:hover:not(:disabled){color:var(--ink);border-color:#4a3a7a;background:rgba(255,255,255,.03)}
.deck-editor .act.danger:hover{color:var(--danger);border-color:rgba(255,107,107,.5)}
.deck-editor .act.save{color:var(--confirm);border-color:rgba(68,255,136,.45)}
.deck-editor .act.save:hover:not(:disabled){background:rgba(68,255,136,.1);color:var(--confirm)}
.deck-editor .act:disabled{opacity:.35;cursor:not-allowed}
/* スマホは横幅が足りずデッキ名が数文字しか見えないので、名前だけ2段目に落とす */
@media (max-width:899px){
  .deck-editor .top{flex-wrap:wrap}
  .deck-editor .namein{order:1;flex:1 1 100%}
}

/* ---------- 枚数バー ---------- */
.deck-editor .count{display:flex;align-items:baseline;gap:9px;padding:8px 14px;
  background:var(--panel);border-bottom:1px solid var(--line-soft)}
.deck-editor .count .lbl{font-size:11px;letter-spacing:.16em;color:var(--ink-2)}
.deck-editor .count .num{font-size:21px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
.deck-editor .count .num.full{color:var(--confirm);text-shadow:0 0 10px rgba(68,255,136,.4)}
.deck-editor .count .of{font-size:11px;color:var(--ink-3)}
.deck-editor .civbar{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
.deck-editor .civchip{display:flex;align-items:center;gap:3px;padding:1px 6px;border-radius:4px;
  font-size:10px;font-variant-numeric:tabular-nums;border:1px solid}
.deck-editor .civchip i{font-style:normal;font-weight:900;font-size:9px}

/* ---------- デッキ ---------- */
.deck-editor .deckzone{flex:0 1 auto;min-height:0;overflow-y:auto;padding:10px 12px 14px}
.deck-editor .grid{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:${GAP}px}
.deck-editor .grid .card{width:100%}
.deck-editor .empty{padding:44px 12px;text-align:center;color:var(--ink-3);font-size:12px;
  border:1px dashed var(--line);border-radius:10px}
/* スマホのデッキ側はカードが47px程度しかないので、種別が折り返さないよう1段小さくする */
@media (max-width:899px){.deck-editor .grid .card .ft{font-size:6px}}

/* ---------- カード一覧 ---------- */
.deck-editor .pool{background:var(--panel-2);border-top:1px solid var(--line)}
.deck-editor .poolhead{display:flex;align-items:center;gap:8px;padding:7px 14px 4px}
.deck-editor .poolhead .lbl{font-size:11px;letter-spacing:.16em;color:var(--ink-2)}
.deck-editor .poolhead .hint{margin-left:auto;font-size:10px;color:var(--ink-3)}
.deck-editor .strip{display:flex;gap:6px;overflow-x:auto;padding:2px 14px 10px}
.deck-editor .strip .card{flex:0 0 auto;width:66px}
.deck-editor .noresult{padding:26px 14px;color:var(--ink-3);font-size:12px}

/* ---------- 検索 ---------- */
.deck-editor .searchbar{display:flex;gap:8px;align-items:center;padding:10px 14px;
  background:var(--panel);border-top:1px solid var(--line-soft)}
.deck-editor .field{flex:1;display:flex;align-items:center;gap:8px;padding:0 12px;
  background:#050510;border:1px solid var(--line);border-radius:9px;transition:.15s}
.deck-editor .field:focus-within{border-color:var(--gold);box-shadow:0 0 0 3px rgba(255,224,102,.12)}
.deck-editor .field svg{width:15px;height:15px;stroke:var(--ink-3);fill:none;stroke-width:2;flex-shrink:0}
.deck-editor .field input{flex:1;min-width:0;background:none;border:none;outline:none;
  color:var(--ink);font-family:var(--sans);font-size:14px;padding:9px 0}
.deck-editor .field input::placeholder{color:var(--ink-3)}
/* ブラウザ標準のクリアボタンは自前の✕と二重になるので消す */
.deck-editor .field input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}
.deck-editor .clearbtn{flex-shrink:0;background:none;border:none;color:var(--ink-3);
  cursor:pointer;font-size:15px;line-height:1;padding:6px;margin-right:-4px;border-radius:4px}
.deck-editor .clearbtn:hover{color:var(--ink)}

/* ---------- カード ---------- */
.deck-editor .card{position:relative;aspect-ratio:52/72;border-radius:6px;border:1.5px solid;
  display:flex;flex-direction:column;padding:2px 3px;cursor:pointer;user-select:none;
  transition:transform .12s;overflow:hidden;font-family:var(--sans)}
.deck-editor .card:hover{transform:translateY(-4px);z-index:2}
.deck-editor .card.sel{outline:2px solid var(--gold);outline-offset:1px}
.deck-editor .card .row{display:flex;justify-content:space-between;align-items:flex-start;gap:2px}
.deck-editor .card .cost{font-size:9px;font-weight:700;color:#fff;border-radius:3px;
  padding:0 3px;line-height:14px}
.deck-editor .card .civs{display:flex;gap:1px}
.deck-editor .card .civs i{font-style:normal;font-size:7px;font-weight:900;border-radius:2px;
  padding:0 2px;line-height:12px}
.deck-editor .card .nm{flex:1;display:flex;align-items:center;justify-content:center;
  text-align:center;font-size:6.5px;font-weight:700;line-height:1.15;color:#fff;
  overflow:hidden;word-break:break-all;padding:2px 0;text-shadow:0 1px 3px rgba(0,0,0,.9)}
.deck-editor .card .ft{font-size:7px;font-weight:700;text-align:center;padding-top:2px;
  border-top:1px solid rgba(255,255,255,.14);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.deck-editor .card .qty{position:absolute;top:-1px;right:-1px;min-width:15px;height:15px;
  padding:0 3px;border-radius:0 5px 0 6px;background:var(--gold);color:#000;font-size:9.5px;
  font-weight:900;display:flex;align-items:center;justify-content:center;
  font-variant-numeric:tabular-nums}
.deck-editor .card .qty.full{background:var(--confirm)}

/* ---------- 詳細パネル ---------- */
.deck-editor .detail{display:flex;flex-direction:column;background:var(--panel-2);
  border-top:1px solid var(--line);min-height:0}
.deck-editor .detail .none{padding:34px 16px;text-align:center;color:var(--ink-3);font-size:12px}
.deck-editor .dhead{padding:12px 14px 10px;border-bottom:1px solid var(--line-soft)}
.deck-editor .dname{font-size:15px;font-weight:700;line-height:1.35;color:#fff}
.deck-editor .dmeta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:7px}
.deck-editor .pill{font-size:10.5px;padding:1px 7px;border-radius:4px;border:1px solid;
  font-variant-numeric:tabular-nums}
.deck-editor .drace{margin-top:6px;font-size:11px;color:var(--ink-2)}
/* 能力文が縦を超えたらここだけスクロールする */
.deck-editor .dbody{flex:1;min-height:0;overflow-y:auto;padding:11px 14px 14px}
@media (max-width:899px){.deck-editor .dbody{max-height:230px}}
.deck-editor .qtybar{display:flex;align-items:center;gap:10px;padding:10px 14px;
  border-top:1px solid var(--line);background:var(--panel)}
.deck-editor .qtybar .lbl{font-size:11px;color:var(--ink-2)}
.deck-editor .qbtn{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);
  background:#050510;color:var(--ink);font-size:19px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:.15s;font-family:var(--sans)}
.deck-editor .qbtn:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
.deck-editor .qbtn:disabled{opacity:.3;cursor:not-allowed}
.deck-editor .qnum{min-width:56px;text-align:center;font-size:17px;font-weight:700;
  font-variant-numeric:tabular-nums}
.deck-editor .qnum small{font-size:11px;color:var(--ink-3);font-weight:400}
.deck-editor .qnum.full{color:var(--confirm)}

@media (min-width:900px){
  .deck-editor{overflow:hidden}
  .deck-editor .main{flex:1;flex-direction:row;min-height:0;border-bottom:1px solid var(--line)}
  .deck-editor .deckcol{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
  .deck-editor .deckzone{flex:1}
  .deck-editor .sidecol{display:flex;flex-direction:column;min-height:0;min-width:0;
    flex:0 0 clamp(380px,42%,760px);border-left:1px solid var(--line)}
  /* 能力は右列の上。スクロールは中の .dbody だけに持たせる（二重スクロール防止） */
  .deck-editor .detail-slot{display:block;flex:1 1 auto;min-height:0;overflow:hidden;
    background:var(--panel-2)}
  .deck-editor .detail{border-top:none;height:100%}
  .deck-editor .sidecol .pool,.deck-editor .sidecol .searchbar{flex:0 0 auto}

  /* カードの大きさは「全部の行が縦に収まること」から逆算し、JSが --cw に入れる。
     一覧のカードより大きくしても読みやすくならないので上限も設ける */
  .deck-editor .grid{grid-template-columns:repeat(${COLS},var(--cw,1fr));justify-content:center}
  /* 文字はカードの大きさに比例させる。小さいカードに大きい字は入らないし、
     大きいカードに6.5pxだと余白に文字が浮いて見える */
  .deck-editor .grid .card .nm{font-size:clamp(6px,calc(var(--cw,66px)*.12),12px)}
  .deck-editor .grid .card .cost{font-size:clamp(7px,calc(var(--cw,66px)*.11),12px);line-height:1.55}
  .deck-editor .grid .card .civs i{font-size:clamp(5.5px,calc(var(--cw,66px)*.085),10px);line-height:1.6}
  .deck-editor .grid .card .ft{font-size:clamp(5.5px,calc(var(--cw,66px)*.085),10px)}

  /* 縦が短い窓では一覧も小さくする。主役はデッキなので、そちらに高さを譲る */
  .deck-editor .strip .card{width:clamp(58px,10vh,88px)}
  .deck-editor .strip .card .nm{font-size:clamp(7.5px,1vh,9px);padding:3px 1px}
  .deck-editor .strip .card .cost{font-size:clamp(8.5px,1.1vh,10px);line-height:1.55;padding:0 4px}
  .deck-editor .strip .card .civs i{font-size:clamp(6.5px,.9vh,8px);line-height:1.6;padding:0 3px}
  .deck-editor .strip .card .ft{font-size:clamp(6.5px,.9vh,8.5px)}
  .deck-editor .strip .card .qty{min-width:17px;height:17px;font-size:10.5px}
}
`;

// PCかどうか。詳細パネルの差し込み先（デッキの右／検索の下）を切り替えるのに使う。
// メディアクエリはReactの外の状態なので useSyncExternalStore で購読する
const PC_MQ="(min-width:900px)";
const subscribePC=cb=>{
  const mq=window.matchMedia(PC_MQ);
  mq.addEventListener("change",cb);
  return ()=>mq.removeEventListener("change",cb);
};
function useIsPC(){
  return useSyncExternalStore(subscribePC,()=>window.matchMedia(PC_MQ).matches,()=>false);
}

function DeckCard({card,qty,selected,onClick}){
  const civs=getCardCivs(card);
  const main=CIV[civs[0]]||CIV.fire;
  const dn=cardDisplayName(card);
  return (
    <button type="button" className={"card"+(selected?" sel":"")} onClick={onClick}
      title={dn} style={{ background:makeCardBg(civs), borderColor:main.color }}>
      <div className="row">
        <span className="cost" style={{ background:main.color }}>{card.cost}</span>
        <span className="civs">{civs.map(cv=>CIV[cv]?(
          <i key={cv} style={{ color:CIV[cv].textColor, background:`${CIV[cv].color}44` }}>{CIV[cv].label}</i>
        ):null)}</span>
      </div>
      <div className="nm">{dn.length>22?dn.slice(0,21)+"…":dn}</div>
      {/* デッキ編集ではパワーよりも「何のカードか」が知りたいので、下段は種別を出す */}
      <div className="ft" style={{ color:main.textColor }}>{CARD_TYPE_LABELS[card.type]||card.type}</div>
      {qty>0&&<span className={"qty"+(qty>=MAX_COPIES?" full":"")}>{qty}</span>}
    </button>
  );
}

export function DeckEditor({cardDb,initialIds,initialName,onSave,onCancel}){
  const [name,setName]=useState(initialName||"新しいデッキ");
  const [counts,setCounts]=useState(()=>{
    const c={};(initialIds||[]).forEach(id=>{c[id]=(c[id]||0)+1;});return c;
  });
  const [search,setSearch]=useState("");
  const [pickedId,setPickedId]=useState(()=>(initialIds||[])[0]??null);
  const isPC=useIsPC();
  const zoneRef=useRef(null), gridRef=useRef(null), stripRef=useRef(null);

  const byId={};cardDb.forEach(c=>{byId[c.id]=c;});
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const countOf=id=>counts[id]||0;
  const add=id=>{
    if(countOf(id)>=MAX_COPIES||total>=DECK_SIZE)return;
    setCounts(c=>({...c,[id]:(c[id]||0)+1}));
  };
  const remove=id=>{
    if(countOf(id)===0)return;
    setCounts(c=>({...c,[id]:c[id]-1}));
  };
  const deckIds=[];
  Object.entries(counts).forEach(([id,cnt])=>{for(let i=0;i<cnt;i++)deckIds.push(Number(id));});

  // デッキ表示は文明順→コスト順→名前順。同じカードは枚数ぶん並べる
  const deckCards=[];
  Object.keys(counts).map(Number).filter(id=>counts[id]>0&&byId[id])
    .map(id=>byId[id])
    .sort((a,b)=>CIVS.indexOf(getCardCivs(a)[0])-CIVS.indexOf(getCardCivs(b)[0])
      ||a.cost-b.cost||cardDisplayName(a).localeCompare(cardDisplayName(b),"ja"))
    .forEach(c=>{for(let i=0;i<counts[c.id];i++)deckCards.push(c);});

  const q=search.trim();
  const hits=q?cardDb.filter(c=>cardDisplayName(c).includes(q)):cardDb;
  const picked=pickedId!=null?byId[pickedId]:null;

  // 文明の内訳。ツインパクトはマナゾーンで両面の文明を持つので、両方を数える
  const tally={};
  deckIds.forEach(id=>{
    const c=byId[id];if(!c)return;
    const set=new Set(getCardCivs(c));
    if(c.spellSide?.civ!=null) getCardCivs({civ:c.spellSide.civ}).forEach(x=>set.add(x));
    set.forEach(cv=>{tally[cv]=(tally[cv]||0)+1;});
  });

  // デッキのカード1枚の幅を決める。横8枚は固定なので、決まるのは
  // 「全部の行が枠の高さに収まる大きさ」。スマホは今のまま（幅いっぱい）にする。
  const fitDeck=useCallback(()=>{
    const zone=zoneRef.current, g=gridRef.current;
    if(!zone||!g)return;
    if(!window.matchMedia("(min-width:900px)").matches){g.style.removeProperty("--cw");return;}
    const st=getComputedStyle(zone);
    const availW=zone.clientWidth -parseFloat(st.paddingLeft)-parseFloat(st.paddingRight);
    const availH=zone.clientHeight-parseFloat(st.paddingTop) -parseFloat(st.paddingBottom);
    const rows=Math.ceil(g.children.length/COLS)||1;
    const byWidth =(availW-GAP*(COLS-1))/COLS;
    const byHeight=((availH-GAP*(rows-1))/rows)*52/72;   // カードの縦横比から幅に直す
    // 上限は一覧のカードより少し小さめ。下限（読める限界）を割る時だけスクロールを許す
    g.style.setProperty("--cw",Math.max(42,Math.min(byWidth,byHeight,96))+"px");
  },[]);

  useLayoutEffect(()=>{fitDeck();},[fitDeck,deckCards.length,isPC]);
  useEffect(()=>{
    const zone=zoneRef.current;
    if(!zone||typeof ResizeObserver==="undefined"){
      window.addEventListener("resize",fitDeck);
      return ()=>window.removeEventListener("resize",fitDeck);
    }
    const ro=new ResizeObserver(fitDeck);
    ro.observe(zone);
    return ()=>ro.disconnect();
  },[fitDeck]);

  // 一覧は横1列なので、マウスホイールの上下を横スクロールに割り当てる。
  // トラックパッドの横フリック（deltaX 主体）は素通しして、標準の挙動を壊さない。
  useEffect(()=>{
    const el=stripRef.current;
    if(!el)return;
    const onWheel=e=>{
      if(el.scrollWidth<=el.clientWidth)return;
      if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
      // deltaMode: 0=px / 1=行 / 2=ページ。行・ページ指定のブラウザ向けに px へ直す
      const px=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*el.clientWidth:e.deltaY;
      const before=el.scrollLeft;
      el.scrollLeft=before+px;
      // 端まで来たらページ側のスクロールに譲る
      if(el.scrollLeft!==before)e.preventDefault();
    };
    el.addEventListener("wheel",onWheel,{passive:false});
    return ()=>el.removeEventListener("wheel",onWheel);
  },[]);

  const pill=(txt,cv)=>(
    <span key={txt} className="pill" style={{
      color:CIV[cv].textColor, borderColor:`${CIV[cv].color}66`, background:`${CIV[cv].color}14`,
    }}>{txt}</span>
  );

  const detail=(()=>{
    if(!picked) return <div className="detail"><div className="none">カードを選ぶと、ここに内容が出ます。</div></div>;
    const civs=getCardCivs(picked);
    const n=countOf(picked.id);
    // ツインパクトもクリーチャーなのでパワーを持つ
    const hasPower=picked.type==="creature"||picked.type==="evo_creature"||picked.type==="twinpact";
    return (
      <div className="detail">
        <div className="dhead">
          <div className="dname">{cardDisplayName(picked)}</div>
          <div className="dmeta">
            {pill("コスト "+picked.cost,civs[0])}
            {hasPower&&pill("パワー "+(picked.power??0),civs[0])}
            {civs.map(cv=>CIV[cv]?pill(CIV[cv].label,cv):null)}
            <span className="pill" style={{ color:"var(--ink-2)", borderColor:"var(--line)" }}>
              {CARD_TYPE_LABELS[picked.type]||picked.type}
            </span>
          </div>
          {picked.race&&<div className="drace">{picked.race}</div>}
        </div>
        <div className="dbody scroll"><CardEffectText card={picked}/></div>
        <div className="qtybar">
          <span className="lbl">デッキ中</span>
          <button className="qbtn" onClick={()=>remove(picked.id)} disabled={n===0} aria-label="1枚減らす">−</button>
          <span className={"qnum"+(n>=MAX_COPIES?" full":"")}>{n}<small> / {MAX_COPIES}</small></span>
          <button className="qbtn" onClick={()=>add(picked.id)}
            disabled={n>=MAX_COPIES||total>=DECK_SIZE} aria-label="1枚増やす">＋</button>
        </div>
      </div>
    );
  })();

  return (
    <div className="fullscreen-panel deck-editor" style={{ zIndex:600 }}>
      <style>{CSS}</style>

      <header className="top">
        <span className="ttl">デッキ編集</span>
        <input className="namein" value={name} onChange={e=>setName(e.target.value)}
          placeholder="デッキ名" aria-label="デッキ名"/>
        <button className="act danger" onClick={()=>{if(total>0&&confirm(`デッキの${total}枚をすべて削除します。よろしいですか？`))setCounts({});}}
          disabled={total===0}>全削除</button>
        <button className="act save" onClick={()=>onSave({name,ids:deckIds})}
          disabled={total!==DECK_SIZE}>保存</button>
        <button className="act" onClick={onCancel}>キャンセル</button>
      </header>

      <div className="count">
        <span className="lbl">メイン</span>
        <span className={"num"+(total===DECK_SIZE?" full":"")}>{total}</span>
        <span className="of">/ {DECK_SIZE}</span>
        <div className="civbar">
          {CIVS.filter(cv=>tally[cv]).map(cv=>(
            <span key={cv} className="civchip" style={{
              color:CIV[cv].textColor, borderColor:`${CIV[cv].color}55`, background:`${CIV[cv].color}14`,
            }}><i>{CIV[cv].label}</i>{tally[cv]}</span>
          ))}
        </div>
      </div>

      <div className="main">
        <div className="deckcol">
          <div className="deckzone scroll" ref={zoneRef}>
            {deckCards.length===0
              ? <div className="empty">デッキが空です。下の一覧からカードを選んでください。</div>
              : <div className="grid" ref={gridRef}>
                  {deckCards.map((c,i)=>(
                    <DeckCard key={`${c.id}-${i}`} card={c} qty={0}
                      selected={pickedId===c.id} onClick={()=>setPickedId(c.id)}/>
                  ))}
                </div>}
          </div>
        </div>

        {/* PCでは右列（上=能力 / 下=一覧＋検索）。スマホでは display:contents で
            入れ物が消え、デッキ→一覧→検索→能力 の縦積みに戻る */}
        <div className="sidecol">
          <aside className="detail-slot">{isPC?detail:null}</aside>

          <section className="pool">
            <div className="poolhead">
              <span className="lbl">カード一覧</span>
              <span className="hint">{q?`「${q}」に一致 ${hits.length}枚`:`${cardDb.length}枚`}</span>
            </div>
            {hits.length===0
              ? <div className="noresult">一致するカードがありません。</div>
              : <div className="strip scroll" ref={stripRef}>
                  {hits.map(c=>(
                    <DeckCard key={c.id} card={c} qty={countOf(c.id)}
                      selected={pickedId===c.id} onClick={()=>setPickedId(c.id)}/>
                  ))}
                </div>}
          </section>

          <div className="searchbar">
            <div className="field">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
              <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="カード名" autoComplete="off" aria-label="カード名で検索"/>
              {search&&<button className="clearbtn" onClick={()=>setSearch("")} aria-label="検索をクリア">✕</button>}
            </div>
          </div>
        </div>
      </div>

      {!isPC&&detail}
    </div>
  );
}
