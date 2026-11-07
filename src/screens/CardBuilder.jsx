import { useMemo, useState } from "react";
import { ALL_KEYWORDS, CARD_TYPE_LABELS, CIV, CIVS, KEYWORD_LABELS } from "../constants";
import {
  ENUMS, TRIGGER_KEY_SCHEMA, TRIGGER_SCHEMA, buildCardJson, defaultValueFor,
  keyLabel, triggerKeysFor,
} from "../cardSchema";
import { Chip, Field, JsonArea, Picker, ScalarInput, Sel } from "../components/FormBits";
import { FilterEditor } from "../components/FilterEditor";
import { StepList } from "../components/StepBlock";
import { mkCardId, syncCardIdSeed } from "../gameLogic";

// ===========================
// CARD BUILDER
// ===========================
// 効果をブロックで組み立てるカードエディタ。
//
// 語彙（効果の種類・書けるキー・選択肢）はすべて src/cardSchema.js が持っていて、
// この画面はそれを読んでフォームを描くだけ。型ごとの分岐をここに書かない。
//
// 出力は右（スマホでは下）のパネルに常に出ていて、そのままコピーして
// scripts/add-card.mjs に通せる形にしてある。
// 画面で保存すれば localStorage のカードDBに入り、デッキに組める。

const CSS = `
.card-builder{--ground:#04040e; --panel:#0a0a18; --panel-2:#0d0d1c; --sunken:#070711;
  --line:#2a1a4a; --line-soft:#1a1a2e; --ink:#e8e8f4; --ink-2:#8a8aa8; --ink-3:#4a4a68;
  --gold:#ffe066; --danger:#ff6b6b; --confirm:#44ff88; --water:#4aa3ff;
  --sans:'Noto Sans JP','Hiragino Sans','Segoe UI',system-ui,sans-serif;
  --display:'Cinzel',Georgia,serif;
  --mono:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
  background:var(--ground);color:var(--ink);font-family:var(--sans);
  font-size:14px;line-height:1.6;display:flex;flex-direction:column}
.card-builder *{box-sizing:border-box}
.card-builder button{font-family:inherit;font-size:inherit;color:inherit;cursor:pointer}
.card-builder input,.card-builder select,.card-builder textarea{font-family:inherit;font-size:inherit}
.card-builder :focus-visible{outline:2px solid var(--gold);outline-offset:2px}

/* ---------- スクロールバー（DeckEditor と同じ作法）---------- */
.card-builder .scroll{--track:#080814; --thumb:#4a3480; --thumb-hi:#6b4dbb}
.card-builder .scroll::-webkit-scrollbar{width:11px;height:11px}
.card-builder .scroll::-webkit-scrollbar-track{background-color:var(--track)}
.card-builder .scroll::-webkit-scrollbar-thumb{background-color:var(--thumb);
  border:3px solid var(--track);border-radius:99px;background-clip:padding-box}
.card-builder .scroll::-webkit-scrollbar-thumb:hover{background-color:var(--thumb-hi);border-width:2px}
@supports not selector(::-webkit-scrollbar){
  .card-builder .scroll{scrollbar-width:thin;scrollbar-color:var(--thumb) var(--track)}
}

/* ---------- ヘッダー ---------- */
.card-builder > header{background:linear-gradient(90deg,#08001a,#100520);
  border-bottom:1px solid var(--line);padding:10px 14px;
  display:flex;align-items:center;gap:9px;flex-wrap:wrap;flex:none}
.card-builder > header .ttl{font-family:var(--display);font-size:15px;color:var(--gold);letter-spacing:.04em}
.card-builder .spacer{flex:1}
.card-builder .muted{color:var(--ink-3);font-size:10px;font-style:normal}

/* ---------- ボタン ---------- */
.card-builder .btn{background:var(--panel-2);border:1px solid var(--line);border-radius:6px;
  padding:5px 11px;font-size:12px;color:var(--ink-2)}
.card-builder .btn:hover{border-color:var(--ink-3);color:var(--ink)}
.card-builder .btn.gold{background:rgba(255,224,102,.12);border-color:#ffe06655;color:var(--gold);font-weight:700}
.card-builder .btn.ghost{background:none;border-color:var(--line-soft);color:var(--ink-3);padding:3px 8px;font-size:11px}
.card-builder .btn.ghost:hover{color:var(--ink-2);border-color:var(--ink-3)}
.card-builder .btn.picker{color:var(--ink-2);max-width:100%}
.card-builder .icon{background:none;border:1px solid var(--line-soft);border-radius:5px;color:var(--ink-3);
  width:26px;height:26px;display:grid;place-items:center;font-size:12px;padding:0;flex:none}
.card-builder .icon:hover{color:var(--ink);border-color:var(--ink-3)}
.card-builder .icon.danger:hover{color:var(--danger);border-color:#ff6b6b55}
.card-builder .icon[disabled]{opacity:.3;cursor:not-allowed}

/* ---------- レイアウト ----------
   スマホは縦1列。980px から左右2列にして、右のJSONを画面に貼り付ける。 */
/* align-items は既定の stretch のまま。右の列を行の高さいっぱいに伸ばさないと、
   中の JSON パネルの position:sticky が効く余地が無くなる。 */
.card-builder .wrap{flex:1;overflow-y:auto;padding:14px;
  display:grid;grid-template-columns:1fr;gap:14px}
@media (min-width:980px){
  .card-builder .wrap{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)}
  .card-builder .jsonwrap{position:sticky;top:0}
}
.card-builder .col{display:flex;flex-direction:column;gap:14px;min-width:0}
.card-builder .box{background:var(--panel);border:1px solid var(--line-soft);border-radius:10px;min-width:0}
.card-builder .box > h2{font-size:11px;letter-spacing:.14em;color:var(--ink-2);font-weight:700;margin:0;
  padding:9px 13px;border-bottom:1px solid var(--line-soft);display:flex;align-items:center;gap:8px}
.card-builder .box > .body{padding:13px;display:flex;flex-direction:column;gap:11px}

/* ---------- フォーム ---------- */
.card-builder .row{display:flex;gap:9px;flex-wrap:wrap}
/* 縦に積む時は伸びない。横並び（.row）の中でだけ均等に伸ばす */
.card-builder .f{display:flex;flex-direction:column;gap:4px;min-width:0;flex:0 0 auto}
.card-builder .row > .f{flex:1 1 110px}
.card-builder .f > span{font-size:10px;letter-spacing:.08em;color:var(--ink-3)}
.card-builder .f > span > i{color:var(--ink-3);opacity:.7;font-family:var(--mono);font-style:normal}
.card-builder .f input,.card-builder .f select,.card-builder .f textarea{
  background:var(--sunken);border:1px solid var(--line-soft);border-radius:6px;
  color:var(--ink);padding:6px 9px;font-size:13px;width:100%;min-width:0}
.card-builder .f input:focus,.card-builder .f select:focus,.card-builder .f textarea:focus{
  border-color:#4a3480;outline:none}
.card-builder .f textarea{resize:vertical;line-height:1.6}
.card-builder .f input[type=number]{font-variant-numeric:tabular-nums}
.card-builder .chips{display:flex;gap:5px;flex-wrap:wrap}
.card-builder .chip{background:var(--sunken);border:1px solid var(--line-soft);border-radius:999px;
  padding:3px 10px;font-size:11px;color:var(--ink-3)}
.card-builder .chip[aria-pressed=true]{border-color:#ffe06688;background:rgba(255,224,102,.12);color:var(--gold)}
.card-builder .chip.civ[aria-pressed=true]{border-color:currentColor;
  background:color-mix(in srgb,currentColor 14%,transparent)}
.card-builder .hint{font-size:10.5px;color:var(--ink-3);line-height:1.55;margin:0}
.card-builder .warn{font-size:10.5px;color:var(--danger);line-height:1.55}

/* ---------- 能力（トリガー） ---------- */
.card-builder .trig{border:1px solid var(--line);border-radius:9px;background:var(--panel-2);overflow:hidden}
.card-builder .trig > header{display:flex;align-items:center;gap:7px;padding:8px 10px;
  background:rgba(42,26,74,.3);flex-wrap:wrap}
.card-builder .trig > header select{background:var(--sunken);border:1px solid var(--line);border-radius:6px;
  color:var(--gold);padding:4px 8px;font-size:12px;font-weight:700;max-width:100%}
.card-builder .trig > .body{display:flex;flex-direction:column;gap:9px;padding:9px 10px 10px}

/* ---------- ステップ（ブロック） ---------- */
.card-builder .steps{display:flex;flex-direction:column;gap:7px}
.card-builder .steps.nested{padding-top:2px}
.card-builder .step{border:1px solid var(--line-soft);border-radius:8px;background:var(--panel);overflow:hidden}
.card-builder .step.open{border-color:#4a3480}
.card-builder .step > header{display:flex;align-items:center;gap:7px;padding:7px 8px 7px 10px}
.card-builder .step .no{font-variant-numeric:tabular-nums;font-size:11px;color:var(--ink-3);
  font-weight:700;flex:none;width:16px}
.card-builder .step .ttl{flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;text-align:left;background:none;border:none;padding:0}
.card-builder .step .ttl em{font-style:normal;color:var(--ink-3)}
.card-builder .step .kind{font-size:10px;color:var(--water);background:rgba(74,163,255,.1);
  border-radius:4px;padding:1px 6px;flex:none}
.card-builder .step .kind.unknown{color:var(--danger);background:rgba(255,107,107,.1)}
.card-builder .step .fields{padding:2px 10px 11px;display:flex;flex-direction:column;gap:9px;
  border-top:1px solid var(--line-soft)}
.card-builder textarea.raw{font-family:var(--mono);font-size:12px;line-height:1.55;width:100%;
  background:var(--sunken);border:1px solid var(--line-soft);border-radius:6px;
  color:var(--ink);padding:6px 9px;resize:vertical}

.card-builder .keyline{display:flex;align-items:flex-start;gap:7px}
.card-builder .keyline > .f{flex:1}
.card-builder .keyline > .icon{margin-top:17px}
.card-builder .nest{border-left:2px solid var(--line);padding-left:9px;
  display:flex;flex-direction:column;gap:7px;flex:1;min-width:0}
.card-builder .nesthead{font-size:10px;letter-spacing:.08em;color:var(--ink-3);
  display:flex;align-items:center;gap:7px}
.card-builder .filter{display:flex;flex-direction:column;gap:7px}

/* ---------- JSON ---------- */
.card-builder pre.json{margin:0;padding:12px;background:var(--sunken);border-radius:0 0 10px 10px;
  font-family:var(--mono);font-size:11.5px;line-height:1.55;color:#cfd4e8;
  overflow:auto;max-height:min(58vh,520px);tab-size:2;
  /* 効果テキストのような長い行は、横スクロールにせず折り返す */
  white-space:pre-wrap;overflow-wrap:anywhere}
.card-builder pre.json .k{color:#9ecbff}
.card-builder pre.json .s{color:#b7e29a}
.card-builder pre.json .n{color:#ffd080}
.card-builder pre.json .b{color:#e3a7ff}
.card-builder .toast{position:fixed;left:50%;transform:translateX(-50%);bottom:24px;
  background:var(--confirm);color:#06240f;font-weight:700;font-size:12px;padding:8px 16px;
  border-radius:999px;z-index:20;box-shadow:0 6px 20px rgba(0,0,0,.5)}
`;

