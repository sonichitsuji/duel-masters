# カード作成ガイド / 用語集

新しいカードを `public/cards.json` に追加するための、実装済みの語彙（フィールド・キーワード・
トリガー・効果）の一覧です。**ここに載っている名前は `cards.json` にデータを書くだけで動きます。**
載っていない挙動は新規実装（`src/engine/effects.js` の拡張）が必要です。

> 出典: `src/constants.js`(keywords) / `src/engine/effects.js`(効果) / `src/screens/BattleScreen.jsx`(トリガー)。
> 齟齬があればソースが正。旧記法（`type:"steps"` / 単純効果 / 旧ステップ名）は**廃止済み**で、
> `npm run validate-cards` がエラーとして検出します。

---

## 1. 追加手順（トークン節約フロー）

1. カード情報を **下記スキーマのJSON**で用意（1枚 or 配列）。`id` は省略可（自動採番）。
2. 追記: `node scripts/add-card.mjs <file.json>`（整形を壊さず末尾に挿入・id自動採番）。
3. 検証: `npm run validate-cards`（JSON妥当性・未知/旧記法の効果・重複name/id・デッキ参照切れ）。
4. `npm run build` で最終確認。デッキに入れる場合は `src/decks.js` にidを追加。

---

## 2. 記法の基本

効果は **`effects` 配列**（上から順に解決）。`"type":"steps"` のような入れ子は不要。

**能力はすべて `triggers` に書きます。**`on` で契機を選び、`target` で誰のイベントかを指定します（§7）。

```jsonc
// 出た時（cip）。target の既定が "this" なので、自分自身が出た時に誘発する
"triggers":[ { "on":"creaturePutBz", "effects":[ {"type":"drawCards","amount":1} ] } ]

// 呪文の本体（唱えたら必ず起きる効果）
"triggers":[ { "on":"cast", "effects":[ {"type":"drawCards","amount":1} ] } ]

// 誘発能力
"triggers":[ { "on":"attack", "optional":true, "effects":[ … ] } ]

// 唯一の特殊形：○回選んで実行
"triggers":[ { "on":"cast", "type":"chooseTimes", "count":2,
  "templates":[ { "label":"…", "effects":[ … ] } ] } ]
```

> **`on:"cast"` だけは誘発型能力ではありません。**
> これは「この呪文を唱えた時の効果」＝**呪文の本体**で、唱えたら必ず起きます。そのため
> `target` や `oncePerTurn` は書けず、解決も順序固定です（他の誘発と並べて「どれから解決するか」を
> 聞くものではありません）。**他のカードが**呪文に反応するのは `on:"castSpell"` の方です。
> ツインパクトの呪文面は `spellSide.triggers` に `on:"cast"` を1つだけ書きます。

> **cip（出た時）は `on:"creaturePutBz"`。** `creaturePutBz` の既定 `target` は `"this"`
> （自分自身に起きた出来事）なので、`target` を書かなければ「このクリーチャーが出た時」になります。
> **召喚でも効果で出された場合でも誘発します。**
> なお `autoEffect` は廃止されました（`trigger:"play"` → `on:"creaturePutBz"` /
> `trigger:"cast"` → `on:"cast"`）。移行は `node scripts/migrate-autoeffect.mjs` で行いました。

### 共通パラメータ（effects の各要素）
| パラメータ | 説明 |
|---|---|
| `label` | モーダルに出す説明文 |
| `optional` | 「〜してもよい」（スキップ可） |
| `target` | **`"self"` / `"opponent"` / `"both"`**（どちらも） |
| `amount` | 数値、**または変数名の文字列**（例 `"count"`）。選択枚数の上限にもなる |
| `filter` | 対象条件（下記） |
| `zone` | 対象ゾーン（`hand` `bz` `mana` `grave` `shield` `deck` `hyper` `revealed` `lastMoved` `under` `stack`） |
| `subject` | **「そのクリーチャー」**。誘発の主体そのものを対象にする（選択させない） |
| `all` | 条件一致すべてに適用（選択不要） |
| `onePlayer` | **「プレイヤー1人の〜から」**。`target:"both"` で候補を両者から出しつつ、選べるのは**どちらか一方のプレイヤーのカードだけ**にする |
| `choosePlayer` | **「プレイヤーを1人選ぶ」**。カードではなく**プレイヤーそのもの**を選ぶ。`target:"both"` 必須 → **§5.1** |
| `any` | **「好きな枚数」**。0枚〜候補すべてから好きなだけ選ぶ（0枚も選べるので常に任意） |
| `as` | 実際に動いた枚数を変数に控える。後続の `amount` から名前で参照できる（「同じ枚数」） |
| `ifPrevious` | **「そうしたら」「そうした場合」**。直前のステップを実際に行わなかった場合、このステップ以降を実行しない → **§3.5** |

> `under` = **このクリーチャーの下にあるカード**（メテオバーン用）、
> `stack` = **このクリーチャーに含まれるカード**（自身＋下に敷かれたカード）。
> どちらも「いまバトルゾーンにいる能力の持ち主」を見るので、離れていれば空になります。

**filter**: `side`(ツインパクトの面) `civ` `civNot` `raceContains` `nameContains` `keyword`
`type`(`creature`＝進化含む / **`nonEvoCreature`**＝進化ではないクリーチャー / `evo_creature` / `nonCreature` / `spell` / `tamaseed`…)
`element`(クリーチャー/タマシード/フィールド) `creatureOnly` `multiColor` `tapped` `maxCost` `minCost` `maxPower` `minPower` `notNameSelf`
`hasCip`(「このクリーチャーが出た時」で始まる能力を持つ) `psychic`(サイキック・クリーチャーかどうか)
`evolution`(進化クリーチャーかどうか。`type:"evo_creature"` と NEO進化の両方を拾う)
`notSelf`(「自分の**他の**〜」。その効果の持ち主自身を除く)
`not`(「〜ではない」→ 下記)
※ `maxCost` `minCost` `maxPower` `minPower` には**変数名の文字列**も書けます。

> **キー名は `npm run validate-cards` が検査します。** 効果ステップと `filter` に未知のキーがあると
> エラーになるので、`takeall`（正: `takeAll`）や `civs`（正: `civ`）のような綴り違いは検出されます。
> 新しいキーを実装したら `scripts/validate-cards.mjs` の `EFFECT_KEYS` / `FILTER_KEYS` にも足してください。

> `maxPower` / `minPower` が見るのは**カードに印刷されたパワー**です。
> `powerBuff` などによる増減は反映されません。

**「〜または〜」は配列で書きます**（`civ` `civNot` `raceContains` `nameContains` `keyword` `type` が対応）。

```jsonc
{ "civ": ["water", "darkness"] }                  // 水または闇
{ "raceContains": ["ドラゴン", "コマンド"] }        // ドラゴンまたはコマンド
{ "type": ["spell", "tamaseed"] }                 // 呪文またはタマシード
{ "keyword": ["blocker", "slayer"] }              // ブロッカーまたはスレイヤーを持つ
{ "civNot": ["light", "fire"] }                   // 光でも火でもない
{ "civ": ["water", "darkness"], "maxCost": 5 }    // 「水または闇」かつ「コスト5以下」
```

**同じキーの中は OR、違うキーどうしは AND** です。多色カードは持っている文明のどれかが
一致すれば `civ` に該当します（例: 水/火の多色は `{"civ":["water","darkness"]}` に該当）。

### 「〜ではない」（`not`）

`not` の中身は **filter と同じ語彙**です。そこに一致するカードを除きます。

```jsonc
// パワー3000以下の、サイキックではないクリーチャー
{ "creatureOnly": true, "maxPower": 3000, "not": { "psychic": true } }

// ドラゴンでもコマンドでもないクリーチャー（1つの not に2つ書けば AND で否定）
{ "creatureOnly": true, "not": { "raceContains": ["ドラゴン", "コマンド"] } }

// 「コスト3以下の呪文」ではないカード（not の中も AND なので、
//   コスト4以上の呪文や、コスト3以下のクリーチャーは残る）
{ "not": { "type": "spell", "maxCost": 3 } }
```

- **`not` を配列にすると「そのどれにも当てはまらない」**という意味になります
  （`{"not":[{"civ":"fire"},{"maxCost":2}]}` = 火でもなく、コスト2以下でもない）
- `civNot` は `not:{civ:…}` と同じことができますが、既存カードが使っているのでそのまま残しています
- `not` の中も `npm run validate-cards` がキー名を検査します（入れ子も再帰的に見ます）

### サイキック（`psychic`）

サイキック・クリーチャー（超次元ゾーンから出るクリーチャー）かどうかを見ます。
カード側は直下に `"psychic": true` と書きます。

> **このリポジトリにサイキック・クリーチャーはまだ1枚もありません。**
> 「サイキックをすべて破壊する」のようなテキストを書ける場所は用意してありますが、
> 実際に当たるカードが入るまでは何も起きません。

### ツインパクトの面（`side`）

ツインパクトは**クリーチャーであり呪文でもある**ので、`type:"creature"` にも `type:"spell"` にも
一致します（`type:"twinpact"` にも一致）。

```jsonc
{ "type": "creature" }   // 「墓地からクリーチャーを手札に戻す」→ ツインパクトも対象（クリーチャー面）
{ "type": "spell" }      // 「墓地から呪文を唱える」→ ツインパクトも対象（呪文面）
```

ただし**プレイ中はどちらの面かが確定する**ので、そのカードには `side`（`"creature"` / `"spell"`）が
付き、`type` もその面で判定されます。「この**クリーチャーの召喚**コストを〜」のように
面を区別したい時は `filter.side` を使います。

```jsonc
// このクリーチャーの召喚コストを軽減（呪文面を唱える時には効かない）
"costReduce": { "amountPer": {…}, "filter": { "self": true, "side": "creature" },
                "zones": ["hand"], "min": 1 }
```

シビルカウントや `element` の数え上げにもツインパクトのクリーチャー面が含まれます。

**マナゾーンでは両面の文明を持ちます。** 呪烏竜 ACE-Curase（クリーチャー面=水/闇、
呪文面「繁栄の鏡」=自然）をマナに置くと、水・闇・自然のどの文明としても支払いに使えます
（1枚が供給するのはあくまで1マナ）。マナ表示の文明カウントも、その文明として使える枚数を示します。

---

## 3. 変数ステップ（variable）

先に数えて／選んでおき、後続の効果が `amount` などで参照します。**加算は行いません**——
「その枚数引く」＋「1枚引く」のように**効果を重ねて**表現します。

| type | 説明 |
|---|---|
| `count` | `{zone,target,filter,as?}` 条件一致の枚数を変数（既定名 `count`）へ |
| `pick` | `{zone,target,filter,as?}` 対象を選んで変数（既定名 `picked`）へ |
| `chooseNumber` | `{as,min?,max?}` プレイヤーに数字を1つ選ばせて変数へ → **§7.27** |

```jsonc
// 自分の光のクリーチャー/タマシード1つにつき1枚引く
[ {"type":"count","zone":"bz","target":"self","filter":{"civ":"light","element":true}},
  {"type":"drawCards","amount":"count","optional":true} ]

// 手札を全部捨て、その枚数+1引く（加算不要）
[ {"type":"count","zone":"hand","target":"self"},
  {"type":"handToGrave","target":"self","all":true},
  {"type":"drawCards","amount":"count"},
  {"type":"drawCards","amount":1} ]

// 山札上をマナへ、それがドラゴンならもう1枚（条件分岐も変数で）
[ {"type":"topToMana","amount":1},
  {"type":"count","zone":"lastMoved","filter":{"raceContains":"ドラゴン"}},
  {"type":"topToMana","amount":"count"} ]
```

---

## 3.4. そのステップだけ飛ばす（`onlyIf`）

「自分のマナゾーンのカードが5枚以下なら、カードを1枚引く」のように、**条件を満たさない時に
そのステップだけを飛ばしたい**場合に使います。

```jsonc
{ "type": "count", "zone": "mana", "target": "self", "as": "manaCount" },
{ "type": "drawCards", "amount": 1, "onlyIf": { "count": "manaCount", "max": 5 } }
```

| キー | 説明 |
|---|---|
| `count` | 見る変数の名前（`count` / `pick` ステップが `as` で入れたもの） |
| `min` / `max` | その値の下限・上限。両方書けば範囲 |

- **`ifPrevious` とは別物**です。`ifPrevious` は「直前のステップを実際に行ったか」、
  `onlyIf` は「変数の値がいくつか」を見ます
- **`shouldStopChain` とも別物**です。`ifPrevious` が満たされないと**以降すべて**が中止されますが、
  `onlyIf` は**そのステップ1つだけ**を飛ばして次へ進みます
- 「こうして出したカードがクリーチャーなら〜、タマシードなら〜」のような分岐は、
  `count` で数えてから `onlyIf:{min:1}` と `onlyIf:{max:0}` の2ステップを並べて書きます

## 3.5. 「そうしたら」「そうした場合」（`ifPrevious`）

「〜してもよい。**そうしたら**、…」のように、**前の効果を実際に行った場合だけ**続きが起きる書き方です。
続きのステップに `"ifPrevious": true` を付けます。行わなかった場合は**そのステップ以降がすべて実行されません**。

```jsonc
// 自分の手札を1枚捨ててもよい。そうしたら、カードを2枚引く。
[ {"label":"手札を1枚捨ててもよい","type":"handToGrave","target":"self","amount":1,"optional":true},
  {"label":"そうしたら、カードを2枚引く","type":"drawCards","amount":2,"ifPrevious":true} ]
```

「行った」の判定は次のとおりです。

