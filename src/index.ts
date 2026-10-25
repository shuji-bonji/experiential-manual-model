/**
 * @shuji-bonji/experiential-manual-model
 *
 * 体験型操作マニュアルの共通データモデル。S1000D に依存しない。
 * 型・JSON Schema（schema/manual.schema.json）・検査（validateManual）・2021 年の JSON の変換（fromLegacyJson）・
 * 手順の番号（numberSteps）を提供する。S1000D への変換は s1000d-writer-mcp（段階 3）に置く。
 */
export * from './types.js';
export {
  assertManual,
  validateManual,
  type ValidationIssue,
  type ValidationResult,
} from './validate.js';
export { fromLegacyJson, type LegacyConversion, type LegacyOptions } from './legacy.js';
export { findStepByNumber, numberSteps, type NumberedStep } from './number.js';
