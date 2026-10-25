/**
 * 手順の番号（1、1.1、1.1.1）と話題の順序の組み立て。モデルには番号を保存しない。
 */
import type { Step } from './types.js';

export interface NumberedStep {
  number: string;
  step: Step;
  depth: number;
}

/** 手順の木を、番号付きの平らな一覧にする（表示と S1000D への出力で使う） */
export function numberSteps(steps: Step[], prefix = ''): NumberedStep[] {
  const out: NumberedStep[] = [];
  steps.forEach((step, i) => {
    const number = prefix ? `${prefix}.${i + 1}` : String(i + 1);
    out.push({ number, step, depth: prefix ? prefix.split('.').length : 0 });
    if (step.children && step.children.length > 0) out.push(...numberSteps(step.children, number));
  });
  return out;
}

/** 番号から手順を探す */
export function findStepByNumber(steps: Step[], number: string): Step | undefined {
  return numberSteps(steps).find((n) => n.number === number)?.step;
}
