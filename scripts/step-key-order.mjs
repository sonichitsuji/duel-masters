// 効果ステップ（effects[] の要素）に書くキーの並び。
//
// 定義の本体は src/cardSchema.js にある（カードの語彙を1か所にまとめたもの）。
// 並びは KEY_GROUPS から導出されるので、ここで二重に持たない。
// scripts/ 側の import 先を変えずに済ませるための薄い殻。
export {
  STEP_KEY_ORDER, stepKeysOrdered, orderStepKeys, orderCardSteps,
} from "../src/cardSchema.js";
