import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gh = (...args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
if (process.env.GITHUB_REF_NAME !== 'v' + version || !/^\d+\.\d+\.\d+$/.test(version))
  throw new Error('Tag und stabile Paketversion müssen übereinstimmen.');
const sha = git('rev-parse', 'HEAD');
git('merge-base', '--is-ancestor', sha, 'origin/main');
const checks = gh('api', `repos/ThonkTank/Salt-Marcher/commits/${sha}/check-runs?per_page=100`);
const required = checks.check_runs
  .filter((c) => c.name === 'Candidate · exact-SHA aggregate' && c.app?.slug === 'github-actions')
  .sort((a, b) => b.id - a.id)[0];
if (required?.head_sha !== sha || required?.conclusion !== 'success')
  throw new Error('Die verpflichtende Candidate-CI fehlt für genau diesen Commit.');
const runs = gh(
  'api',
  `repos/ThonkTank/Salt-Marcher/actions/workflows/pr-baseline.yml/runs?head_sha=${sha}&status=success&per_page=100`,
);
if (
  !runs.workflow_runs.some(
    (r) => r.head_sha === sha && r.head_branch === 'main' && r.event === 'push',
  )
)
  throw new Error('Grüne Main-Baseline für diesen Commit fehlt.');
const releases = gh('api', 'repos/ThonkTank/Salt-Marcher/releases?per_page=100');
if (releases.some((r) => r.tag_name === 'v' + version))
  throw new Error('Diese Version besitzt bereits einen Release. Keine Assets überschreiben.');
console.log('Releasequelle geprüft: ' + sha);