const blankCard = () => ({
  name: "", race: "", cost: 1, power: 1000, type: "creature",
  civ: "fire", keywords: [], effect: "", triggers: [],
});

const civList = civ => (civ == null ? [] : Array.isArray(civ) ? civ : [civ]);

// JSON を色分けして出すだけのビュー。キー / 文字列 / 数値 / 真偽 を塗り分ける
function JsonView({ text }) {
  const parts = useMemo(() => {
    const re = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?)|(true|false|null)/g;
    const out = [];
    let last = 0, m, i = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(<span key={i++} className={m[1] ? "k" : m[2] ? "s" : m[3] ? "n" : "b"}>{m[0]}</span>);
      last = m.index + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  }, [text]);
  return <pre className="json scroll">{parts}</pre>;
}

// 能力1つぶん（トリガー）
function TriggerBlock({ trigger, onChange, onRemove }) {
  const def = TRIGGER_SCHEMA[trigger.on];
  const keys = triggerKeysFor(trigger.on);
  const used = keys.filter(([k]) => trigger[k] !== undefined);
  const unused = keys.filter(([k]) => trigger[k] === undefined);
  const set = (k, v) => onChange({ ...trigger, [k]: v });
  const drop = k => { const next = { ...trigger }; delete next[k]; onChange(next); };
  const retype = on => {
    const allowed = new Set(["on", "effects", ...triggerKeysFor(on).map(([k]) => k)]);
    const next = { on };
    for (const [k, v] of Object.entries(trigger)) if (k !== "on" && allowed.has(k)) next[k] = v;
    onChange(next);
  };

  return (
    <div className="trig">
      <header>
        <Sel value={trigger.on} onChange={retype}
          options={Object.fromEntries(Object.entries(TRIGGER_SCHEMA).map(([k, d]) => [k, d.label]))}/>
        {def?.scope
          ? <Sel value={trigger.target} blank="（既定）" options={ENUMS.triggerTarget}
              onChange={v => (v ? set("target", v) : drop("target"))}/>
          : <span className="muted">呪文の本体（「だれの」は書けません）</span>}
        <span className="spacer"/>
        <button type="button" className="icon danger" title="この能力を削除" onClick={onRemove}>✕</button>
      </header>
      <div className="body">
        {used.filter(([k]) => k !== "target").map(([k, kind]) => {
          const label = TRIGGER_KEY_SCHEMA[k]?.label || keyLabel(k);
          const remove = (
            <button type="button" className="icon" title="この指定を外す" onClick={() => drop(k)}>−</button>
          );
          if (kind === "filter") {
            return (
              <div key={k} className="nest">
                <div className="nesthead">{label}<span className="muted"> {k}</span>
                  <span className="spacer"/>{remove}
                </div>
                <FilterEditor filter={trigger[k]} onChange={v => set(k, v)}/>
              </div>
            );
          }
          if (kind === "json") {
            return (
              <div key={k} className="nest">
                <div className="nesthead">{label}<span className="muted"> {k}</span>
                  <span className="spacer"/>{remove}
                </div>
                <JsonArea value={trigger[k]} onChange={v => set(k, v)} rows={4}/>
              </div>
            );
          }
          return (
            <div key={k} className="keyline">
              <Field label={label} sub={k}>
                <ScalarInput kind={kind} value={trigger[k]} onChange={v => set(k, v)}/>
              </Field>
              {remove}
            </div>
          );
        })}
        {trigger.templates ? (
          <p className="hint">
            「{trigger.count || 1}回、次から選んで実行」の能力（type:&quot;{trigger.type}&quot;）です。
            選択肢（templates）はまだフォームになっていないので、触らずそのまま持ち越します。
          </p>
        ) : (
          <StepList steps={trigger.effects || []} onChange={v => set("effects", v)}/>
        )}
        {unused.length ? (
          <Picker label="＋ 能力の指定を追加…"
            items={unused.filter(([k]) => k !== "target")
              .map(([k]) => [k, `${TRIGGER_KEY_SCHEMA[k]?.label || k}（${k}）`])}
            onPick={k => set(k, defaultValueFor(Object.fromEntries(keys)[k]))}/>
        ) : null}
      </div>
    </div>
  );
}