| ステップの種類 | 「行った」とみなす条件 |
|---|---|
| 対象を選ぶステップ | 1枚以上選ばれた（スキップ・0枚選択は「行っていない」） |
| `drawCards` | 実際に1枚以上引けた（山札切れは「行っていない」） |
| `meteorBurn` | コストを支払えた → **§7.9** |
| その他の自動ステップ | 常に「行った」 |

> **メテオバーンは `ifPrevious` を書く必要がありません。** コストなので、支払わなければ
> 常に以降のステップが打ち切られます。

---

### 変数に足し引きする（`{ var, plus }`）

`amount` と `filter` のコスト・パワー指定には、変数そのものではなく**足し引きした値**を書けます。

```jsonc
// 破壊したカードよりコストが1大きいカードを墓地から出す
{ "type": "destroy", "target": "self", "asCost": "destroyedCost" },
{ "type": "graveToBz", "filter": { "cost": { "var": "destroyedCost", "plus": 1 } } }
```

`asCost` は `destroy` と `handToGrave` に書けます（「破壊した／捨てたカードと同じコストの〜」）。
複数枚が対象になった場合は**いちばん大きいコスト**が入ります。

`filter.cost` は**コストがちょうどその値**という意味です（`maxCost` / `minCost` は以下・以上）。

## 3.6. 「次のうちいずれか1つを選ぶ」（`chooseMode`）

> 自分の手札を1枚捨てる。その後、次のうちいずれか1つを選ぶ。
> ▶カードを2枚引く。
> ▶相手のパワー9000以下のクリーチャーを1体選び、破壊する。
> （虚ト成リシ古ノ蛇神ノ咆哮）

```jsonc
[ { "label":"自分の手札を1枚捨てる", "type":"handToGrave", "target":"self", "amount":1 },
  { "label":"次のうちいずれか1つを選ぶ", "type":"chooseMode",
    "templates":[
      { "label":"カードを2枚引く",
        "effects":[ {"type":"drawCards","amount":2} ] },
      { "label":"相手のパワー9000以下のクリーチャーを1体選び、破壊する",
        "effects":[ {"type":"destroy","target":"opponent","amount":1,
                     "filter":{"creatureOnly":true,"maxPower":9000}} ] }
    ] } ]
```

| キー | 説明 |
|---|---|
| `templates` | 選択肢の配列。各要素は `{ label, effects }`（**2つ以上必要**） |

- 選んだ選択肢の `effects` が、**そのステップの位置にそのまま差し込まれて**続きが解決されます。
  だから「捨ててから選ぶ」「選んでからさらに続きがある」のどちらも素直に書けます
- 変数（`count` などで控えた値）はそのまま引き継がれるので、選択の前後で使い回せます
- 「選ばない」を選ぶと、その選択ぶんだけ飛ばして次のステップへ進みます（例外処理）

> **`chooseTimes` との違い。** `chooseTimes` は「○回選んで実行」で、`triggers` の直下にしか
> 書けません（`effects` の代わりになる特殊形）。`chooseMode` は**普通のステップ**なので、
> `effects` の途中に置けます。1回だけ選ぶ「▶」表記のカードはこちらを使ってください。

## 4. 命名規則

- **ゾーン移動は `<from>To<To>`**（「出す」「置く」「戻す」「捨てる」）。`play` は使わない。
- **「実行(プレイ)」は `playFromHand`**（呪文なら唱える／クリーチャーなら召喚）。効果で「出す」場合と区別。
- **破壊は `destroy`**（destroyed 誘発を伴うため移動と区別）。

---

## 5. 効果カタログ

**選択**
- `chooseMode {templates}` — **「次のうちいずれか1つを選ぶ」** → **§3.6**

**ターン進行**
- `skipRestOfTurn` — **「ターンの残りをとばす」** → **§7.30**

**ドロー / 山札**
- `drawCards {amount}` — ○枚引く
- `reveal {amount}` — 山札の上を公開（以降 `revealed*` の対象になる）
- `search {destination,amount,takeAll,filter}` — 山札から探す。`destination`: `hand`/`deckTop`/`bz`/`mana`（実行後シャッフル）
- `topToGrave {amount}` / `topToMana {amount,tapped}` / `topToShield {amount}` — 山札の上を各ゾーンへ
- `shuffleDeck {target}` — 山札をシャッフルする（`target` で自分/相手/おたがい）

**公開カードの行き先**
- `revealedToHand` / `revealedToBz` / `revealedToMana` / `revealedToGrave` / `revealedToDeckTop` / `revealedToDeckBottom`
  （`filter` `takeAll` `amount` 可。残りを戻すのは `revealedToDeckBottom`）

**手札から**
- `handToBz {filter,amount,tempKeyword,summoningSickness}` — 手札から**出す**
- `handToDeck {amount,to,order}` — 手札を山札へ。`to`: `"top"`(既定) / `"bottom"`、
  `order:"choose"` で**好きな順序**（先に選んだものが上）
- `handToHyper {target,amount,all,filter}` — **超次元ゾーン**へ置く（ゲーム外の公開領域。戻ってこない）
- `handToShield {amount}` — シールド化
- `handToGrave {target,amount,all,random,asCost}` — 捨てる（`random`=見ないで選ぶ）
  - `asCost:"変数名"` … 捨てたカードのコストを変数に控える（`destroy` の `asCost` と同じ規約）
- `playFromHand {free,filter,zone,side,subject}` — **実行**（呪文=唱える／クリーチャー=召喚／城=表向きシールド化）
  - `zone`: 唱える（出す）元のゾーン。`"hand"`（既定）/ `"grave"` → **§5.2**
  - `side`: ツインパクトのどちらの面としてプレイするか（`"creature"` / `"spell"`）→ **§5.2**
  - `afterCast`: 「そうしたら、唱えた後、墓地に置くかわりに〜」（唱えた1枚だけに乗る置換）→ **§7.22**

**マナから**：`manaToBz {filter}` / `manaToHand {amount}` / `manaToGrave {amount|any, as}`

**マナゾーンへ置く時のタップ状態**
マナゾーンに置かれるカードは、**既定でアンタップ**です。カードのテキストに
「**タップして**マナゾーンに置く」とある時だけ `"tapped": true` を書きます。

```jsonc
// 「持ち主のマナゾーンに置く」→ アンタップ（既定なので何も書かない）
{ "type": "bzToMana", "target": "opponent", "amount": 1 }

// 「タップしてマナゾーンに置く」→ tapped を明記
{ "type": "topToMana", "amount": 1, "tapped": true }
```

`tapped` は **`topToMana` / `bzToMana` / `revealedToMana` / `search{destination:"mana"}` /
`meteorBurn{to:"mana"}`** で共通に使えます。

**バトルゾーンから**
- `destroy {target,filter,amount,all,self,asCost}` — 破壊。**`self:true` で「このクリーチャーを破壊する」**（選択不要・自分を対象）
  - `asCost:"変数名"` … 破壊したカードのコストを変数に控える（「破壊したカードよりコストが1大きい〜」用）
- `bzToHand` / `bzToMana` / `bzToShield`（`target,filter,amount,all`）
- `tap` / `untap` / `tapToggle`（`target,zone,filter,all,noUntapNextTurn`）
- `untapAllMana` — 自分のマナを全アンタップ
- `powerBuff {target,count,amount,perUnit,expires,keywords}` — パワー増減（負値で弱体、0以下で破壊）
  - `amount` は**パワー増減値**（他の効果と違い選択枚数ではない）。選ぶ体数は `count`（既定1体）
  - `perUnit` を付けると「1つにつきN」。`amount` に変数を渡して掛ける
    ```jsonc
    // 自分の墓地のクリーチャー1体につき −1000（相手1体に、このターン）
    {"type":"count","zone":"grave","target":"self","filter":{"creatureOnly":true},"as":"graveCre"},
    {"type":"powerBuff","target":"opponent","count":1,"amount":"graveCre","perUnit":-1000,"expires":"endOfTurn"}
    ```
- `grant {keywords,untapAfterAttack,untap,expires}` — 能力付与
- `battle {target, selfFrom}` — このクリーチャーと相手1体をバトル。
  `selfFrom:"lastPut"` を書くと、**直前にこの効果でバトルゾーンに出したクリーチャー**が
  自分側になる（呪文には「このクリーチャー」がいないため）。何も出ていなければステップごと飛ばされる。
  ※ `subject:true`（＝「そのクリーチャー」＝誘発の主体）とは別物なので混同しないこと

**墓地・シールド**
- `graveToBz {filter,owner,self,tempKeywords,destroyAtEndOfTurn,summoningSickness}` — 墓地から出す
  （`owner:"destroyed"`=直前に破壊されたクリーチャーの持ち主、`self:true`=このカード自身）
- `zonesToBz {zones,filter,amount,tempKeywords,…}` — **複数のゾーンから**出す
  （「自分の墓地またはマナゾーンから」→ **§7.26**）
- `ignoreAbilities {target,all,filter}` — **そのエレメントの能力を無視する** → **§7.27**
- `graveToHand {target,filter,amount}` — 墓地から手札に戻す
- `graveToDeck {target,filter,any,all,onePlayer}` — 墓地のカードを**山札に加えてシャッフル**する
  （「自身の山札に加えてシャッフルする」。下に置く `graveToDeckBottom` とは別物）
- `graveToDeckBottom {target,filter,amount,all,order}` — 墓地から山札の下へ
  - `order: "shuffle"`（既定）… シャッフルしてから置く。`all:true` か `amount` 省略で墓地すべてが対象
  - `order: "choose"` … **好きな順序で**置く。選んだ順に上から積まれ、全部選ぶまで確定できない
    （`amount` を書けばその枚数だけ選ぶ）
  ```jsonc
  // 自分の墓地をシャッフルして山札の下に置く
  { "type": "graveToDeckBottom", "all": true }
  // 自分の墓地のカードを好きな順序で山札の下に置く
  { "type": "graveToDeckBottom", "order": "choose" }
  // 自分の墓地から2枚選び、好きな順序で山札の下に置く
  { "type": "graveToDeckBottom", "amount": 2, "order": "choose" }
  ```
- `shieldToHand {target, all, canUseTrigger}` — シールドを手札に加える。**既定では「S・トリガー」が使える**。
  カードテキストに「ただし、その『S・トリガー』は使えない」とあるものだけ `canUseTrigger:false` を書く
- `shieldToGrave {target, all}` / `breakShield {target}`

**進化元を動かすコスト**
- `meteorBurn {count,to,optional,tapped}` — メテオバーン → **§7.9**

**特殊勝利**
- `winGame {target,reason}` — EXWIN。`target` のプレイヤーがゲームに勝つ（既定 `self`）

**召喚元ゾーンの拡張**
- `grantSummonFrom {zone,filter,maxPerTurn,timing,target}` — そのターン、指定ゾーン（`grave`/`mana`）から
  クリーチャーを**召喚**できるようにする（コスト支払いあり）→ **§7.7**

**遅延**
- `scheduleReviveSubjectEndOfTurn` — 「そのクリーチャー」をターン終了時に墓地から出す

**制限**（どれも「縛られている側のターンが終わると切れる」期限付き）
- `denySpell {target,until,filter,label}` — 呪文を唱えられない → **§7.23**
- `denyAttackBlock {target,mode,filter,label}` — 攻撃／ブロックできない → **§7.28.7**
- `ignoreAbilities {target,all,filter}` — 能力を無視する → **§7.27**

### 5.1. 「プレイヤーを1人選ぶ」（`choosePlayer`）

> プレイヤーを1人選ぶ。**そのプレイヤーは**自身の墓地をシャッフルして山札の下に置く。

カードではなく**プレイヤーそのもの**を選ぶ効果です。モーダルに P1 / P2 のボタンが出て、
選ぶまで確定できません。選ばれた側だけがその効果の対象になります。

```jsonc
{
  "type": "graveToDeckBottom",
  "target": "both",          // 必須（どちらのプレイヤーも選べる）
  "all": true,
  "choosePlayer": true,
  "order": "shuffle"
}
```

- **`target:"both"` が必須**です。`onePlayer` とは併用できません（validator がエラーにします）
- `all:true` と組み合わせても**自動実行にはなりません**。誰を選ぶか決めるまで進みません
- 選んだ pid は候補カードの選択とは別のチャンネル（`ctx.chosenPlayer`）で渡るので、
  「相手に選ばれた時」の誘発や `ifPrevious` の判定を誤らせません

**`onePlayer` との使い分け**

| | 選ぶもの | 使う場面 |
|---|---|---|
| `choosePlayer` | プレイヤー | 「プレイヤーを1人選ぶ。そのプレイヤーは〜」 |
| `onePlayer` | カード（ただし1人の側から） | 「プレイヤー1人の墓地からカードを1枚以上選ぶ」 |

### 5.2. 墓地から呪文を唱える（`playFromHand {zone:"grave"}`）

> コスト4以下の呪文を1枚、**自分の墓地から**コストを支払わずに唱えてもよい。

型名は `playFromHand` のままで、`zone` に唱える元のゾーンを書きます（既定 `"hand"`）。

```jsonc
{
  "type": "playFromHand",
  "zone": "grave",                              // "hand"(既定) / "grave"
  "target": "self",
  "free": true,
  "optional": true,
  "filter": { "type": "spell", "maxCost": 4 }
}
```

- 唱えた呪文は**墓地へ行きます**（墓地から唱えた場合はそのまま墓地に残ります）。
  行き先を変えたい時は `spellAfterCast` → **§7.22**
- チャージャーを持つ呪文はマナゾーンへ行きます（手札から唱えた時と同じ）

