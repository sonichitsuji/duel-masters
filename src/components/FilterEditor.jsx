import { FILTER_SCHEMA, defaultValueFor } from "../cardSchema";
import { Field, Picker, ScalarInput } from "./FormBits";

// ===========================
// FILTER EDITOR
// ===========================
// filter（対象の条件）の編集UI。ステップ・トリガー・カード直下の複数箇所から使う。
// FILTER_SCHEMA は実データで多い順に並べてあるので、ドロップダウンもその順で出る。
// not（〜ではない）は入れ子なので再帰で描く。
export function FilterEditor({ filter, onChange }) {
  const f = filter || {};
  const used = Object.keys(FILTER_SCHEMA).filter(k => k in f);
  const unused = Object.keys(FILTER_SCHEMA).filter(k => !(k in f));
  // スキーマに無いキー（新しい語彙を足した直後など）も、消さずにそのまま出す
  const extra = Object.keys(f).filter(k => !FILTER_SCHEMA[k]);
  const set = (k, v) => onChange({ ...f, [k]: v });
  const drop = k => { const next = { ...f }; delete next[k]; onChange(next); };

  return (
    <div className="filter">
      {[...used, ...extra].map(k => {
        const def = FILTER_SCHEMA[k] || { kind: "json", label: k };
        return (
          <div key={k} className="keyline">
            {def.kind === "filter" ? (
              <div className="nest">
                <div className="nesthead">{def.label}<span className="spacer"/>
                  <button type="button" className="icon" title="この条件を外す" onClick={() => drop(k)}>−</button>
                </div>
                <FilterEditor filter={f[k]} onChange={v => set(k, v)}/>
              </div>
            ) : (
              <>
                <Field label={def.label} sub={k}>
                  <ScalarInput kind={def.kind} value={f[k]} multi={def.multi} onChange={v => set(k, v)}/>
                </Field>
                <button type="button" className="icon" title="この条件を外す" onClick={() => drop(k)}>−</button>
              </>
            )}
          </div>
        );
      })}
      {unused.length ? (
        <Picker label="＋ 条件を追加…" items={unused.map(k => [k, FILTER_SCHEMA[k].label])}
          onPick={k => set(k, defaultValueFor(FILTER_SCHEMA[k].kind))}/>
      ) : null}
    </div>
  );
}
