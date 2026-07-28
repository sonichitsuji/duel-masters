# コーディング規約

## 基本方針

**その言語で一般的とされる、読みやすい書き方に合わせる。** 独自の圧縮スタイルは新しく作らない。

### JavaScript / JSX / JSON

コロンの後ろとブレースの内側に空白を入れる（Prettier / ESLint `key-spacing` の既定と同じ）。

```js
// ✅
const spec = { zone: "grave", count: 1, filter: { civ: "darkness" } };
getEffectiveCost(card, state, { evolutionBaseCount: 3 });
```
```js
// ❌
const spec = {zone:"grave", count:1, filter:{civ:"darkness"}};
```

JSX の style プロパティも同様。ただし1行が極端に長くなる場合は、詰めるのではなく改行で整える。

## 既存コードの扱い

このリポジトリには詰めた書き方（`{position:"fixed", inset:0}`）が多く残っており、**現状は混在している**。

- **一括整形はしない。** 混在は軽い戒めとしてそのまま残す
- **新規に書く箇所と、実際に触った行だけ**上記のスタイルにする
- 無関係な行のスタイル修正を差分に混ぜない

## このリポジトリについて

カードのデータ記法（`public/cards.json` の語彙・効果・トリガー）は `docs/card-authoring.md` を参照。
カード追加は `node scripts/add-card.mjs <file.json>`、検証は `npm run validate-cards`。