**「その呪文を」＝誘発の主体**は `subject: true` で指定します（選択は出ません）。

```jsonc
// 各ターンに1度、自分の手札から呪文を唱えた時、その呪文を墓地から唱えてもよい
"triggers": [{
  "on": "castSpell", "target": "self", "fromZone": "hand", "oncePerTurn": true, "optional": true,
  "effects": [{ "type": "playFromHand", "zone": "grave", "side": "spell",
                "subject": true, "free": true, "optional": true }]
}]
```

**ツインパクトはどちらの面としてプレイするかを決める必要があります。** 決め方は上から順に:

1. `side`（`"creature"` / `"spell"`）に書いてあればそれ
2. カードに `side` が付いていれば（プレイ中に確定済み）それ
3. `filter.type` が `"spell"` だけを指していれば呪文、クリーチャー系だけを指していればクリーチャー
4. それ以外は印刷された `type`（**ツインパクトはクリーチャー面が既定**）

**`filter` は「プレイする面」に対して判定します。** ツインパクトは呪文面のコストが
クリーチャー面と違うので、`{"type":"spell","maxCost":4}` は**呪文面のコスト**を見ます。

### 効果でバトルゾーンに出したクリーチャーの召喚酔い

`handToBz` / `manaToBz` / `graveToBz` / `zonesToBz` / `revealedToBz` / `search{destination:"bz"}` で
出したクリーチャーは、**既定で召喚酔いします**（そのターンは攻撃できない）。DMの通常ルールどおりです。

「出したターンから攻撃できる」と書かれたカードだけ **`"summoningSickness": false`** を付けてください。
スピードアタッカー持ちは攻撃可否の判定側で除外されるので、この指定は不要です。

---

## 6. type とキーワード

**type**: `creature` / `evo_creature` / `spell` / `twinpact` / `tamaseed` / `castle`(G城・表向きシールド) / `field`(フィールド)

**エレメント**: `creature` `evo_creature` `tamaseed` `field` とツインパクトのクリーチャー面。
`filter` の `"element": true` や `"type": "element"` で指定できます。

**keywords**: `speedAttacker` `wBreaker` `tBreaker` `blocker` `cantAttack` `sTrigger` `drawOnPlay`
`revolutionChange` `gStrike` `charger` `zRush` `escape` `slayer` `guardman` `unselectable`
`machFighter` `worldBreaker` `justDiver` `unattackable`

**文明**: `light` `water` `darkness` `fire` `nature`（表示順もこの順）

### `zRush`（Zラッシュ）
「シールドが離れたら、次の自分のターンのはじめまで、このクリーチャーのハイパーモードを解放する」。

**いつ・誰のシールドが・どこに離れても**成立する**状況起因処理**として実装している。
つまり自分のシールドでも相手のシールドでもよく、ブレイク／効果／エスケープ／置換のどれでも、
行き先が手札でも墓地でもマナでも関係なく、シールドゾーンからカードが消えた時点で
バトルゾーンにいる**全ての**Zラッシュ持ちが解放される。
解放されたハイパーモードは、そのクリーチャーの持ち主の次のターン開始時に戻る。

---

## 7. triggers（誘発能力）

**`on`（イベント名）＋ `target`（誰の）＋ `filter`（どんなカード）** の組み合わせで書きます。

```jsonc
"triggers":[
  { "on":"creaturePutBz", "target":"opponent", "optional":true, "effects":[ … ] },
  { "on":"destroyed", "filter":{"raceContains":"ドラゴン"}, "effects":[ … ] }
]
```

### イベント一覧（`on`）
| on | 契機 |
|---|---|
| `cast` | **この呪文を唱えた時＝呪文の本体**。誘発型能力ではないので `target` などは書けない（→ §2） |
| `creaturePutBz` | クリーチャーがバトルゾーンに出た時（`method` 指定可）。既定 `target:"this"` なので、そのまま書けば **cip（出た時）** になる |
| `castSpell` | 呪文を唱えた時（`fromZone` 指定可＝どこから唱えたか） |
| `attack` | クリーチャーが攻撃する時（`firstEachTurn` 指定可） |
| `attackEnd` | **攻撃の終わり**（攻撃終了ステップ）。攻撃したクリーチャーが戦闘で破壊されていた場合、そのクリーチャー自身の能力は誘発しない |
| `leave` | カードが離れた時 |
| `destroyed` | 破壊された時 |
| `battleDestroy` | バトルで破壊された時 |
| `battleWin` | **バトルに勝った時**（相手を破壊して自分は生き残った時。相打ちは勝ちではない）。攻撃によるバトルと `battle` 効果の両方で誘発 |
| `draw` | カードを引いた時。`"lastCard": true` で「**それが最後の1枚だったら**」（引いた結果、山札が0枚になった時）に限定できる |
| `discard` | 手札を捨てた時 |
| `shieldAdded` / `shieldLeave` | シールドが置かれた/離れた時。`shieldLeave` はシールドゾーンの中身を監視して検出するので、**ブレイク・効果・エスケープ・置換など離れ方と行き先を問わず**誘発する（`target` でどちらのシールドかを指定） |
| `startOfTurn` | ターンのはじめ（アンタップ後・ドロー前）。`target` で**誰のターンか**を指定（`self`=自分のターン(既定) / `opponent`=相手のターン / `both`=各ターン） |
| `endOfTurn` | ターンの終わり。`target` で**誰のターンか**を指定（`self`=自分のターン(既定) / `opponent`=相手のターン / `both`=各ターン） |

### `target`（誰のイベントに反応するか）
| 値 | 意味 |
|---|---|
| `this` | **このカード自身**のイベント |
| `self` | 自分の |
| `opponent` | 相手の |
| `both` | どちらでも |

**既定値**：カード自身のイベント（`creaturePutBz` `leave` `destroyed` `battleDestroy` `attack`）は **`this`**、
プレイヤーのイベント（`castSpell` `draw` `discard` `shieldAdded` `shieldLeave` `startOfTurn` `endOfTurn`）は **`self`**。
`startOfTurn` / `endOfTurn` の `self` は「**自分のターンの**はじめ／終わりに」。
「各ターンの〜」は `"target":"both"` を明示します。

**有効なゾーン**：`this` は**そのカード自身に起きたこと**なので、バトルゾーンを離れた後でも誘発します
（「破壊された時」など）。一方 `self` / `opponent` / `both` は**プレイヤーのイベントを見張る**常在的な能力なので、
カードが**バトルゾーンか表向きのシールドにある間だけ**有効です。
そのため、ツインパクトの呪文面を唱えても、そのカード自身のクリーチャー面の
`{"on":"castSpell","target":"self"}` は誘発しません（唱えたカードは墓地にあるため）。

> `startOfTurn` はターン交代時に発火するため、**ゲーム最初のターン（先攻1ターン目）では発火しません**
> （そのタイミングではまだバトルゾーンにカードがないので実害はありません）。

```jsonc
{"on":"leave"}                      // このクリーチャーが離れた時
{"on":"attackEnd"}                 // このクリーチャーの攻撃の終わりに（攻撃終了ステップ）
{"on":"leave","target":"self"}      // 自分のクリーチャーが離れた時
{"on":"destroyed","target":"opponent"} // 相手のクリーチャーが破壊された時
```

### 追加パラメータ
| パラメータ | 説明 |
|---|---|
| `filter` | 主体カードの条件（効果と同じ filter 語彙）。例 `{"raceContains":"ドラゴン"}` |
| `method` | **どうやって出したか**。`"summon"` / `"put"`（`creaturePutBz` 専用）／ `"cast"`（`castSpell` 専用）→ **§7.6.5** |
| `paid` | **コストを支払ったか**（`creaturePutBz` / `castSpell`）。`true` / `false` → **§7.6.5** |
| `manaTapped` | **マナゾーンのカードを実際にタップしたか**（`creaturePutBz` / `castSpell`）。`paid` とは別物 → **§7.6.5** |
| `firstEachTurn` | `attack` 等で「各ターン最初の1回のみ」 |
| `optional` | 「〜してもよい」 |
| `hyperOnly` | ハイパーモード時のみ発火 |
| `oncePerTurn` | 「各ターンに一度」。実際に解決した時だけ消費（辞退しても消費しない） |
| `oncePerGame` | 「ゲーム中に一度」（終極宣言など） |
| `lastCard` | `on:"draw"` 専用。引いた結果、山札が0枚になった時だけ誘発 |
| `fromZone` | `on:"castSpell"` 専用。**どこから唱えた呪文か**（`hand` / `grave`）。「自分の手札から呪文を唱えた時」用 |
| `turnOf` | **誰のターンに起きたイベントか**。`self` / `opponent` / `both`(既定)。「相手のターンにこのクリーチャーが出た時」用 |
| `condition` | → **§7.19**（`shieldCount` / `shieldsBroken` / `civicCount` / `stackCount` / `{flag:"…"}`） |

```jsonc
// 相手が効果でクリーチャーを出した時（召喚は対象外）
{"on":"creaturePutBz","target":"opponent","method":"put","effects":[ … ]}

// 相手がコストを支払わずにクリーチャーを出した時（S・トリガー、「出す」効果など）
{"on":"creaturePutBz","target":"opponent","paid":false,"effects":[ … ]}

// 各ターン、はじめて自分のクリーチャーが攻撃する時
{"on":"attack","target":"self","firstEachTurn":true,"effects":[ … ]}

// 相手が呪文を唱えた時
{"on":"castSpell","target":"opponent","effects":[ … ]}

// 各ターンに一度、クリーチャーが出た時、山札の上をシールド化してもよい
{"on":"creaturePutBz","target":"both","oncePerTurn":true,"optional":true,
 "effects":[{"type":"topToShield","amount":1,"label":"山札の上をシールド化"}]}
```

### 任意誘発（`optional`）の確認タイミング

`optional` / `oncePerTurn` の誘発は、**他の任意誘発と同じモーダル**（誘発順序モーダル）で
「発動する／発動しない」を問われます。単独で誘発した場合もモーダルが出ます。
「発動しない」を選んだ能力は `oncePerTurn` を **消費しません**（同ターン中に再び誘発すれば再度問われる）。

## 7.5. 超魂X（SSX / Super Soul Cross）

`ssx` に書いた能力は **そのカードが持つ「通常の能力」**（`keywords` / `triggers` に書いたものと同じ扱い）。
特別なゾーン処理はありません。**SSX 固有のルールは1つだけ**——

> **このカードがクリーチャーの「下」に置かれている間、その上のクリーチャーもこの能力を持つ。**

```jsonc
// 例: ガヤルドスカイ-A3 — 超魂X の「ブロッカー」
{ "name":"ガヤルドスカイ-A3", "type":"creature", "civ":"light", "cost":3, "power":4500,
  "keywords":[],                       // 通常表記の能力は無し
  "ssx": { "keywords":["blocker"] } }  // 超魂X の能力（＝このカードの通常能力）
```

- このカード自身は、`keywords:["blocker"]` と書いたのと同じようにブロッカーとして扱われます。
- **加えて**、このカードを下に持つクリーチャー（進化元など）もブロッカーを得ます。

### `ssx` には任意の「能力フィールド」が書ける

`ssx` の中身は **カード直下に書ける能力フィールドと同じ語彙**です。`keywords` / `triggers` に限らず、
`activated`(§7.6) `costReduce` `condPower` `grantKeywords` `grantPowerBoost` `grantPowerBoostGrave`
`selfPowerBoostGrave` `powerAttacker` `poweredBreaker` `hyperKeywords` `hyperPower` が使えます。
（`id` `name` `cost` `power` `civ` `type` `race` などカードの同一性に関わるものは書けません。）

マージ規則は「配列＝連結／数値＝加算／真偽＝OR」なので、**同じ能力を複数持つ**ことも、
**下のカードの超魂Xを重ねる**こともそのまま表現できます。

```jsonc
// 誘発能力（通常の triggers と同じ書式。下のクリーチャーにも伝播する）
"ssx": { "triggers":[ { "on":"attack", "optional":true, "effects":[ … ] } ] }

// 複数の能力を1枚に（例: パワーアタッカー＋4000 と 起動型能力）
"ssx": {
  "powerAttacker": 4000,
  "activated": [ { "label":"自分の墓地からクリーチャーを1体出す", "oncePerTurn":true,
                   "effects":[{"type":"graveToBz","filter":{"creatureOnly":true}}] } ]
}

// スタック枚数を条件にする（このクリーチャーにカードが3枚以上あれば +6000 かつ Wブレイカー）
"ssx": {
  "condPower":[ { "condition":{"type":"stackCount","count":3}, "amount":6000 } ],
  "grantKeywords":[ { "keyword":"wBreaker", "condition":{"type":"stackCount","count":3} } ]
}
```

カード表示では紫の **SSX** バッジが付き、キーワードのバッジは通常能力と同じ色で表示されます。

## 7.6. 起動型能力（`activated`）と「各ターンに一度」

プレイヤーが任意のタイミングで自分から使う能力は `activated` に書きます。
バトルゾーンのボタン **「起動能力 (N)」** から一覧が開き、選んで発動します。

```jsonc
"activated": [
  { "label": "自分の墓地からクリーチャーを1体、バトルゾーンに出す",
    "oncePerTurn": true,        // 各ターンに一度（"oncePerGame":true なら ゲーム中に一度＝終極宣言）
    "timing": "ownTurn",        // "ownTurn"(自分のターン中/既定) | "any"(いつでも)
    "condition": {"type":"stackCount","count":3},   // 省略可
    "effects": [ { "type":"graveToBz", "filter":{"creatureOnly":true} } ] }
]
```

