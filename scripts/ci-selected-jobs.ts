import {
  ciRiskGroups,
  verifyCiRiskSelection,
  type CiRiskSelection
} from './ci-risk-selection.js'
import {
  verifyRequiredJobs,
  type GithubWorkflowRun,
  type RequiredJobManifest,
  type WorkflowEvidence
} from './delivery-contract.js'

export const ciRiskJobNames = {
  portable: ['Portable · static and app'],
  native: ['Native · windows-2022', 'Native · macos-latest'],
  'linux-build': ['Linux build · reusable app'],
  'linux-package': ['Linux package · profile and AppImage'],
  'linux-qualification': ['Linux qualification · packaged harness'],
  e2e: [
    'Linux E2E · campaign-workspaces',
    'Linux E2E · hex-npc-restart',
    'Linux E2E · dialogs-generation-loot',
    'Linux E2E · group-loot-travel'
  ],
  visual: [
    'Linux Visual · goldens-campaign',
    'Linux Visual · goldens-dialog-travel-loot',
    'Linux Visual · goldens-world-create'
  ],
  'passive-e2e': ['Linux E2E · passive window']
} as const

const always = [
  'Candidate · history and risk preflight',
  'Candidate · exact-SHA aggregate'
]

export function requiredManifestForSelection(
  manifest: RequiredJobManifest,
  selection: CiRiskSelection
): RequiredJobManifest {
  const known = [
    ...always,
    ...ciRiskGroups.flatMap((group) => [...ciRiskJobNames[group]])
  ].toSorted()
  if (
    JSON.stringify(known) !==
    JSON.stringify(manifest.jobs.map((job) => job.name).toSorted())
  )
    throw new Error(
      'Required-job manifest differs from the explicit CI risk mapping.'
    )
  const required = new Set([
    ...always,
    ...selection.requiredGroups.flatMap((group) => [...ciRiskJobNames[group]])
  ])
  return {
    ...manifest,
    jobs: manifest.jobs.filter((job) => required.has(job.name))
  }
}

/** Selection is recomputed before it can relax any required job. */
export function verifySelectedWorkflowJobs(input: {
  manifest: RequiredJobManifest
  run: GithubWorkflowRun
  selection: unknown
  workspaceRoot: string
  baseSha: string
  headSha: string
  forceFull: boolean
  requireFull?: boolean
}): WorkflowEvidence {
  const selection = verifyCiRiskSelection(input.selection, input)
  if (input.requireFull && selection.mode !== 'full')
    throw new Error('Public release requires full exact-SHA CI qualification.')
  const selectedManifest = requiredManifestForSelection(
    input.manifest,
    selection
  )
  const evidence = verifyRequiredJobs(
    selectedManifest,
    input.run,
    input.headSha
  )
  // A selected job must pass; even an unnecessary job must never hide a failure.
  for (const job of input.run.jobs)
    if (
      job.status !== 'completed' ||
      !['success', 'skipped'].includes(job.conclusion ?? '')
    )
      throw new Error(`Workflow contains an unsuccessful job: ${job.name}`)
  return { ...evidence, selection }
}
