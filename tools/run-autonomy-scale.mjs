import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const trials = 20,
  percentile = (list, value) =>
    list.slice().sort((a, b) => a - b)[Math.ceil(list.length * value) - 1],
  round = (value) => Math.round(value * 100) / 100;
function measure(scenario) {
  const results = [];
  for (let trial = 0; trial < trials; trial++) {
    const run = spawnSync(
      process.execPath,
      ['--max-old-space-size=384', '.build/measure-autonomy-scale.cjs'],
      {
        cwd: process.cwd(),
        env: { ...process.env, AUTONOMY_SCENARIO: scenario },
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      },
    );
    if (run.status !== 0)
      throw new Error(
        `Autonomy ${scenario} trial ${trial + 1} failed: ${run.stderr || run.signal || run.status}`,
      );
    results.push(JSON.parse(run.stdout));
  }
  const values = (path) => results.map((result) => path.reduce((value, key) => value[key], result)),
    summary = (path) => {
      const list = values(path);
      return {
        median: round(percentile(list, 0.5)),
        p95: round(percentile(list, 0.95)),
        max: round(Math.max(...list)),
      };
    },
    storage = (key) => Math.round(percentile(values(['storageBytes', key]), 0.5));
  return {
    sourceCondition: { ...results[0].sourceCondition, samples: trials, independentTrials: true },
    captureMs: summary(['captureMs', 'median']),
    catchUpMs: summary(['catchUpMs', 'median']),
    viewMs: summary(['viewMs', 'median']),
    storageBytes: {
      baselineMedian: storage('baseline'),
      finalMedian: storage('final'),
      growthMedian: storage('growth'),
      perConfirmedStepMedian: storage('perConfirmedStep'),
      intervalPayloadMedian: storage('intervalPayloadMedian'),
    },
    processPeakRssBytes: Math.max(...values(['processPeakRssBytes'])),
  };
}
const report = { baseline: measure('baseline'), spatial: measure('spatial') },
  output = JSON.stringify(report, null, 2) + '\n';
writeFileSync(join(process.cwd(), '.build', 'autonomy-scale.json'), output);
process.stdout.write(output);