| フィールド | 説明 |
|---|---|
| `label` | UI に出る説明文（必須ではないが無いと何の能力か分からない） |
| `effects` | 効果本体（§2 と同じ記法。必須） |
| `oncePerTurn` / `oncePerGame` | 使用回数制限。使用済みの間は候補に出ない |
| `timing` | `"ownTurn"`(既定) / `"any"` |
| `condition` | §7 の `condition` と同じ |

- 有効なゾーンは **バトルゾーン＋表向きのシールド**（継続能力が働く場所）。
- `oncePerTurn` はターン終了時にリセット、`oncePerGame` はゲーム中リセットされません。
- `ssx.activated` に書けば、下に敷かれたクリーチャーの起動型能力として上のクリーチャーも使えます。

## 7.6.5. プレイの出自 — `method` / `paid` / `manaTapped`

クリーチャーが出た時（`creaturePutBz`）と呪文を唱えた時（`castSpell`）のイベントは、
**独立した3つの軸**を持っています。誘発側で好きな軸だけを指定して絞れます。

| 軸 | 値 | 意味 |
|---|---|---|
| `method` | `"summon"` | **召喚した**（手札・墓地・マナからのプレイ、D・D・D、S・トリガー、鬼エンド等） |
| | `"cast"` | **唱えた**（呪文。`castSpell` 専用） |
| | `"put"` | **効果で出された**（`graveToBz` / `manaToBz` / `handToBz` / ファイナル革命 等） |
| `paid` | `true` | **コストを支払った**。通常のプレイ、D・D・D、リサイクル |
| | `false` | **コストを支払っていない**。S・トリガー、鬼エンド、アタック・チャンス、ニンジャ・ストライク、G・ゼロ、`freeCast`、革命チェンジ、「出す」効果すべて |
| `manaTapped` | `true` | **マナゾーンのカードを1枚以上タップした** |
| | `false` | **1枚もタップしていない** |

**書かなかった軸では絞りません**（従来どおり、出し方を問わず誘発します）。

### `paid` と `manaTapped` は別物

**コスト0のカードや、軽減でコストが0になったカードを普通にプレイした時**が両者の分かれ目です。
「支払った額が0」であって「支払わなかった」わけではないので `paid:true`、
でもマナゾーンは1枚もタップしていないので `manaTapped:false` になります。

| プレイ | `method` | `paid` | `manaTapped` |
|---|---|---|---|
| 手札から普通に召喚／唱える | `summon` / `cast` | `true` | `true` |
| **コスト0（または軽減で0）を普通にプレイ** | `summon` / `cast` | **`true`** | **`false`** |
| D・D・D | `summon` / `cast` | `true` | `true` |
| S・トリガー | `summon` / `cast` | `false` | `false` |
| 鬼エンド／アタック・チャンス／ニンジャ・ストライク | `summon` / `cast` | `false` | `false` |
| G・ゼロ／`freeCast`／革命チェンジ | `summon` | `false` | `false` |
| `graveToBz` などの「出す」効果 | `put` | `false` | `false` |
| `playFromHand`（効果で唱える／召喚する） | `cast` / `summon` | `free:true` なら `false` | `false` |

```jsonc
// 「相手がコストを支払わずに呪文を唱えた時」
{ "on":"castSpell", "target":"opponent", "paid":false, "effects":[ … ] }

// 「このクリーチャーがコストを支払わずに召喚された時」（効果で出された場合は誘発しない）
{ "on":"creaturePutBz", "method":"summon", "paid":false, "effects":[ … ] }

// 「自分がマナを1枚もタップせずにクリーチャーを出した時」（コスト0も、S・トリガーも含む）
{ "on":"creaturePutBz", "target":"self", "manaTapped":false, "effects":[ … ] }
```

> **内部では枚数（数値）で持っています。** 誘発の `manaTapped` は「1枚以上か」を見る真偽値ですが、
> イベント側は実際にタップした枚数を持っているので、「マナを2枚以上タップして召喚した時」の
> ような条件が要るカードが出てきたら、キーを増やすだけで表現できます。

> タマシード／フィールド／城は `creaturePutBz` を通らない（クリーチャーではない）ので、
> この3軸は付きません。自分自身の「出た時」だけが誘発します。

## 7.7. 墓地・マナゾーンからの召喚（`summonFrom` / `grantSummonFrom`）

通常クリーチャーは手札からしか召喚できません。この2つはその**召喚元ゾーンを追加**します。
どちらも「召喚」なので、**コストは通常どおり支払い**、召喚酔いも付き、
`creaturePutBz`（`method:"summon"`）が誘発します。効果でバトルゾーンに「出す」
（`graveToBz` / `manaToBz`）とは別物です。

### 継続能力 `summonFrom`（例: 貴布人 テブルカッケ＝エディ）

```jsonc
"ssx": {
  "summonFrom": [
    { "zone": "grave",            // "grave" | "mana"
      "timing": "ownTurn",        // "ownTurn"(既定) | "any"
      "maxPerTurn": 1,            // 省略すると回数無制限
      "filter": { "creatureOnly": true },
      "label": "自分のターン中、クリーチャーを1体、自分の墓地から召喚してもよい" }
  ]
}
```
- 能力フィールドなので**カード直下にも `ssx` 内にも**書けます（`ssx` なら下のクリーチャーへ伝播）。
- 有効ゾーンは **バトルゾーン＋表向きのシールド**。

### そのターン限りの許可 `grantSummonFrom`（例: 蛇手の親分ゴエモンキー！）

```jsonc
"triggers": [ { "on":"creaturePutBz", "effects":[
  { "label":"そのターン、自分のマナゾーンからクリーチャーを召喚してもよい",
    "type":"grantSummonFrom", "zone":"mana", "filter":{"creatureOnly":true} } ]} ]
```
`maxPerTurn` / `timing` / `target` も指定できます。許可はターン終了時に消えます。

### UI

召喚できるカードがあるゾーン（墓地／マナ）の枠が**黄色く光り ▲ が付き**、
クリックすると中身の一覧が開いて各カードに「召喚 (コスト)」ボタンが出ます。
マナから召喚する場合、そのカード自身はコスト支払いには使えません。

---

## 7.8. 進化元のゾーンと枚数（`evolution`）

`type:"evo_creature"` のカードに書きます。**進化元がどのゾーンの何体か**を指定します。

```jsonc
"evolution": { "zone":"grave", "count":1, "filter":{"civ":"darkness"} }  // 墓地進化−闇
"evolution": { "zone":"mana",  "count":1, "filter":{"civ":"fire"} }      // マナ進化−火
"evolution": { "zone":"grave", "count":3 }                               // 墓地進化GV
"evolution": { "zone":"grave", "min":1 }                                 // 超無限墓地進化
"evolution": { "filter":{"civ":"fire","raceContains":"ドラゴン"} }        // 通常の進化（BZ）
```

| フィールド | 説明 |
|---|---|
| `zone` | `"bz"`(既定) / `"grave"` / `"mana"` |
| `count` | 進化元の枚数（既定1）。ちょうどこの枚数を選ぶ |
| `min` | 「N体以上」。上限なし（超無限系）。`count` とは併用不可 |
| `neo` | `true`（NEO進化）/ `"g"`（G-NEO進化）。**重ねるかどうかが任意**になる → §7.26 |
| `filter` | 進化元の条件（§2 と同じ filter 語彙）。クリーチャー限定は暗黙に適用 |

### ルール上の注意

- **進化元は「バトルゾーンに出た」ことにならない**。バトルゾーンを経由せず直接下に敷かれるので、
  進化元の「出た時」は誘発せず、「クリーチャーが出た時」も**出た進化クリーチャー1体分**しか数えません。
  「手札以外からバトルゾーンに出せない」系の制限も、進化クリーチャー自身が手札から出るなら**かかりません**。
- **進化クリーチャーなので召喚酔いしない**（出たターンから攻撃できる）。種別は「進化クリーチャー」のまま。
  ただし NEO進化は**下にカードがある間だけ**進化クリーチャーとして扱われます（§7.26）。
- **マナ進化の進化元はタップされていても選べる**。ただし進化元にしたマナは**コスト支払いには使えません**。
- 複数体の進化元は**選んだ順に下から重なります**（バトルゾーンに出た後は順序を変えられない）。
- **ツインパクトは進化元にできます**。「クリーチャーを1体選び」はクリーチャー側を参照するので、
  墓地・マナ・バトルゾーンのどこにあっても候補に入ります（呪文とタマシードは候補外）。
- コストは通常どおり支払います。

## 7.9. メテオバーン（`meteorBurn`）

そのクリーチャーの**下にあるカード**を指定数だけ動かすことを**コスト**として発動する能力。
`effects` の**先頭**に置きます。

```jsonc
{ "on":"attack", "effects":[
  { "label":"このクリーチャーの下にあるカードを1枚墓地に置いてもよい",
    "type":"meteorBurn", "count":1, "to":"grave", "optional":true },
  { "label":"自分の山札の上から3枚を墓地に置く", "type":"topToGrave", "amount":3 },
  { "label":"相手のクリーチャーを1体選んで破壊する", "type":"destroy", "target":"opponent", "amount":1 } ]}
```

| フィールド | 説明 |
|---|---|
| `count` | 動かす枚数（既定1） |
| `to` | 移動先。`grave`(既定) / `mana` / `hand` / `shield` / `deck`(山札の下) |
| `optional` | 「〜してもよい」 |
| `tapped` | `to:"mana"` の時、タップして置く |

- 動かすカードは**選べます**。順番は変えられず、抜けた場所は**詰められます**。
- **支払えなければ（辞退・枚数不足・クリーチャーがバトルゾーンにいない）、以降のステップは実行されません。**
  メテオバーンはコストなので、後続に `ifPrevious`(§3.5) を書かなくても常にこうなります。
  革命チェンジ等でそのクリーチャーが居なくなっていれば**不発**です。

## 7.10. 敗北の置換（`replaceLose`）

「〜でゲームに負ける時、かわりに勝つ」を表現します。能力フィールドなので `ssx` にも書けます。
有効なゾーンは**バトルゾーン＋表向きのシールド**です。

```jsonc
"replaceLose": [
  { "from": "deckOut", "to": "win",
    "label": "自分の山札の最後の1枚を引いたことによってゲームに負ける時、かわりに勝つ" }
]
```

| フィールド | 説明 |
|---|---|
| `from` | 置換する敗北の原因。現状 `"deckOut"`（ライブラリアウト＝山札が0枚になった）のみ |
| `to` | `"win"`（EXWIN として勝利） |

置換効果なので、**必ず「例外処理で中止（通常どおり敗北）」を選べるモーダル**が出ます。
勝利画面は **EXTRA WIN!** 表示になります。

> **ライブラリアウト（LO）は「山札が0枚になった瞬間」に成立します**（引こうとした時ではありません）。
> ドローに限らず、山札が減るあらゆる操作（`topToGrave` / `topToMana` / `search` など）の直後に判定されます。
> 状態起因処理なので、同時に誘発した能力より**先に**解決されます。

---

## 7.11. フィールド（`type:"field"`）

「ヒストリック・フィールド」などの**フィールド**は、バトルゾーンに**横向きで置かれるエレメント**です。
`type:"field"` と書くだけで次のように扱われます。

- クリーチャーではないので**攻撃できず、攻撃されません**（タマシードと同じ）。パワーは持ちません
- **エレメント**なので `filter` の `"element": true` や `"type": "element"` に一致します
- 出た時（`triggers:[{on:"creaturePutBz"}]`）や継続能力はクリーチャーと同じように書けます。
  「クリーチャーが出た時」の誘発は**しません**
- マナや墓地から出す場合は `manaToBz` / `graveToBz` に `"filter": {"type": "field"}` を書きます

## 7.12. コストを支払わずにプレイする（`freeCast`）

「自分は呪文をコストを支払わずに唱えてもよい」のような**継続能力**です。
有効なゾーンは**バトルゾーン＋表向きのシールド**（`summonFrom` と同じ）。

```jsonc
"freeCast": [ { "filter": { "type": "spell" } } ]
```

| キー | 説明 |
|---|---|
| `filter` | どのカードが対象か（省略で全部）。§2 の filter 語彙 |
| `timing` | `"ownTurn"`(既定) / `"any"` |

- 「〜**してもよい**」なので、通常どおりコストを払ってプレイすることも選べます。
  手札のカードを選ぶと **「コスト不要」ボタン**が増え、押すとマナを1枚もタップせずにプレイします
- ツインパクトは両面で判定し、呪文面だけが条件に合えば呪文として唱えます

## 7.13. ガードマン（`guardman`）

「このクリーチャーをタップして、相手クリーチャーの攻撃先を、自分の**他の**クリーチャーから
このクリーチャーに変更してもよい」。`"keywords": ["guardman"]` と書くだけで動きます。

- タイミングは**ブロッカーと同じ**（攻撃先が決まった後のブロック・ステップ）。
  同じモーダルにブロッカーと並んで出ます
- 使えるのは**攻撃先が自分の他のクリーチャーの時だけ**。シールドやプレイヤーへの攻撃、
  および自分自身が攻撃先の場合は使えません
- **タップ済みでは使えません**（自分をタップするのがコスト）
- ブロックではなく**攻撃先の変更**なので、変更後は攻撃クリーチャーとバトルになります

## 7.14. 「選ばれない」（`unselectable`）

「相手が自分のクリーチャーを選ぶ時、〜は選ばれない」を表します。キーワード `unselectable` で、
`grantKeywords` から付与するのが基本です。