export function CardBuilder({ card, readOnly, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => (card ? structuredClone(card) : blankCard()));
  const [toast, setToast] = useState("");
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const json = useMemo(() => JSON.stringify(buildCardJson(draft), null, 2), [draft]);
  const say = msg => { setToast(msg); setTimeout(() => setToast(t => (t === msg ? "" : t)), 1800); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      say("JSONをコピーしました");
    } catch {
      // http の localhost などでは clipboard が使えない。自分で選べるように出す
      setCopyFallback(true);
      say("自動コピーができないので、下の欄から手でコピーしてください");
    }
  };

  const load = () => {
    let parsed;
    try { parsed = JSON.parse(pasteText); } catch { say("JSON として読めませんでした"); return; }
    const one = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!one || typeof one !== "object") { say("カード1枚のオブジェクトを貼ってください"); return; }
    setDraft({ ...blankCard(), ...one });
    syncCardIdSeed([one]); // 貼られた id より後ろから採番する
    setPasting(false);
    say("読み込みました");
  };

  // ブロックに付けたラベルを改行で連ねて、効果テキストの下書きにする
  const draftEffect = () => {
    const lines = (draft.triggers || []).flatMap(t =>
      [t.label, ...(t.effects || []).map(s => s.label)].filter(Boolean));
    if (!lines.length) { say("ラベルを書いたブロックがありません"); return; }
    if (draft.effect?.trim() && !window.confirm("いまの効果テキストを下書きで置き換えますか？")) return;
    set("effect", lines.join("\n"));
    say("下書きを入れました");
  };

  const save = () => {
    if (!draft.name?.trim()) { say("カード名を入れてください"); return; }
    onSave(buildCardJson({ ...draft, id: draft.id ?? mkCardId() }));
  };

  const toggleKw = kw => set("keywords",
    (draft.keywords || []).includes(kw)
      ? draft.keywords.filter(x => x !== kw)
      : [...(draft.keywords || []), kw]);

  return (
    <div className="card-builder fullscreen-panel" style={{ zIndex:700 }}>
      <style>{CSS}</style>
      <header>
        <span className="ttl">{card ? (readOnly ? "カードを見る" : "カードを編集") : "カードを作る"}</span>
        {readOnly ? <span className="muted">同梱カードは書き換えられません（複製してください）</span> : null}
        <span className="spacer"/>
        <button type="button" className="btn gold" onClick={copy}>📋 JSONをコピー</button>
        {readOnly ? null : (
          <button type="button" className="btn gold" onClick={save}>保存</button>
        )}
        <button type="button" className="btn" onClick={onCancel}>← 戻る</button>
      </header>

      <div className="wrap scroll">
        <div className="col">
          <section className="box">
            <h2>基本</h2>
            <div className="body">
              <Field label="カード名">
                <input value={draft.name || ""} onChange={e => set("name", e.target.value)}/>
              </Field>
              <div className="row">
                <Field label="コスト">
                  <input type="number" min={0} value={draft.cost ?? 1}
                    onChange={e => set("cost", Number(e.target.value))}/>
                </Field>
                <Field label="パワー" sub="空欄なら無し">
                  <input type="number" step={500} value={draft.power ?? ""}
                    onChange={e => set("power", e.target.value === "" ? undefined : Number(e.target.value))}/>
                </Field>
                <Field label="種別">
                  <Sel value={draft.type} options={CARD_TYPE_LABELS} onChange={v => set("type", v)}/>
                </Field>
              </div>
              <Field label="種族" sub="／ で区切る">
                <input value={draft.race || ""} placeholder="アーマード・ドラゴン"
                  onChange={e => set("race", e.target.value)}/>
              </Field>
              <Field label="文明" sub="複数選ぶと多色">
                <div className="chips">
                  {CIVS.map(civ => {
                    const on = civList(draft.civ).includes(civ);
                    return (
                      <button key={civ} type="button" className="chip civ" aria-pressed={on ? "true" : "false"}
                        style={{ color: on ? CIV[civ].textColor : undefined }}
                        onClick={() => {
                          const cur = civList(draft.civ);
                          const next = on ? cur.filter(x => x !== civ) : [...cur, civ];
                          set("civ", next.length === 1 ? next[0] : next);
                        }}>{CIV[civ].label}</button>
                    );
                  })}
                </div>
              </Field>
              <Field label="キーワード能力">
                <div className="chips">
                  {ALL_KEYWORDS.map(kw => (
                    <Chip key={kw} on={(draft.keywords || []).includes(kw)} onClick={() => toggleKw(kw)}>
                      {KEYWORD_LABELS[kw] || kw}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="効果テキスト" sub="印刷されたカードの文章">
                <textarea rows={3} value={draft.effect || ""}
                  onChange={e => set("effect", e.target.value)}/>
              </Field>
              <div className="row">
                <button type="button" className="btn ghost" onClick={draftEffect}>
                  ✎ ブロックから下書きを作る
                </button>
              </div>
            </div>
          </section>

          <section className="box">
            <h2>能力<span className="spacer"/>
              <button type="button" className="btn" onClick={() => set("triggers",
                [...(draft.triggers || []), { on: "creaturePutBz", effects: [] }])}>＋ 能力を追加</button>
            </h2>
            <div className="body">
              {(draft.triggers || []).length === 0 ? (
                <p className="hint">まだ能力がありません。「＋ 能力を追加」から始めます。</p>
              ) : null}
              {(draft.triggers || []).map((t, i) => (
                <TriggerBlock key={i} trigger={t}
                  onChange={v => set("triggers", draft.triggers.map((x, j) => (j === i ? v : x)))}
                  onRemove={() => set("triggers", draft.triggers.filter((_, j) => j !== i))}/>
              ))}
            </div>
          </section>

          <section className="box">
            <h2>特殊な指定</h2>
            <div className="body">
              <p className="hint">
                進化 / ツインパクトの呪文面 / 革命チェンジ / 侵略 / Jクライム / 置換効果などの
                カード直下の指定は、まだフォームになっていません。
                読み込んだカードが持っていれば触らずそのまま持ち越すので、
                JSON をコピーして手で足してください（書き方は docs/card-authoring.md）。
              </p>
            </div>
          </section>
        </div>

        <div className="col">
          <section className="box jsonwrap">
            <h2>出力される JSON<span className="spacer"/>
              <button type="button" className="btn ghost" onClick={() => setPasting(p => !p)}>
                {pasting ? "閉じる" : "貼り付けて読み込み"}
              </button>
            </h2>
            {pasting ? (
              <div className="body">
                <Field label="カード1枚ぶんの JSON">
                  <textarea className="raw" rows={6} value={pasteText}
                    onChange={e => setPasteText(e.target.value)}/>
                </Field>
                <div className="row">
                  <button type="button" className="btn gold" onClick={load}>読み込む</button>
                </div>
              </div>
            ) : null}
            {copyFallback ? (
              <div className="body">
                <Field label="ここを選んでコピーしてください">
                  <textarea className="raw" rows={6} readOnly value={json}
                    onFocus={e => e.target.select()} autoFocus/>
                </Field>
              </div>
            ) : null}
            <JsonView text={json}/>
          </section>
        </div>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
