import { useState } from "react";
import { ENUMS } from "../cardSchema";

// ===========================
// FORM BITS
// ===========================
// カードビルダー（CardBuilder / StepBlock / FilterEditor）で共用する入力部品。
// 見た目は CardBuilder の CSS（.card-builder スコープ）が持っていて、ここはクラス名だけ付ける。

// ラベル付きの1欄
export function Field({ label, sub, children }) {
  return (
    <label className="f">
      <span>{label}{sub ? <i> {sub}</i> : null}</span>
      {children}
    </label>
  );
}

// value が options のキーのどれか、を選ぶ。blank を渡すと「指定なし」の行が先頭に付く。
// groups（[見出し, [[値, ラベル], …]] の配列）を渡すと <optgroup> でまとめて出す
export function Sel({ value, options, groups, onChange, blank, className }) {
  return (
    <select className={className} value={value ?? ""} onChange={e => onChange(e.target.value)}>
      {blank ? <option value="">{blank}</option> : null}
      {groups
        ? groups.map(([g, entries]) => (
            <optgroup key={g} label={g}>
              {entries.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </optgroup>
          ))
        : Object.entries(options || {}).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

export function Chip({ on, onClick, title, style, children }) {
  return (
    <button type="button" className="chip" aria-pressed={on ? "true" : "false"}
      title={title} style={style} onClick={onClick}>{children}</button>
  );
}

// 「＋ 〜を追加…」のドロップダウン。選んだら先頭（空）に戻る
export function Picker({ label, items, groups, onPick }) {
  return (
    <Sel className="btn picker" value="" blank={label} groups={groups}
      options={items ? Object.fromEntries(items) : null}
      onChange={v => { if (v) onPick(v); }}/>
  );
}

// 文字列の配列（または単独の文字列）を複数選択で編集する。
// 1つだけなら文字列、2つ以上なら配列で返す。データ側がどちらも受けるのでそれに合わせる
// （gameLogic の anyOf が string / array のどちらも見る）。
function toList(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
function fromList(list) { return list.length === 1 ? list[0] : list; }

export function MultiChips({ value, options, onChange }) {
  const list = toList(value);
  return (
    <div className="chips">
      {Object.entries(options).map(([v, label]) => {
        const on = list.includes(v);
        return (
          <Chip key={v} on={on}
            onClick={() => onChange(fromList(on ? list.filter(x => x !== v) : [...list, v]))}>
            {label}
          </Chip>
        );
      })}
    </div>
  );
}

// カンマ区切りで複数書ける文字列。1つなら文字列、2つ以上なら配列で返す
function MultiText({ value, onChange, placeholder }) {
  return (
    <input value={toList(value).join(", ")} placeholder={placeholder}
      onChange={e => {
        const parts = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
        onChange(parts.length ? fromList(parts) : "");
      }}/>
  );
}

// 数値 or 変数名。数字だけなら数値にして返す（amount:"manaCount" のような書き方を許す）
function NumVar({ value, onChange }) {
  return (
    <input value={value ?? ""} placeholder="数値 または 変数名"
      onChange={e => { const v = e.target.value; onChange(v !== "" && !isNaN(v) ? Number(v) : v); }}/>
  );
}

// JSON をそのまま書く欄。入力中は壊れた JSON になるので、文字列は手元に持っておき、
// 読めた時だけ親に渡す
export function JsonArea({ value, onChange, rows = 6 }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <>
      <textarea className="raw" rows={rows} value={text} onChange={e => {
        setText(e.target.value);
        try { onChange(JSON.parse(e.target.value)); setBad(false); } catch { setBad(true); }
      }}/>
      {bad ? <div className="warn">JSON として読めないので、まだ反映していません</div> : null}
    </>
  );
}

// スキーマの kind 1つぶんの入力欄。入れ子を持つ kind（filter / steps / onlyIf / zones）は
// StepBlock 側で描くので、ここはそれ以外（＝値が1つで済むもの）を受け持つ。
export function ScalarInput({ kind, value, multi, onChange }) {
  if (kind === "bool") {
    return <Sel value={String(value)} options={{ true: "はい", false: "いいえ" }}
      onChange={v => onChange(v === "true")}/>;
  }
  if (kind === "num") {
    return <input type="number" value={value ?? 0} onChange={e => onChange(Number(e.target.value))}/>;
  }
  if (kind === "numVar") return <NumVar value={value} onChange={onChange}/>;
  if (kind === "keywords") return <MultiChips value={value ?? []} options={ENUMS.keyword}
    onChange={v => onChange(Array.isArray(v) ? v : [v])}/>;
  if (kind === "json") return <JsonArea value={value} onChange={onChange} rows={4}/>;
  if (kind.startsWith("enum:")) {
    const options = ENUMS[kind.slice(5)] || {};
    return multi
      ? <MultiChips value={value} options={options} onChange={onChange}/>
      : <Sel value={value} options={options} onChange={onChange}/>;
  }
  return multi
    ? <MultiText value={value} onChange={onChange}/>
    : <input value={value ?? ""} onChange={e => onChange(e.target.value)}/>;
}