```jsonc
// 相手が自分のクリーチャーを選ぶ時、自分の他のドリームメイトは選ばれない
"grantKeywords": [
  { "keyword": "unselectable", "filter": { "raceContains": "ドリームメイト", "notSelf": true } }
]
```

- **相手が選ぶ時だけ**効きます。自分で自分のカードを選ぶのは妨げません
- **攻撃先の選択にも効きます**（攻撃するクリーチャーを選ぶのも「選ぶ」ため）
- **「選ぶ」効果にだけ効きます。** `all` / `random` のように選ばない効果（全体除去など）は防げません

## 7.15. 攻撃できる対象とマッハファイター／ワールド・ブレイカー

### 攻撃できる対象（基本ルール）

攻撃クリーチャーが攻撃できるのは、**相手プレイヤー**か、**タップされている相手クリーチャー**です。
**アンタップしているクリーチャーは攻撃できません。**
タマシードとフィールドはクリーチャーではないので攻撃されません。

**シールドへの攻撃という攻撃先はありません。** シールドは「プレイヤーへの攻撃を代わりに受ける」
ものなので、攻撃先は常に「クリーチャー」か「プレイヤー」の2つだけです。
両者の違いはシールドがあるかどうかだけで、それは**シールドが離れるタイミングで数え直します**。

- シールドがあれば、ブレイカーの数だけブレイクされる
- **シールドが0枚なら、その攻撃はプレイヤーに通り、攻撃側の勝ちになる**

数え直すのは「攻撃する時」の誘発をすべて解決した後なので、
攻撃時の効果でシールドが0枚になればそのまま勝ち、逆にシールドが増えればブレイクになります。

### `machFighter`（マッハファイター）

「このクリーチャーは、**出たターンの間**、**タップまたはアンタップしているクリーチャー**を攻撃できる」。

- 出たターンの間だけ、上の基本ルールを越えて**アンタップしているクリーチャーも攻撃できます**
- 「クリーチャーを攻撃できる」許可なので、**これだけを頼りに攻撃している間は
  シールドもプレイヤーも攻撃できません**。スピードアタッカーも持っていれば普通に攻撃できます
- 有効期間は「バトルゾーンに出たターン」。召喚でも効果で出た場合でも同じです

### `worldBreaker`（ワールド・ブレイカー）

シールドを**すべて**ブレイクします。

## 7.16. 離れる時の置換（`replaceLeave`）

「自分のクリーチャーが離れる時、かわりに〜に置いてもよい」。有効なゾーンは
**バトルゾーン＋表向きのシールド**です。

```jsonc
"replaceLeave": [ { "to": "mana", "filter": { "creatureOnly": true } } ]
```

| キー | 説明 |
|---|---|
| `to` | `"mana"`(既定) / `"hand"` / `"shield"` / `"deck"`（**山札の下**） / `"effect"`（下記） |
| `from` | `"destroy"` と書くと**破壊される時だけ**に限定する（省略すると離れ方を問わない） |
| `filter` | どのカードに適用するか（省略で全部） |

> **「このクリーチャーが破壊される時、墓地に置くかわりにマナゾーンに置く」**（キャディ・ビートル）は
> `from:"destroy"` と `filter.self` を組み合わせて書きます。
> ```jsonc
> "replaceLeave": [ { "from":"destroy", "to":"mana", "filter":{ "self":true } } ]
> ```
> `from` を書かなければ「離れる時」なので、手札やマナへ送る除去にも掛かります（→ 下の箇条書き）。
>
> **「このクリーチャーが破壊される時、かわりに山札の下に置く」**なら `to` を変えるだけです。
> ```jsonc
> "replaceLeave": [ { "from":"destroy", "to":"deck", "filter":{ "self":true } } ]
> ```

#### `to:"effect"`（かわりに〜する）

> このクリーチャーが離れる時、**かわりに自分の他のクリーチャーを1体破壊してもよい**。

ゾーンへ動かすのではなく、書かれた効果を行う置換です。**本体はバトルゾーンに残ります**
（エスケープと同じ流儀）。

```jsonc
"replaceLeave": [
  { "to": "effect",
    "filter": { "self": true },
    "effects": [
      { "label": "自分の他のクリーチャーを1体破壊する",
        "type": "destroy", "target": "self",
        "filter": { "creatureOnly": true, "notSelf": true } }
    ] }
]
```

- `effects` は `to:"effect"` の時だけ書けます（1つ以上必要）
- **`filter.notSelf` が「自分の“他の”」**にあたります。置換元自身を候補から外します
- **行えない時は提示しません。** 上の例で他にクリーチャーがいなければ、
  置換モーダルが出ずに通常どおり離れます（身代わりが居ないのに生き延びるのを防ぐため）
- 「〜してもよい」は、置換モーダルの「例外処理で中止」がそのまま担います（§0）

- §0のとおり**必ず例外処理で中止できる**モーダルで提示します（中止すると通常どおり破壊）
- 置換されたカードは破壊されていないので `destroyed` は誘発せず、`leave` だけ誘発します
- **バトルによる破壊だけでなく、効果による除去にも掛かります**（`destroy` / `bzToHand` /
  `bzToMana` / `bzToShield`）。エスケープは「破壊されるかわりに」なので墓地へ送る効果にだけ効きます
- 同じカードに複数の置換がかかりうる場合は、**エスケープ → G-NEO進化 → `replaceLeave`** の順に
  1つずつ聞きます。中止したものは同じ除去の中で聞き直しません

## 7.17. 超次元ゾーン（`hyper`）

ゲーム外の公開領域です。`handToHyper` で置けます。**置かれたカードは戻す手段がありません。**
枚数が1枚以上ある時だけ盤面にカウンタが出て、タップすると中身を閲覧できます。

## 7.18. 鬼エンド（`oniEnd`）

**シールドが1つもないプレイヤーがいる**ことを条件に働く能力です。自分・相手のどちらのシールドが
0でも成立します（追い詰められている側でも使えます）。使い方は2通りあります。

### (a) 手札から、コストを支払わずにプレイする — カード直下の `oniEnd`

> ＜鬼エンド＞クリーチャーが攻撃する時、シールドが1つもないプレイヤーがいて、自分のマナゾーンに
> 闇のカードと火のカードがそれぞれ1枚以上あれば、この呪文を自分の手札からコストを支払わずに唱えてもよい。

```jsonc
"oniEnd": {
  "on": "attack",                                        // 誘発イベント（既定 "attack"）
  "target": "both",                                      // 誰のイベントか（既定 "both"。"this" は不可）
  "manaHas": [ {"civ":"darkness"}, {"civ":"fire"} ]       // 追加条件（省略可）
}
```

| キー | 説明 |
|---|---|
| `on` | §7 のイベント名。既定 `"attack"` |
| `target` | `self` / `opponent` / `both`（既定）。手札のカードなので `this` は使えません |
| `manaHas` | 自分のマナゾーンが、**それぞれ1枚以上**満たすべき filter の配列。§2 の filter 語彙 |

- 条件が揃うと、そのプレイヤーに確認モーダルが出ます。「〜してもよい」なので必ず見送れます
- **呪文なら唱え、クリーチャーなら召喚**します（チャージャーはマナゾーンへ行きます）
- 同じ攻撃に対して**複数枚まとめて宣言できます**。順番はここでは決めません。
  **1枚解決するたびに、その間に誘発した能力と一緒に並べ直して選び直します**（→ §7.28）
- 解決の順番は、同時に誘発した能力を**すべて解決した後**です

### (b) 誘発を「鬼エンド」で条件付ける — `condition`

> ＜鬼エンド＞このクリーチャーがバトルゾーンに出た時、シールドが1つもないプレイヤーがいれば、〜

```jsonc
"triggers": [
  { "on": "creaturePutBz", "condition": { "type": "oniEnd" }, "effects": [ … ] }
]
```

`condition:{type:"oniEnd"}` は `{type:"shieldCount", who:"any", max:0}` の**別名**です（→ **§7.19**）。
両者のシールドを見るため、相手の盤面を参照できる `triggers` / `activated` でのみ使えます
（パワー強化や `grantKeywords` の条件には書けません。validator がエラーにします）。

## 7.19. シールドの数を見る条件（`shieldCount` / `shieldsBroken`）

「革命2：自分のシールドが2つ以下なら」「シールドが1つもないプレイヤーがいて」（鬼エンド）のように、
**シールドの枚数を条件にする能力**は1つの条件型にまとめてあります。

```jsonc
"condition": { "type": "shieldCount", "who": "self", "max": 2 }   // 革命2
"condition": { "type": "shieldCount", "who": "self", "max": 0 }   // 革命0
"condition": { "type": "shieldCount", "who": "any",  "max": 0 }   // 鬼エンド（= {type:"oniEnd"}）
```

| キー | 説明 |
|---|---|
| `who` | `self`(既定) / `opponent` / `any`（**どちらかのプレイヤー**が満たせば成立） |
| `min` / `max` | 枚数の下限・上限。**どちらか一方は必須**、両方書けば範囲 |

**このターンにブレイクされた枚数**を見るときは `shieldsBroken` を使います（キーは同じ）。

```jsonc
// 「このターンに2つ以上自分のシールドがブレイクされていなければ」
"condition": { "type": "shieldsBroken", "who": "self", "max": 1 }
```

- `who:"self"` は**自分の盤面しか見ない**ので、`condPower` や `grantKeywords` のような
  **継続能力の条件にも書けます**（革命0がこれを使います）
- `who:"opponent"` / `who:"any"` は相手の盤面が要るため、**`triggers` / `activated` でしか書けません**
  （継続能力の評価経路には相手の状態が渡らないため。validator がエラーにします）
- `shieldsBroken` の数はターンの終わりに両者ぶんリセットされます

## 7.20. ジャストダイバー（`justDiver`）

> ジャストダイバー（このクリーチャーが出た時、次の自分のターンのはじめまで、
> このクリーチャーは相手に選ばれず、攻撃されない）

`keywords` に `justDiver` と書くだけです。効果側の実装は要りません。

```jsonc
"keywords": ["justDiver", "blocker"]
```

バトルゾーンに出た瞬間に、`unselectable`（相手に選ばれない）と `unattackable`（攻撃されない）を
**次の自分のターンのはじめまで**の期限付きで自分に付与します（`tempBuff.expires:"ownTurnStart"`）。
どの経路で出ても付きます — 召喚・`handToBz` / `manaToBz` / `graveToBz` / `revealedToBz` /
`search{destination:"bz"}` / 鬼エンド・D・D・D による召喚。

- **「選ぶ」効果にだけ効きます。** `all` / `random` のような全体除去は「選んで」いないので防げません
  （→ **§7.14**。ジャストダイバー持ちも巻き込まれます。これが正しい挙動です）
- 相手のターンが終わって**自分のターンが始まると切れます**。相手のターンの間はずっと守られます
- `unselectable` / `unattackable` を単体で使うこともできます（期限なしの常在能力になります）
- 攻撃先の判定・UI の両方に反映されるので、選べないクリーチャーは盤面上でも暗く表示されます

## 7.21. D・D・D（`ddd`）

> D・D・D[自然(2)]（自分のクリーチャーが攻撃する時、このカードを[自然(2)]支払って
> 自分の手札から実行してもよい）

**鬼エンド（→ §7.18）と同じ「手札からの宣言型プレイ」**です。違うのは
**コストを支払う**ことだけで、解決の経路は共通です。

```jsonc
"ddd": {
  "on": "attack",                                  // 誘発イベント（既定 "attack"）
  "target": "self",                                // 誰のイベントか（既定 "both"。"this" は不可）
  "cost": { "cost": 2, "civs": ["nature"] }        // 必須。支払うコスト
}
```

| キー | 説明 |
|---|---|
| `on` | §7 のイベント名。既定 `"attack"` |
| `target` | `self` / `opponent` / `both`（既定）。手札のカードなので `this` は使えません |
| `cost` | **必須**。`alternateCost` と同じ形。`cost` は合計マナ、`civs` は**それぞれ1枚以上必要な文明** |

- `[自然(2)]` = 「合計2マナ、うち1枚以上は自然」です。自然1＋火1 でも払えます
- **コストを払えない時は提示しません。** 見せてから弾くのではなく、候補算出の段階で外します
- 宣言すると支払いモーダル（`ManaPayModal`）が出ます。**取りやめれば元の選択に戻ります**
- これは「出す」ではなく**召喚 / 呪文の実行**です。呪文なら唱えた後に墓地へ行き、
  クリーチャーなら召喚酔いします（スピードアタッカー持ちは除く）
- 同じ攻撃に対して**複数枚まとめて宣言できます**。順番はここでは決めません。
  **1枚解決するたびに、その間に誘発した能力と一緒に並べ直して選び直します**（→ §7.28）
- 解決の順番は鬼エンドと同じく、同時に誘発した能力を**すべて解決した後**です

## 7.22. 唱えた後の行き先の置換（`spellAfterCast` / `afterCast`）

置換の書き方は2つあります。**どちらも「呪文を唱え終えて墓地に置こうとする時」を置換します。**

| 書き方 | 意味 | どこに書く |
|---|---|---|
| `spellAfterCast` | **継続能力**。そのカードが場にいる間、条件に合う呪文すべてに効く | カード直下 |
| `afterCast` | **一度きり**。その `playFromHand` で唱えた1枚にだけ乗る | `playFromHand` ステップ |

### (a) 継続能力 `spellAfterCast`

> 自分の**墓地から呪文を唱えた後**、墓地のかわりに山札の下に置く。

