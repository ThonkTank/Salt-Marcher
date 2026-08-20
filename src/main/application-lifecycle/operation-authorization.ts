import {
  coreOperations,
  type CoreOperationKind,
  type WindowRole
} from '../../shared/contracts/operations.js'
import { operationAllowsRole } from '../../shared/contracts/operations/registry.js'

export function roleCanInvoke(
  role: WindowRole,
  kind: CoreOperationKind
): boolean {
  const definition = coreOperations[kind]
  return (
    operationAllowsRole(definition, role) &&
    (definition.mode === 'read' || role === 'gm')
  )
}
