import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'

let installedApi: SaltMarcherApi | null = null

export function installRendererCapabilityApi(api: SaltMarcherApi): void {
  installedApi = api
}

export function rendererCapabilityApi(): SaltMarcherApi {
  if (!installedApi) throw new Error('Renderer capability API is not installed')
  return installedApi
}