`replaceLeave`（→ §7.16）と同じ流儀の**継続的な置換**です。カード直下に書き、
そのカードが**バトルゾーンか表向きシールドにいる間**、その持ち主の呪文に効きます。

```jsonc
"spellAfterCast": [
  { "from": "grave", "to": "deckBottom" }
]
```

| キー | 説明 |
|---|---|
| `from` | その呪文を**唱えたゾーン**。`"hand"` / `"grave"` / `"any"`（既定＝どこからでも） |
| `to` | 墓地のかわりの行き先。`deckBottom`(既定) / `deckTop` / `hand` / `mana` / `shield` |
| `filter` | 対象の呪文の条件（省略可） |

- **置換なので必ず確認モーダルが出ます。**「例外処理で中止」を選べば墓地のままです（§0）
- チャージャーはマナゾーンへ行くので、置換の対象外です

> **判定するのは「呪文を解決しきって、墓地に置こうとする時」です**（総合ルール604.2）。
> 唱えた直後ではありません。**唱えた呪文自身の効果で置換元がバトルゾーンを離れたら、置換は起きません。**
>
> 例: 龍素記号wD サイクルペディアの「出た時」で墓地から MAX鬼無双 を唱え、その MAX鬼無双 で
> サイクルペディアを破壊した場合 — MAX鬼無双 は**墓地に残ります**。唱え終えた時点で
> サイクルペディアはバトルゾーンにいないので、置換効果が適用されないためです。
>
> 実装では、唱えた時点ではカードをどのゾーンにも置かず、後始末の待ち行列（`spellAfterCastRef`）に
> 預けておきます。その呪文の本体が待ち行列（`pendingEffects`）から消えた＝解決しきった、という判定で
> 墓地（チャージャーならマナゾーン）へ置き、その直前に盤面を見直して置換を判定します。
> 誘発した能力の解決よりも先に行います。

> **唱えている間、その呪文はどのゾーンにもいません。**
> 「自分の墓地のカードを数える」ような効果が、唱えている最中のその呪文自身を数えてしまうことはありません。

### (b) 一度きりの置換 `afterCast`（「そうしたら、唱えた後、〜」）

> このクリーチャーが出た時、コスト7以下の呪文を1枚、自分の墓地からコストを支払わずに唱えてもよい。
> **そうしたら、唱えた後、墓地に置くかわりに手札に加える。**

「その呪文だけ」に掛かる置換なので、継続能力ではなく **`playFromHand` ステップに書きます**。

```jsonc
"triggers": [
  { "on": "creaturePutBz",
    "effects": [
      { "label": "コスト7以下の呪文を1枚、自分の墓地からコストを支払わずに唱えてもよい",
        "type": "playFromHand", "zone": "grave", "free": true, "optional": true,
        "filter": { "type": "spell", "maxCost": 7 },
        "afterCast": { "to": "hand" } }
    ] }
]
```

| キー | 説明 |
|---|---|
| `afterCast.to` | 墓地のかわりの行き先。`spellAfterCast` の `to` と同じ語彙 |

- **「そうしたら」は自動です。** 唱えなかった（スキップした）なら置換も起きないので、
  `ifPrevious` は要りません
- 同じステップで唱えた**その1枚にだけ**乗ります。他の呪文には影響しません

### 同じイベントを置換する効果が複数あるとき

DMでは、**同じイベントを置換する効果が2つ以上あっても、適用されるのは1つだけ**です。
影響を受ける側が**どれを適用するか選び、選ばなかった置換は起きません**。

そこで候補が2つ以上あるときは、**1つ選ぶモーダル**を出します。

> 例: 上のクリーチャーの能力（→ 手札）で墓地から呪文を唱え、その時
> 龍素記号wD サイクルペディア（→ 山札の下）が場にいる場合。
> 「手札に加える」と「山札の下に置く」のどちらか一方だけを選びます。

- 候補が1つなら、これまでどおり適用／中止の確認モーダルです
- 候補が2つ以上なら選択式になり、**「どれも適用しない（例外処理）」**も選べます（§0）
- 候補の並び順は「① `afterCast`（唱えた効果自身） → ② `spellAfterCast`（場のカード）」です

## 7.23. 呪文を唱えられない（`denySpell` / `staticDeny`）

> このクリーチャーが出た時、次の、相手のターンの終わりまで、相手は呪文を唱えられない。

**(a) 期限付き — 効果 `denySpell`**

```jsonc
{ "type": "denySpell", "target": "opponent", "until": "endOfNextTurn" }
```

| キー | 説明 |
|---|---|
| `target` | 縛るプレイヤー。`self` / `opponent` / `both` |
| `until` | `"endOfNextTurn"`（既定）＝**縛られている側のターンが終わると切れる** |
| `filter` | 呪文の条件（省略すると全部）。例 `{"maxCost":5}` |
| `label` | 弾いた時にUIに出す理由（省略時は既定文言） |

**(b) 常在型 — カード直下の `staticDeny`**

```jsonc
"staticDeny": { "type": "cantCastSpell", "filter": { "civ": "fire" } }
```

`staticDeny` は**相手**に効きます（バトルゾーン＋表向きシールドで有効）。
`type` は `cantPutCreature` / `cantPutCreatureFromNonHand` / `cantCastSpell`。

**効く場所は5つ**あり、どれも「見せてから弾く」のではなく**先に外す**ようにしてあります。

| 経路 | 挙動 |
|---|---|
| 手札からプレイ | PLAY ボタンが押せなくなり、理由が出る |
| `playFromHand`（効果） | 唱える候補から外れる |
| 鬼エンド / D・D・D | 提示されない |
| S・トリガー | 呪文（呪文面）の S・トリガーは提示されない。クリーチャーの S・トリガーは通る |
| ツインパクト | **クリーチャー面は普通にプレイできます**（呪文面だけが止まります） |

> 期限は「縛られている側のターンが終わる時」に切れます。相手のターン中にこの効果を使った場合は
> **そのターンの終わりまで**になります（このゲームでは「次の」を厳密に数え直しません）。

## 7.24. S・トリガー（`sTrigger`）の解決

> S・トリガー（このカードを自分のシールドゾーンから手札に加える時、
> **コストを支払わずにすぐ実行してもよい**）

`keywords` に `sTrigger` と書くだけです。ブレイクでも効果（`shieldToHand`）でも同じように働きます。

**「実行」なので、鬼エンド／D・D・D（→ §7.18 / §7.21）と同じ枠組みを通ります。**

- 確認モーダルが出て、**使うかどうかを選べます**（「〜してもよい」なので必ず見送れる）
- **クリーチャーはバトルゾーンに出て**「出た時」が誘発します（召喚酔いしますが、
  相手のターンに出るので次の自分のターンには攻撃できます）
- **呪文は唱えた後に墓地へ**行きます（チャージャーならマナゾーンへ）。
  `spellAfterCast`（→ §7.22）も普通に効きます
- **ツインパクトは呪文面だけが S・トリガーを持てます。** その場合は呪文として唱えます
- G・ストライク持ちは S・トリガーの対象から外れます（排他）
- 呪文を唱えられない状態（→ §7.23）なら、呪文の S・トリガーは提示されません。
  **クリーチャーの S・トリガーは通ります**
- 複数枚まとめてブレイクされた場合は、**まとめて宣言できます**。順番はここでは決めません。
  **1枚解決するたびに、その間に誘発した能力と一緒に並べ直して選び直します**（→ §7.28）

## 7.25. 革命n（`grantSelfSTrigger`）と「5000+」（`powerPlus`）

### 革命2：シールドゾーンから手札に加えるこのカードに「S・トリガー」を与える

```jsonc
"grantSelfSTrigger": { "condition": { "type": "shieldCount", "who": "self", "max": 2 } }
```

通常の `grantKeywords` は**バトルゾーン＋表向きシールドしか見ない**ので、
シールドゾーンから手札に加わるカード自身には届きません。そのための専用フィールドです。

- 書けるのは `condition` だけ。条件の語彙は §7.19（`shieldCount` など）と同じ
- **判定は「手札に加わった後」のシールド枚数**で行います。
  シールドが3枚ある時にそのカードがブレイクされると残り2枚になるので、革命2 は成立します
- 与えるのは S・トリガーだけです。他のキーワードを条件付きで与えるなら `grantKeywords`（→ §8）

### 革命0：パワーを+10000し、「スピードアタッカー」と「T・ブレイカー」を与える

**新しい機構は要りません。** §7.19 の `shieldCount` を条件に、既存の
`condPower` ＋ `grantKeywords` で書きます。

```jsonc
"condPower": [
  { "condition": { "type": "shieldCount", "who": "self", "max": 0 }, "amount": 10000 }
],
"grantKeywords": [
  { "keyword": "speedAttacker", "condition": { …同じ… }, "filter": { "self": true } },
  { "keyword": "tBreaker",      "condition": { …同じ… }, "filter": { "self": true } }
]
```

> **`filter.self` を使ってください。** `grantKeywords` は他のカードにも配る機構なので、
> 「**この**クリーチャーに与える」と書いてあるものは `self:true` で自分だけに限定します
> （`nameContains` で代用すると、同名の2体目にも配ってしまいます）。

### 「5000+」のパワー表記

```jsonc
"power": 5000,
"powerPlus": true
```

`power` は数値のままで、**表示にだけ `+` が付きます**。パワーの計算には一切影響しません
（革命0 が成立していれば `15000+` と出ます）。

## 7.26. NEO進化 / G-NEO進化（`evolution.neo`）

> NEO進化：自分の水のクリーチャー1体の上に置いてもよい。（クリーチャーが下にあれば、
> これをNEO進化クリーチャーとして扱う）
>
> G-NEO進化：水、闇、または火のクリーチャー1体の上に置いてもよい。（カードが下にあれば、
> NEO進化クリーチャーとして扱い、離れる時、かわりに下のカードすべてが離れる）

**進化するかしないかが任意**の進化です。重ねずに出せば通常のクリーチャー（NEOクリーチャー）、
重ねて出せば進化クリーチャー（NEO進化クリーチャー）になります。

```jsonc
// NEO進化：自分の水のクリーチャー1体の上に置いてもよい
"type": "creature",
"evolution": { "zone":"bz", "count":1, "neo":true, "filter":{"civ":"water"} }

// G-NEO進化：闇、火、または自然のクリーチャー1体の上に置いてもよい
"type": "creature",
"evolution": { "zone":"bz", "count":1, "neo":"g", "filter":{"civ":["darkness","fire","nature"]} }
```

**`type` は `"creature"` のままにします**（`"evo_creature"` との併用は validator がエラーにします）。

### 「NEO進化クリーチャーとして扱われる」のはいつか

1. **下にカードのある状態でバトルゾーンにある間**
2. NEO進化クリーチャーとして**バトルゾーンに出そうとしている間**

この2つ以外では、カードとしては**進化クリーチャーではありません**。したがって
ドラゴンズ・サインの「光のコスト7以下の**進化でない**ドラゴンを1体、自分の手札から
バトルゾーンに出す」のような効果でも**選べます**（選ぶ時点ではまだ進化ではないため）。
チェックを終えて出すタイミングで、通常のNEOとして出すか NEO進化として出すかを決めます。

### 召喚酔い

NEO進化クリーチャーは進化クリーチャーなので召喚酔いしません。ただし
**効果で進化元が剥がされて0枚になると、その瞬間から召喚酔いが起こります**
（進化かどうかは書き込み時ではなく**読み出し時**に判定しているため、自然にそうなります）。

### G-NEO進化の除去耐性

進化元が1枚以上ある G-NEO進化クリーチャーが**バトルゾーンを離れる時**、
かわりに**下のカードすべて**を離れさせることができます。本体はバトルゾーンに残ります。

- **行き先は置換元に従います。** 破壊なら墓地、バウンスなら手札、マナ送りならマナゾーン、
  シールド化ならシールドゾーン
- **進化元が0枚なら「G-NEOクリーチャー」**であって G-NEO進化クリーチャーではないので、
  耐性は発動しません
- 置換なので確認モーダルが出ます。§0 のとおり**必ず「例外処理で中止」で通常どおり離れさせられます**
- 置換すると進化元が0枚になるので、そのクリーチャーは進化クリーチャーではなくなります
  （出たターンなら召喚酔いが復活します）

### 革命チェンジできない

「革命チェンジ」のような**入れ替える効果**は、入れ替わるクリーチャーを構成するカードが
すべて手札に戻らない状況では実行されません。G-NEO進化クリーチャーは離れる時に下のカードが
身代わりになるので、**革命チェンジの対象にできません**。進化元0枚の G-NEOクリーチャーなら可能です。

（通常の進化クリーチャーは革命チェンジできます。その場合は**下のカードも一緒に手札へ戻ります**。）

### 効果でバトルゾーンに出す時

`handToBz` / `manaToBz` / `graveToBz` / `zonesToBz` / `revealedToBz` / `playFromHand` で
NEO進化クリーチャーを出す時も、**重ねるかどうかを聞きます**。D・D・D や 鬼エンド、
S・トリガーのような手札からの宣言型プレイでも同じです。

### 関連: `zonesToBz`（複数ゾーンから出す）

「コスト5以下のクリーチャーを1体、自分の**墓地またはマナゾーン**から出す」のように、
候補を複数のゾーンから集めて出します。選ばれたカードは、それがあったゾーンからだけ取り除かれます。

```jsonc
{ "type":"zonesToBz", "zones":["grave","mana"], "amount":1,
  "filter":{"creatureOnly":true, "maxCost":5}, "tempKeywords":["speedAttacker"] }
```

