import type { GeneratorRoleCell } from '../../../shared/contracts/generator-presets.js'
import { message } from '../../i18n/generator-runtime.de.js'

export function roleName(role: GeneratorRoleCell): string {
  return message(`g.role.${role}` as Parameters<typeof message>[0])
}

export function roleShort(role: GeneratorRoleCell): string {
  return role === 'none' ? '—' : role[0]!.toUpperCase() + role[1]
}
