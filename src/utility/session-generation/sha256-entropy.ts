import { createHash } from 'node:crypto'
import { SESSION_GENERATION_ENGINE_VERSION } from '../../shared/contracts/session-generation.js'
import type { EncounterEntropy } from '../../core/session-generation/deterministic-order.js'

export const sha256EncounterEntropy: EncounterEntropy = {
  modulo(stream, modulus) {
    if (!Number.isInteger(modulus) || modulus <= 0)
      throw new Error('invalid_entropy_modulus')
    return digest(stream).readUInt32BE(0) % modulus
  },
  unit(stream) {
    return digest(stream).readUInt32BE(0) / 0x1_0000_0000
  }
}

function digest(stream: string): Buffer {
  return createHash('sha256')
    .update(`${SESSION_GENERATION_ENGINE_VERSION}|${stream}`)
    .digest()
}