| フィールド | 説明 |
|---|---|
| `zones` | 候補を集めるゾーンの配列（`"grave"` / `"mana"` / `"hand"`）。**2つ以上**必要 |
| その他 | `graveToBz` と同じ（`tempKeywords` / `summoningSickness` / `destroyAtEndOfTurn`） |

1ゾーンだけなら `graveToBz` / `manaToBz` を使ってください（validator がエラーにします）。

## 7.27. 能力を無視する（`ignoreAbilities`）と「数字を1つ選ぶ」（`chooseNumber`）

> カードを1枚引き、数字を1つ選ぶ。次の自分のターンのはじめまで、その数字と同じコストの
> 相手のエレメントの能力を無視し、相手はその数字と同じコストの呪文を唱えられない。
> （♪立ち上がる 悪魔に天使 堕ちるかな）

```jsonc
[ { "type":"drawCards", "amount":1 },
  { "type":"chooseNumber", "as":"n", "min":0 },
  { "type":"ignoreAbilities", "target":"opponent", "all":true,
    "filter":{ "element":true, "cost":{"var":"n"} } },
  { "type":"denySpell", "target":"opponent", "filter":{ "cost":{"var":"n"} } } ]
```

### `chooseNumber`（数字を1つ選ぶ）

| キー | 説明 |
|---|---|
| `as` | 選んだ数を入れる変数名（**必須**）。以降のステップから `{"var":"n"}` で参照する |
| `min` | 選べる下限（既定 0） |
| `max` | 選べる上限。**書かなければ上限なし** |

カードではなく数字を選ぶステップです。`choosePlayer` と同じで、選んだ結果は `selectedUids` に
混ぜず `ctx` 経由で渡ります。選ばずに閉じた場合は「行わなかった」扱いになります。

UI は**数字の入力欄**です（よく使う小さい数字だけクイックボタンとして並びます）。
DMの「数字を1つ選ぶ」は好きな数字を宣言できるので、**`max` は書かないのが既定**です。
書いた場合だけ、その範囲に丸められます。

### `ignoreAbilities`（そのエレメントの能力を無視する）

| キー | 説明 |
|---|---|
| `target` | 誰のバトルゾーンを見るか（`"opponent"` / `"self"` / `"both"`） |
| `all` | `true` で `filter` に一致するものすべて。省略すると選択させる |
| `filter` | どのカードを無視するか（§2 と同じ語彙。`{"var":…}` が使える） |

**能力の読み出しは `effectiveCard()` を通るので、印を1つ付けるだけで全体に効きます。**
消えるのは能力だけで、名前・コスト・パワー・文明・種族・種別・進化元は残ります。

消えるもの:

- `keywords`（＋ `ssx` 由来と `tempBuff` 由来。**他から与えられた能力も無視されます**）
- `triggers` / `activated`
- `replaceLeave` / `replaceLose` / `replaceEnter` / `replaceShieldAdd` / `staticDeny` / `spellAfterCast` / `summonFrom` / `freeCast`
- `costReduce` / `condPower` / `grantKeywords` / `powerAttacker` / `poweredBreaker`
  → **パワー修整も消えて素のパワーに戻り、他のカードへ配ることもしなくなります**
- `hyperKeywords` / `hyperPower` / `hyperUnlock` / `hyperOnAttack` / `hyperOnTargeted`
- `oniEnd` / `ddd` / `gZero` / `revolutionChangeCond` / `finalRevolution` / `grantSelfSTrigger`

残るもの: `name` / `cost` / `power` / `civ` / `type` / `race` / `evolutionBase`
（進化クリーチャーであることは能力ではないので変わりません。ただし進化元の `ssx` は伝わらなくなります）

**期限は `denySpell` と同じ規則です** — 無視されている側のターンが終わると切れます
（＝この効果を使った側から見て「次の自分のターンのはじめまで」）。
解決した時点でバトルゾーンにいたカードだけが対象で、**その後に出たカードには掛かりません**。

### 保存される `filter` に `{var}` を書くとき

`denySpell` のようにプレイヤー状態へ保存される `filter` は、あとから `matchCardFilter`
（`ctx` を持たない）で評価されるため、**積む時点で数値に固めます**。書く側は
`{"cost":{"var":"n"}}` と書くだけで、engine 側が固定してから保存します。

## 7.28. 誘発した能力の解決順

同時に複数の能力が誘発したときの解決は、**順番を先にまとめて決めずに、1つずつ選び直します**。

1. いま解決を待っている能力を一覧にする
2. そこから1つ選んで解決する
3. 解決しきったら 1 に戻る。**その間に新しく誘発した能力も一覧に入ります**

- **ターンプレイヤーの能力 → 非ターンプレイヤーの能力**の順は崩しません。
  一覧に出るのは、いま手番が回っている側の能力だけです
- 待っている能力が1つしかなく、しかも「〜してもよい」でないなら、選ぶ余地が無いので
  そのまま解決します（一覧は出ません）
- 呪文の本体（`on:"cast"`）は誘発型能力ではないので、割り込ませずに唱えた順で解決します
- 鬼エンド / D・D・D / S・トリガーの**宣言（何枚使うか）は今までどおりまとめて行います**。
  決めないのは「宣言したカードをどの順で解決するか」の方です

3 が肝で、**解決の途中で出たクリーチャーの cip も、まだ解決していない能力と同じ一覧に並びます**。
たとえば百鬼の邪王門を2枚宣言した場合、1枚目でクリーチャーが出たら、その cip と
「まだ唱えていない2枚目」を見比べてから次を選べます。

## 7.28.5. 手札からの宣言型プレイ（アタック・チャンス）

鬼エンド（→ §7.18）／ D・D・D（→ §7.21）と同じ枠組みです。カード直下に書きます。

> **アタック・チャンス：水のパワー4000以上のクリーチャー**
> （自分の指定のクリーチャーが攻撃する時、このカードをコストを支払わずに実行してもよい）

```jsonc
"attackChance": {
  "on": "attack", "target": "self",
  "filter": { "creatureOnly": true, "civ": "water", "minPower": 4000 }
}
```

| キー | 説明 |
|---|---|
| `on` | 契機（既定 `"attack"`） |
| `target` | 誰の出来事か。**既定は `"self"`**（「**自分の**指定のクリーチャーが攻撃する時」） |
| `filter` | **攻撃したクリーチャー**の条件（＝「指定のクリーチャー」） |

- **コストは支払いません**（鬼エンドと同じ）。D・D・D と違って `cost` は書きません
- `filter` が掛かるのは手札のこのカードではなく、**攻撃したクリーチャー**です

## 7.28.6. ウラ・ニンジャ・ストライク（`ninjaStrike`）

鬼エンド／ D・D・D ／アタック・チャンスと同じ「手札からの宣言型プレイ」の枠組みです。

> **ウラ・ニンジャ・ストライク3（水）**
> （相手のクリーチャーが攻撃またはブロックした時、自分のマナゾーンにカードが3枚以上で水文明があり、
> その攻撃中に「ニンジャ・ストライク」能力を使っていなかった場合、このシノビをコストを支払わずに
> 召喚してもよい。そのターンの終わりに、このシノビを自分の山札の一番下に置く）

```jsonc
"ninjaStrike": { "count": 3, "civ": "water" }
```

| キー | 説明 |
|---|---|
| `count` | 必要なマナゾーンの枚数（**必須**）。`N` の部分 |
| `civ` | マナゾーンにあることが要る文明。`（X）` の部分（省略すると文明の条件なし） |
| `target` | 誰の出来事か。**既定は `"opponent"`**（「**相手の**クリーチャーが〜した時」） |

- `on` は**書きません**。契機は攻撃**または**ブロックの2つで固定です
- **マナはタップしません**。「マナゾーンにN枚以上」は支払いではなく**条件**です
- **コストは支払いません**
- 「その攻撃中に1度だけ」は engine 側で見ています。攻撃を宣言するたびにリセットされるので、
  1回の攻撃の中で2枚目のシノビは提示されません（別の攻撃なら改めて使えます）
- 「**そのターンの終わりに、このシノビを自分の山札の一番下に置く**」はニンジャ・ストライクの
  定義なので、データには書きません。出した時に予約され、ターンの終わりに処理されます
  （その前にバトルゾーンを離れていれば何も起きません）
- 「ウラ・ニンジャ・ストライク」と「ニンジャ・ストライク」は、条件・処理ともに同じ扱いです

「相手のクリーチャーがブロックした時」は誘発 `on:"block"` としても書けます
（`subjectCard` はブロックしたクリーチャー）。

## 7.28.7. 攻撃もブロックもできない（`denyAttackBlock`）

> 次の自分のターンのはじめまで、その捨てたカードと同じコストの相手のクリーチャーはすべて、
> 攻撃もブロックもできない。（裏斬隠 テンサイ・ハート）

```jsonc
[ { "type": "drawCards", "amount": 2 },
  { "type": "handToGrave", "target": "self", "amount": 1, "asCost": "discardedCost" },
  { "type": "denyAttackBlock", "target": "opponent", "mode": "both",
    "filter": { "creatureOnly": true, "cost": { "var": "discardedCost" } } } ]
```

| キー | 説明 |
|---|---|
| `target` | 縛るプレイヤー。`self` / `opponent` / `both` |
| `mode` | `"both"`（既定）＝攻撃もブロックも／ `"attack"` ＝攻撃だけ／ `"block"` ＝ブロックだけ |
| `filter` | 縛るクリーチャーの条件（省略すると全部）。`{"var":…}` が使える |
| `label` | 弾いた時にUIに出す理由（省略時は既定文言） |

**期限は `denySpell`（→ §7.23）と同じ規則です** — 縛られている側のターンが終わると切れます
（＝この効果を使った側から見て「次の自分のターンのはじめまで」）。

`denySpell` と同じくプレイヤー状態に積まれるので、`filter` の `{var}` は**積む時点で数値に
固まります**（→ §7.27「保存される `filter` に `{var}` を書くとき」）。
`ignoreAbilities` と違い、**あとから出たクリーチャーにも掛かります**（条件で見るため）。

- 攻撃側: クリーチャーの詳細パネルで ATTACK が押せなくなり、理由が出ます
- ブロック側: **ブロック候補に出てきません**（見せてから弾くのではなく先に外す）

## 7.30. リサイクルと「ターンの残りをとばす」

### リサイクル（`recycle`）

> リサイクル[水(4)]（この呪文を自分の墓地から「リサイクル」コストを支払って唱えてもよい。
> こうして唱えた後、墓地のかわりに山札の下に置く）

```jsonc
"recycle": { "cost": 4, "civs": ["water"] }
```

| キー | 説明 |
|---|---|
| `cost` | リサイクル・コスト（数値、必須） |
| `civs` | 支払いに要る文明。省略するとカードの文明 |

- **呪文にだけ書けます**（ツインパクトの呪文面は未対応）
- 墓地ゾーンを開くと「リサイクル (4)」ボタンが出ます。マナが足りなければ押せません
- 「**こうして唱えた後、墓地のかわりに山札の下に置く**」はリサイクルの定義なので、
  データには書きません。engine 側が `afterCast:{to:"deckBottom"}` として付けます（→ §7.22）
- したがって他の置換（サイクルペディア等）と競合したら、**1つ選ぶモーダル**になります

### ターンの残りをとばす（`skipRestOfTurn`）

> このクリーチャーが出た時、**ターンの残りをとばす**。（終末の時計 ザ・クロック）

```jsonc
{ "label": "ターンの残りをとばす", "type": "skipRestOfTurn" }
```

この能力を解決した時点で、次のすべてを行います。

1. **待機している効果をすべて消す** — 解決待ちの誘発（`pendingEffects`）、解決中のステップ、
   確認待ちのモーダル（置換・ブロック・革命チェンジなど）、預かっている攻撃
2. **このターンの残りのステップを行わない** — **「ターンの終わり」も飛ばす**ので、
   `endOfTurn` の誘発やターン終了時の予約効果（`endOfTurnEffect` など）は**起きません**
3. そのうえで**強制的に次のターンのはじめ**にする

> **アンタップやフラグのリセットは行われます。** これはステップではなくターンの移り変わり
> そのものなので、飛ばすと盤面が壊れます。実装でも `handleEndTurn` を
> 「①ターンの終わりの処理（飛ばす）」と「②次のターンへ進む処理（必ず行う）」に分け、
> `skipRestOfTurn` は ② だけを行います。

## 7.29. 出る時／シールドに置く時の置換（`replaceEnter` / `replaceShieldAdd`）と無色

### `replaceEnter`

「**相手のターンに相手のクリーチャーが超次元ゾーン以外から出る時、かわりにそれを相手の超次元ゾーンに置く。
次の相手のターンのはじめに、相手はそのクリーチャーを超次元ゾーンから出す**」（ゾロ・ア・スタート）。

```jsonc
"replaceEnter": {
  "who": "opponent",              // 出るクリーチャーの持ち主（self / opponent / both、既定 both）
  "turnOf": "opponent",           // 誰のターンか（self / opponent / both、既定 both）
  "to": "hyper",                  // かわりに置く先（いまは超次元ゾーンのみ）
  "release": "startOfOwnerTurn"   // 次のその持ち主のターンのはじめに、そこから出す
}
```

| キー | 意味 |
|---|---|
| `who` | 出るクリーチャーの持ち主。**置換元のカードの持ち主から見た関係**です |
| `turnOf` | 誰のターンに起きた出来事か。こちらも置換元から見た関係 |
| `to` | かわりに置く先。`"hyper"`（超次元ゾーン）/ `"mana"` / `"grave"` / `"hand"` |
| `release` | `"startOfOwnerTurn"` なら、次のその持ち主のターンのはじめに超次元ゾーンから出します |
| `filter` | 出るカードの条件（省略時はクリーチャーすべて） |
| `costOver` | **「あるゾーンのカードの枚数よりコストが大きい」**（下記） |

