import { useState } from "react";
import {
  COMMON_STEP_KEYS, EFFECT_SCHEMA, ENUMS, defaultValueFor,
  effectLabel, effectTypesByGroup, keyLabel, orderStepKeys, stepFitsSchema, stepKeysFor,
} from "../cardSchema";
import { Field, JsonArea, MultiChips, Picker, ScalarInput, Sel } from "./FormBits";
import { FilterEditor } from "./FilterEditor";

// ===========================
// STEP BLOCK
// ===========================
// 効果ステップ1つぶんのカード。畳むと「①ラベル」の1行、開くと
// その型に書けるキーだけがフォームで並ぶ（EFFECT_SCHEMA が出どころ）。
// chooseMode の templates のような入れ子は StepList → StepBlock の再帰で描く。

const NUMERALS = "①②③④⑤⑥⑦⑧⑨⑩";

// 入れ子を持つ kind はここで描く。値が1つで済むものは ScalarInput に任せる
function KeyInput({ kind, value, onChange }) {
  if (kind === "filter") return <FilterEditor filter={value} onChange={onChange}/>;
  if (kind === "steps") return <StepList steps={value || []} onChange={onChange} nested/>;
  if (kind === "zones") {
    return <MultiChips value={value} options={ENUMS.zonesToBzFrom}
      onChange={v => onChange(Array.isArray(v) ? v : [v])}/>;
  }
  if (kind === "onlyIf") {
    const c = value || {};
    const set = (k, v) => onChange({ ...c, [k]: v });
    return (
      <div className="row">
        <Field label="どの変数を" sub="count">
          <input value={c.count ?? ""} placeholder="pick / count の as"
            onChange={e => set("count", e.target.value)}/>
        </Field>
        <Field label="〜以上" sub="min">
          <input type="number" value={c.min ?? ""}
            onChange={e => set("min", e.target.value === "" ? undefined : Number(e.target.value))}/>
        </Field>
        <Field label="〜以下" sub="max">
          <input type="number" value={c.max ?? ""}
            onChange={e => set("max", e.target.value === "" ? undefined : Number(e.target.value))}/>
        </Field>
      </div>
    );
  }
  return <ScalarInput kind={kind} value={value} onChange={onChange}/>;
}

// 1行に収まらないので、見出し付きの枠で囲んで出す kind
const NEST_KINDS = new Set(["filter", "steps", "onlyIf", "json"]);

// 効果の種類を変えた時。新しい型に書けないキーは、黙って JSON に残らないよう落とす
function retype(step, type) {
  const allowed = new Set([...Object.keys(EFFECT_SCHEMA[type]?.keys || {}),
    ...Object.keys(COMMON_STEP_KEYS)]);
  const next = { type };
  for (const [k, v] of Object.entries(step)) if (k !== "type" && allowed.has(k)) next[k] = v;
  return orderStepKeys(next);
}

function StepFields({ step, onChange, canIfPrevious }) {
  const keys = stepKeysFor(step.type);
  const used = keys.filter(([k]) => step[k] !== undefined && k !== "type");
  const unused = keys.filter(([k]) => step[k] === undefined && k !== "type");
  const set = (k, v) => onChange({ ...step, [k]: v });
  const drop = k => { const next = { ...step }; delete next[k]; onChange(next); };

  return (
    <>
      {used.map(([k, kind]) => {
        // ifPrevious は「直前のステップ」を見るので、先頭のステップには書けない
        if (k === "ifPrevious" && !canIfPrevious) return null;
        const label = keyLabel(k);
        const remove = (
          <button type="button" className="icon" title="この指定を外す" onClick={() => drop(k)}>−</button>
        );
        if (NEST_KINDS.has(kind)) {
          return (
            <div key={k} className="nest">
              <div className="nesthead">{label}<span className="muted"> {k}</span>
                <span className="spacer"/>{remove}
              </div>
              <KeyInput kind={kind} value={step[k]} onChange={v => set(k, v)}/>
            </div>
          );
        }
        return (
          <div key={k} className="keyline">
            <Field label={label} sub={k}>
              <KeyInput kind={kind} value={step[k]} onChange={v => set(k, v)}/>
            </Field>
            {remove}
          </div>
        );
      })}
      {unused.length ? (
        <Picker label="＋ 指定を追加…"
          items={unused
            .filter(([k]) => k !== "ifPrevious" || canIfPrevious)
            .map(([k]) => [k, `${keyLabel(k)}（${k}）`])}
          onPick={k => set(k, defaultValueFor(Object.fromEntries(keys)[k]))}/>
      ) : null}
    </>
  );
}

export function StepBlock({ step, index, count, onChange, onRemove, onMove, onDuplicate }) {
  const [open, setOpen] = useState(false);
  // 読み込んだステップにスキーマ外のキーがあれば、はじめから生JSONで開く（往復しても壊れない）
  const [raw, setRaw] = useState(() => !stepFitsSchema(step));
  const label = step.label || effectLabel(step.type);
  const known = !!EFFECT_SCHEMA[step.type];

  return (
    <div className={"step" + (open ? " open" : "")}>
      <header>
        <span className="no">{NUMERALS[index] || index + 1}</span>
        <button type="button" className="ttl" onClick={() => setOpen(o => !o)}>
          {step.label ? label : <em>{label}</em>}
        </button>
        <span className={"kind" + (known ? "" : " unknown")}>{effectLabel(step.type)}</span>
        <button type="button" className="icon" title="上へ" disabled={index === 0}
          onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="icon" title="下へ" disabled={index === count - 1}
          onClick={() => onMove(1)}>↓</button>
        <button type="button" className="icon" title="複製" onClick={onDuplicate}>⧉</button>
        <button type="button" className="icon danger" title="削除" onClick={onRemove}>✕</button>
      </header>
      {open ? (
        <div className="fields">
          <div className="nesthead">
            <span className="spacer"/>
            <button type="button" className="btn ghost" onClick={() => setRaw(r => !r)}>
              {raw ? "◀ フォームに戻す" : "⚙ 生JSONで編集"}
            </button>
          </div>
          {raw ? (
            <JsonArea value={step} onChange={onChange} rows={8}/>
          ) : (
            <>
              <Field label="効果の種類" sub="type">
                <Sel value={step.type} groups={effectTypesByGroup()}
                  onChange={t => onChange(retype(step, t))}/>
              </Field>
              <StepFields step={step} onChange={onChange} canIfPrevious={index > 0}/>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ステップ列（effects / templates）。nested の時は見出しを出さない
export function StepList({ steps, onChange, nested }) {
  const replace = (i, v) => onChange(steps.map((s, j) => (j === i ? v : s)));
  const move = (i, d) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className={"steps" + (nested ? " nested" : "")}>
      {steps.map((step, i) => (
        <StepBlock key={i} step={step} index={i} count={steps.length}
          onChange={v => replace(i, v)}
          onRemove={() => onChange(steps.filter((_, j) => j !== i))}
          onDuplicate={() => onChange([...steps.slice(0, i + 1), structuredClone(step), ...steps.slice(i + 1)])}
          onMove={d => move(i, d)}/>
      ))}
      <Picker label="＋ 効果を追加…" groups={effectTypesByGroup()}
        onPick={type => onChange([...steps, { label: "", type }])}/>
    </div>
  );
}
