# コーディング規約

## 記法

- **`:` の後ろに空白を入れない。** オブジェクトリテラル・JSON・JSX の props すべてに適用する。

  ```js
  // ✅
  const spec = {zone:"grave", count:1, filter:{civ:"darkness"}};
  <div style={{position:"fixed", inset:0, padding:16}}/>
  getEffectiveCost(card, state, {evolutionBaseCount:3})
  ```
  ```js
  // ❌
  const spec = { zone: "grave", count: 1, filter: { civ: "darkness" } };
  ```

  既存コードの一括修正はしない（差分が膨大になるため）。**新規に書く箇所・触った行だけ**この形にする。

## このリポジトリについて

カードのデータ記法（`public/cards.json` の語彙・効果・トリガー）は `docs/card-authoring.md` を参照。
カード追加は `node scripts/add-card.mjs <file.json>`、検証は `npm run validate-cards`。
