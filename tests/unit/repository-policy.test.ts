import { describe, expect, it } from 'vitest'

import {
  assertRepositoryPolicy,
  expectedRepositoryRulesetRequest,
  githubActionsAppId,
  managedRepositoryRulesetName,
  repositoryPolicyDiff,
  repositoryPolicyProbeRef
} from '../../scripts/repository-policy.js'

function liveRuleset() {
  return {
    id: 42,
    node_id: 'RRS_example',
    name: managedRepositoryRulesetName,
    target: 'branch',
    source_type: 'Repository',
    source: 'ThonkTank/Salt-Marcher',
    enforcement: 'active',
    bypass_actors: [],
    conditions: {
      ref_name: { include: ['refs/heads/main'], exclude: [] }
    },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: false,
          required_status_checks: [
            {
              integration_id: githubActionsAppId,
              context: 'Candidate · exact-SHA aggregate'
            }
          ],
          do_not_enforce_on_create: false
        }
      },
      { type: 'required_linear_history' },
      { type: 'deletion' },
      { type: 'non_fast_forward' }
    ]
  }
}

describe('repository policy', () => {
  it('declares one active, bypass-free, loose exact-SHA main gate', () => {
    expect(expectedRepositoryRulesetRequest()).toEqual({
      name: managedRepositoryRulesetName,
      target: 'branch',
      enforcement: 'active',
      bypass_actors: [],
      conditions: {
        ref_name: { include: ['refs/heads/main'], exclude: [] }
      },
      rules: [
        { type: 'deletion' },
        { type: 'non_fast_forward' },
        { type: 'required_linear_history' },
        {
          type: 'required_status_checks',
          parameters: {
            do_not_enforce_on_create: false,
            required_status_checks: [
              {
                context: 'Candidate · exact-SHA aggregate',
                integration_id: githubActionsAppId
              }
            ],
            strict_required_status_checks_policy: false
          }
        }
      ]
    })
    expect(assertRepositoryPolicy(liveRuleset()).rulesetId).toBe(42)
  })

  it('can temporarily include the isolated enforcement probe ref', () => {
    expect(expectedRepositoryRulesetRequest(true)).toMatchObject({
      conditions: {
        ref_name: {
          include: ['refs/heads/main', repositoryPolicyProbeRef]
        }
      }
    })
    const probe = liveRuleset()
    probe.conditions.ref_name.include.push(repositoryPolicyProbeRef)
    expect(repositoryPolicyDiff(probe, true)).toEqual([])
  })

  it.each([
    [
      'bypass',
      (value: ReturnType<typeof liveRuleset>) =>
        (value.bypass_actors as unknown[]).push({ actor_id: 1 })
    ],
    [
      'inactive',
      (value: ReturnType<typeof liveRuleset>) =>
        (value.enforcement = 'disabled')
    ],
    [
      'strict checks',
      (value: ReturnType<typeof liveRuleset>) =>
        (value.rules[0]!.parameters!.strict_required_status_checks_policy = true)
    ],
    [
      'foreign source',
      (value: ReturnType<typeof liveRuleset>) =>
        (value.rules[0]!.parameters!.required_status_checks[0]!.integration_id = 1)
    ],
    [
      'extra rule',
      (value: ReturnType<typeof liveRuleset>) =>
        value.rules.push({ type: 'required_signatures' })
    ]
  ])('rejects %s drift', (_name, mutate) => {
    const value = liveRuleset()
    mutate(value)
    expect(repositoryPolicyDiff(value)).not.toEqual([])
    expect(() => assertRepositoryPolicy(value)).toThrow(/differs from policy/)
  })
})
