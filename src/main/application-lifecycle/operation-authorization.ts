import {
  coreOperations,
  type CoreOperationKind,
  type WindowRole
} from '../../shared/contracts/operations.js'

export function roleCanInvoke(
  role: WindowRole,
  kind: CoreOperationKind
): boolean {
  const definition = coreOperations[kind]
  return (
    definition.roles.includes(role) &&
    (definition.mode === 'read' || role === 'gm')
  )
}
