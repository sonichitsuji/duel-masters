# コーディング規約

## 基本方針

**その言語で一般的とされる、読みやすい書き方に合わせる。** 独自の圧縮スタイルは新しく作らない。

**共通化できる部分はなるべく共通化する。** 同じ形のものを横に並べない。
たとえば「1体選んで墓地に置く」と「1体選んでマナゾーンに送る」なら、「1体選ぶ」は共通なので
`選んで[ゾーン]に送る` という1つの関数＋引数で表す。新しい仕組みを足す時は、
**まず既存の仕組みに畳めないか**を見る。畳めるならそちらを選ぶ。

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

## プルリクエスト

**説明の1行目に、マージ元を書く。** そのあと1行空けて本文を続ける。

```
Merge pull request #68 from sonichitsuji/claude/relaxed-pascal-783kks

## 概要
…
```

このリポジトリはマージコミットの既定を「Pull request title and description」にしてあるので、
**PRのタイトルがコミットのタイトル、PRの説明がコミットの本文**になる。
タイトルを見れば内容が分かり、本文の1行目を見ればどこからマージしたかが分かる、という形にしたい。
GitHub の設定だけではこの並びを作れない（`Merge pull request #N from …` はタイトル側にしか入れられない）
ので、説明の1行目は手で書く。

PR番号は作成するまで分からないので、**PRを作った後にその番号で説明を書き直す**。
