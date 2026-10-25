import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { fromLegacyJson } from './legacy.js';
import { findStepByNumber, numberSteps } from './number.js';
import type { Manual } from './types.js';
import { assertManual, validateManual } from './validate.js';

const read = (rel: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')) as unknown;
const example = read('../examples/kenbaiki.manual.json') as Manual;
const legacy = read('../tests/fixtures/experience_based_operation_explanation.JSON.json');
const schema = read('../schema/manual.schema.json') as object;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const schemaValidate = ajv.compile(schema);

describe('券売機の例', () => {
  it('validateManual と JSON Schema の両方を通り、警告も無い', () => {
    const r = validateManual(example);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
    expect(schemaValidate(example), JSON.stringify(schemaValidate.errors)).toBe(true);
  });
  it('4 種類の話題を持つ', () => {
    expect(example.topics.map((t) => t.kind)).toEqual([
      'description',
      'screenFlow',
      'procedure',
      'troubleshooting',
    ]);
  });
  it('手順の番号を組み立てる', () => {
    const steps = example.topics.find((t) => t.kind === 'procedure')!.steps!;
    expect(numberSteps(steps).map((n) => `${n.number}:${n.step.id}`)).toEqual([
      '1:stp-open-1',
      '1.1:stp-open-1-1',
      '1.2:stp-open-1-2',
      '1.3:stp-open-1-3',
      '2:stp-open-2',
      '3:stp-open-3',
    ]);
    expect(findStepByNumber(steps, '1.2')?.text).toBe('取っ手を引く。');
    expect(numberSteps(steps).find((n) => n.number === '1.1')?.depth).toBe(1);
  });
});

describe('validateManual の検査', () => {
  const clone = () => JSON.parse(JSON.stringify(example)) as Manual;

  it('参照切れを errors にする（transition.to / assetRef / scopeRefs / startScreenRef）', () => {
    const m = clone();
    m.topics[1].screens![0].hotspots[0].transition!.to = 'scr-nowhere';
    m.topics[0].blocks![1].children![0].assetRef = 'img-missing';
    m.topics[2].scopeRefs = ['scope-missing'];
    m.topics[1].startScreenRef = 'scr-nowhere';
    const r = validateManual(m);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.message)).toEqual([
      'transition target "scr-nowhere" is not a screen or step id',
      'asset "img-missing" is not defined in assets',
      'startScreenRef "scr-nowhere" is not a screen of this topic',
      'scope "scope-missing" is referenced but not defined',
    ]);
    expect(r.errors[0].path).toBe('/topics/1/screens/0/hotspots/0/transition/to');
  });

  it('id の重複、coords の長さ、列挙に無い値、必須項目の欠け', () => {
    const m = clone();
    m.topics[1].screens![1].id = 'scr-top';
    m.topics[1].screens![0].hotspots[0].coords = [1, 2, 3, 4, 5];
    (m.topics[3] as { kind: string }).kind = 'faq';
    delete (m.topics[2].steps![0] as { text?: string }).text;
    const r = validateManual(m);
    const msgs = r.errors.map((e) => e.message);
    expect(msgs.some((x) => x.startsWith('duplicate id "scr-top"'))).toBe(true);
    expect(msgs).toContain('rect needs 4 numbers [x1, y1, x2, y2], got 5');
    expect(msgs).toContain(
      'kind must be one of description / procedure / screenFlow / troubleshooting',
    );
    expect(msgs).toContain('text is required');
    // JSON Schema も同じものを弾く（additionalProperties: false と if/then）
    expect(schemaValidate(m)).toBe(false);
  });

  it('到達できない画面と未使用の素材・適用範囲は warnings', () => {
    const m = clone();
    m.topics[1].screens!.push({ id: 'scr-lonely', assetRef: 'img-top', hotspots: [] });
    m.assets!.push({ id: 'img-unused', kind: 'image', source: { path: 'x.png' } });
    m.scopes!.push({
      id: 'scope-unused',
      property: 'model',
      values: ['MV-70'],
      displayText: 'MV-70',
    });
    const r = validateManual(m);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.message)).toEqual([
      'asset "img-unused" is not used',
      'scope "scope-unused" is not used',
      'screen "scr-lonely" cannot be reached from "scr-top"',
    ]);
  });

  it('オブジェクトでなければ 1 つの error、assertManual は投げる', () => {
    expect(validateManual('x').errors).toHaveLength(1);
    expect(() => assertManual({})).toThrow(/Invalid manual/);
    expect(assertManual(example)).toBe(example);
  });
});

describe('fromLegacyJson（2021 年の JSON.json）', () => {
  it('5 つの話題と 79 画面を読み、検査に通る。coords の余分な値は警告になる', () => {
    const { manual, warnings } = fromLegacyJson(legacy, {
      id: 'kenbaiki-2021',
      title: '指定席券売機の操作説明',
    });
    expect(manual.topics).toHaveLength(5);
    expect(manual.topics.every((t) => t.kind === 'screenFlow')).toBe(true);
    expect(manual.topics.reduce((n, t) => n + (t.screens?.length ?? 0), 0)).toBe(79);
    expect(
      manual.topics.reduce((n, t) => n + t.screens!.reduce((m, s) => m + s.hotspots.length, 0), 0),
    ).toBe(212);
    expect(warnings.filter((w) => /extra values dropped/.test(w))).toHaveLength(2);
    const r = validateManual(manual);
    expect(r.errors).toEqual([]);
    expect(schemaValidate(manual), JSON.stringify(schemaValidate.errors)).toBe(true);
    // 補足説明は note になり、画像は asset に 1 回だけ登録される
    const withNote = manual.topics[0].screens!.find((s) => s.admonitions?.length);
    expect(withNote?.admonitions?.[0].level).toBe('note');
    const paths = manual.assets!.map((a) => a.source.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(manual.topics[0].title).toBe('乗換案内からきっぷを購入');
    expect(manual.topics[0].startScreenRef).toBe('title01/screen01');
  });
  it('README の表記（displayAreas / screenId / screenTransitionDestination）も読む', () => {
    const alt = {
      displayAreas: [
        {
          titleId: 'a1',
          title: 'A',
          screens: [
            {
              screenId: 's1',
              imageUrl: 'a.png',
              buttons: [
                {
                  name: 'next',
                  shape: 'circle',
                  screenTransitionDestination: 's2',
                  coords: [1, 2, 3],
                },
              ],
            },
            { screenId: 's2', imageUrl: 'b.png', buttons: [] },
          ],
        },
      ],
    };
    const { manual, warnings } = fromLegacyJson(alt);
    expect(warnings).toEqual([]);
    expect(manual.topics[0].screens![0].hotspots[0].transition).toEqual({ to: 'a1/s2' });
    expect(validateManual(manual).ok).toBe(true);
  });
  it('配列が無ければ投げる', () => {
    expect(() => fromLegacyJson({})).toThrow(/purchaseTypes/);
  });
});
