# Changelog

## 0.1.0 (2026-10-26)

最初の版。s1000d-stack の段階 2 の作業 8（design/manual-model.md、DECISIONS D-01・D-09・U-04）。

### 追加

- 型（`Manual` / `Topic` / `Block` / `Step` / `Screen` / `Hotspot` / `Transition` / `Asset` / `Scope` / `Admonition` / `Term`）
- JSON Schema `schema/manual.schema.json`（draft 2020-12。`Hotspot.shape` ごとの `coords` の長さも検査）
- `validateManual` / `assertManual`: 実行時の依存なしで、形・参照・id の重複を `errors`、到達できない画面と未使用の素材・適用範囲を `warnings` で返す
- `fromLegacyJson`: 2021 年の `JSON.json`（`purchaseTypes` / `screenID` / `destination`。README の表記 `displayAreas` / `screenId` / `screenTransitionDestination` も可）を読む
- `numberSteps` / `findStepByNumber`
- 券売機の例 `examples/kenbaiki.manual.json`（4 種類の話題）