#### `costOver`（枚数とコストを比べる）

「相手のターン中、相手が、**自身のマナゾーンのカードの枚数よりコストが大きい**クリーチャーを
出す時、かわりにマナゾーンに置く」（キャディ・ビートル）。

```jsonc
"replaceEnter": {
  "who": "opponent", "turnOf": "opponent", "to": "mana",
  "costOver": { "zone": "mana" }
}
```

| キー | 説明 |
|---|---|
| `zone` | 数えるゾーン（`bz` / `shield` / `mana` / `grave` / `hand` / `deck`） |
| `filter` | 数える条件（省略で全部）。`cardCount` と同じ語彙 |
| `of` | 誰のゾーンを数えるか。`"owner"`（既定＝出るクリーチャーの持ち主＝カードの「自身の」）/ `"source"`（置換元の持ち主） |

- **超次元ゾーンから出る分には効きません。** `release` で出したものを再び吸い込んで
  永久に出られなくなるのを防ぐため、engine 側で除外しています
  （カードのテキストにある「超次元ゾーン以外から出る時」がこれにあたります）
- 置換は §0 のとおり**必ず例外処理で中止できます**。中止すると通常どおり出て、「出た時」も誘発します
- 実装は「いったんバトルゾーンに置いてから、cip を誘発させる直前に差し替える」形です。
  **cip（`creaturePutBz`）の発火は `putCreatureBz` 1か所に集約**されているので、
  置換した時は誘発を止めて超次元ゾーンへ移すだけで「出なかったこと」になります
- **複数体が同時に出た時は1体ずつ聞きます**（ファイナル革命など）。
  確認は列で持っているので、片方だけ置換して片方は通す、という選び方ができます

### シールドゾーンに置く時の置換（`replaceShieldAdd`）

「**相手のターン中に、相手が自身のシールドゾーンにカードを置く時、かわりに墓地に置く**」
（ピッピ・修・ピヨッコ）。

```jsonc
"replaceShieldAdd": { "who": "opponent", "turnOf": "opponent", "to": "grave" }
```

| キー | 意味 |
|---|---|
| `who` | 置くプレイヤー。**置換元のカードの持ち主から見た関係**（`self` / `opponent` / `both` 既定） |
| `turnOf` | 誰のターンに起きた出来事か。こちらも置換元から見た関係 |
| `to` | かわりに置く先。`"grave"`(既定) / `"hand"` / `"mana"` / `"deck"`（山札の下） |
| `filter` | 置かれるカードの条件（省略で全部） |

- `replaceEnter` と同じ流儀の実装です。**いったんシールドゾーンに置いてから差し替える**ので、
  **シールドが置かれた時（`shieldAdded`）の発火は `putShields` 1か所に集約**されています
- 置換したぶんは「置かれなかったこと」になるので、`shieldAdded` は誘発しません。
  シールドゾーンの中身を監視している `shieldLeave` / Zラッシュからも除かれます
- **同時に複数枚置かれた時は1枚ずつ聞きます。1枚でも残れば `shieldAdded` は誘発します**
- 置換は §0 のとおり**必ず例外処理で中止できます**。中止すると通常どおりシールドになります
- 効果でシールド化する経路（`topToShield` / `handToShield` / `bzToShield` / 城 /
  `replaceLeave{to:"shield"}` / `spellAfterCast{to:"shield"}`）はすべてここを通ります。
  **ゲーム開始時の初期シールドは対象外です**（ターン中の出来事ではないため）

### 無色（`civ: "colorless"`）

ゼニスなどの無色カードです。**文明ではない**ので、次のように扱われます。

- コストの支払いに**特定の文明のマナを要求しません**（枚数だけ足りればよい）
- 実効コストの下限になる「文明数」にも数えません
- マナゾーンに置いた無色カードは、どの文明のマナとしても使えません

### エターナル・Ω

「このクリーチャーが離れる時、かわりに手札に戻す」は `replaceLeave` に **`filter.self`** を付けて書きます。

```jsonc
"replaceLeave": { "to": "hand", "filter": { "self": true } }
```

`filter.self` が無い `replaceLeave` は、**その持ち主のカードすべて**に効きます
（八頭竜 ACE-Yamata のような「自分のクリーチャーが離れる時」はそちら）。

## 8. 常在・付与・ハイパー等のフィールド

- `activated`: 起動型能力 → **§7.6**
- `summonFrom`: 墓地・マナからの召喚許可 → **§7.7**
- `replaceLose`: `[{from,to,label}]` — 敗北の置換 → **§7.10**
- `grantKeywords`: `[{keyword,filter?,condition?}]`（filter: `self,notSelf,raceContains,multiColor,nameContains,elementOnly`）
  - **`self:true`** =「**この**クリーチャーに与える」（自分だけ。同名の2体目には配らない）→ **§7.25**
- `grantPowerBoost` / `grantPowerBoostGrave` / `selfPowerBoostGrave` / `condPower:[{condition,amount}]`
- `powerAttacker`: `N` — パワーアタッカー+N（**攻撃中のみ**パワー+N）
- `poweredBreaker`: `true` — パワード・ブレイカー（パワー6000ごとに1つブレイク、最低1）。
  W/Tブレイカーと併用した場合は**大きい方**が採用される
- `condition` の共通語彙: `{type:"civicCount",civ,count}` / `{type:"stackCount",count}` /
  `{type:"cardCount",zone,filter?,min?,max?}` / `{type:"shieldCount",who?,min?,max?}` /
  `{type:"oniEnd"}`（→ **§7.18**。triggers / activated でのみ使える） / `{flag:"…"}`
  - `stackCount` = そのカード自身＋下に敷かれたカードの枚数（進化元を含むスタックの厚み）
  - **`cardCount`** = 「あるゾーンに、ある条件のカードが N 枚以上／以下あれば」。
    `zone` は `bz` `shield` `mana` `grave` `hand` `deck`、`filter` は §2 の語彙。
    数えるのは `costReduce.amountPer` と同じ関数なので、ゾーンと filter の意味もそこと同じです
    ```jsonc
    // 自分のマナゾーンにドラゴン・カードが4枚以上あれば
    { "type": "cardCount", "zone": "mana", "filter": { "raceContains": "ドラゴン" }, "min": 4 }
    ```
    `who` は `self`(既定) / `opponent` / `any`。**相手を見るのは triggers / activated だけ**です
    （継続能力の評価経路は相手の盤面を受け取らないため）
- `costReduce`: `{amount | amountPer, min, zones?, filter?, condition?}` — 自分がカードをプレイする際のコスト軽減
  - `zones`: **軽減元（このカード）がどのゾーンにいれば有効か**。`bz` `shield`(表向きのみ) `mana` `grave` `hand`
    既定は `["bz","shield"]`（バトルゾーン＋表向きシールド＝継続能力が働く場所）
  - `filter`: 軽減対象の条件 — `civ` `raceContains` `nameContains` `keyword` `multiColor` `maxCost`
    `type`(`creature`/`nonCreature`/`element`/`spell`…)、
    **`self:true`** =「このクリーチャーの召喚コストを〜」（軽減元自身にだけ効く）
  - `amountPer`: `{zone,filter}` — 「〜1枚につき1少なくする」の可変軽減（`amount` の代わりに書く）
    - `zone` には通常のゾーンのほか **`"evolutionBase"`**（**今回の召喚で実際に重ねる進化元の枚数**）を指定できる
  - `min`: 下限コスト。複数の軽減は重ねがけされる
  - `condition`: **「〜であれば」**。満たさない間はその軽減だけを飛ばす（上の共通語彙）。
    継続能力なので**相手の盤面は見られません**（`who` は `self` のみ）
  ```jsonc
  // バトルゾーンにいる間、自分のドラゴンのコストを2軽減（最低1）
  "costReduce": { "amount":2, "filter":{"raceContains":"ドラゴン"}, "min":1 }
  // 墓地にある間だけ、自分の光のカードのコストを1軽減
  "costReduce": { "amount":1, "zones":["grave"], "filter":{"civ":"light"}, "min":1 }
  // このクリーチャー自身の召喚コストを、自分の墓地のクリーチャー1体につき1軽減
  "costReduce": { "amountPer":{"zone":"grave","filter":{"creatureOnly":true}},
                  "filter":{"self":true}, "zones":["hand"], "min":1 }
  // このクリーチャー自身の召喚コストを、進化元クリーチャー1体につき1軽減（超無限進化など）
  "costReduce": { "amountPer":{"zone":"evolutionBase"},
                  "filter":{"self":true}, "zones":["hand"], "min":1 }
  // 自分のマナゾーンにドラゴン・カードが4枚以上あれば、このクリーチャーの召喚コストを3少なくする
  "costReduce": { "amount":3, "min":1, "zones":["hand"], "filter":{"self":true},
                  "condition":{ "type":"cardCount", "zone":"mana",
                                "filter":{"raceContains":"ドラゴン"}, "min":4 } }
  ```
  > **階段状の軽減は `condition`、比例した軽減は `amountPer`** です。
  > 「4枚以上あれば一律3」は `condition`、「1枚につき1」は `amountPer` で書きます。
  > ツインパクトで「**召喚**コスト」に限りたい時は `filter` に `"side":"creature"` も足します。
  > `zone:"evolutionBase"` は**進化元を選んだ後**でないと確定しません。UI は
  > 「PLAYできるか」の判定を**重ねられる最大枚数**（＝最も軽くなるケース）で行い、
  > 進化元選択モーダルに現在のコストを表示し、マナ支払い画面で実際の枚数のコストに確定します。
  > **`min` の読み方**: カードに「コストは**0以下**にはならない」とあれば **0にならない** ので `min:1`、
  > 「**1以下**にならない」なら `min:2` です。実際の下限はさらに文明数で抑えられます
  > （2色カードは最低2）。
- `revolutionChangeCond`: `{civs?,race?/races?,minCost?,minPower?,multiColor?,nameContains?}`
- `finalRevolution`: `{effects:[…]}` ／ `alternateCost`: `{cost,civs,condition}` ／ `gZero`: `{nameContains,raceContains}`
- `evolution`: 進化元のゾーンと枚数 → **§7.8**
- `replaceLeave`: 離れる時の置換 → **§7.16**
- `replaceEnter`: 出る時の置換（超次元ゾーン／マナ／墓地／手札へ送る） → **§7.29**
- `replaceShieldAdd`: シールドゾーンに置く時の置換 → **§7.29**
- `freeCast`: コストを支払わずにプレイできる許可 → **§7.12**
- `oniEnd`: 鬼エンド（手札から、コストを支払わずにプレイする） → **§7.18**
- `ddd`: D・D・D（手札から、指定のコストを支払ってプレイする） → **§7.21**
- `attackChance`: アタック・チャンス（自分のクリーチャーが攻撃する時） → **§7.28.5**
- `ninjaStrike`: （ウラ・）ニンジャ・ストライク（相手のクリーチャーが攻撃／ブロックした時） → **§7.28.6**
- `spellAfterCast`: 唱えた後の行き先の置換 → **§7.22**
- `staticDeny`: 相手のプレイを止める常在型（`cantCastSpell` 等） → **§7.23**
- `grantSelfSTrigger`: 革命n（自分に S・トリガーを与える） → **§7.25**
- `powerPlus`: 「5000+」の表示（数値は変えない） → **§7.25**
- ハイパー: `hyperPower` `hyperKeywords` `hyperOnAttack` `hyperOnTargeted` `hyperUnlock:{type:"tapOwnCreature",count}`
  > `hyperOnTargeted`（相手がこのクリーチャーを選んだ時）は、**攻撃で選ばれた時だけでなく
  > 相手の効果の対象に選ばれた時にも**誘発します。ブレイクするのは**選んだ側**のシールドです。
- `zRush` `cantAttackPlayer` `faceUpLeaveTo:"grave"` `reactivePassive` `endOfTurnEffect` `staticDeny:{type:"cantPutCreature"}`
- `spellSide`（twinpact）: `{name,cost,civ,keywords,effect,triggers}`（呪文面に書けるのは `on:"cast"` だけ）
  - **呪文面が `sTrigger` を持つ場合**、シールドをブレイクされた時にその呪文面が唱えられます
    （カード表示の ST バッジにも出ます）。クリーチャー面の能力は `triggers` 側に書きます。
  - プレイ中は `side`（`"creature"`/`"spell"`）で面を区別できます → **§2 の filter**

---

## 9. テンプレ

```jsonc
// 効果なしクリーチャー
{ "id":0,"name":"サンプル","type":"creature","civ":"fire","race":"ヒューマノイド",
  "cost":3,"power":3000,"keywords":["speedAttacker"],"effect":"スピードアタッカー" }

// 出た時ドロー ＋ 攻撃時に条件ドロー
{ "id":0,"name":"サンプル2","type":"creature","civ":"light","race":"メカ",
  "cost":5,"power":5500,"keywords":["blocker"],
  "effect":"ブロッカー\nこのクリーチャーが出た時、カードを1枚引く。",
  "triggers":[
    {"on":"creaturePutBz","effects":[{"type":"drawCards","amount":1,"label":"1枚引く"}]},
    {"on":"attack","optional":true,"effects":[
      {"type":"count","zone":"bz","target":"self","filter":{"creatureOnly":true,"maxCost":4}},
      {"type":"drawCards","amount":"count","optional":true} ]} ] }
```
