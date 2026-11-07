import path from 'node:path';

/** Missing proof is a stop even if the inner Python owner reported no remaining
 * descendants: the resource owner can own other helpers in the bounded group. */
export function baselineResourceOwnershipKnown(resource) {
  if (
    !resource ||
    resource.error ||
    !['delegated-2G-3G', 'systemd-2G-3G'].includes(resource.policy)
  )
    return false;
  const proof = resource.ownership;
  if (!proof || proof.error || proof.empty !== true || typeof proof.group !== 'string')
    return false;
  if (!/^salt-check-[a-f0-9-]+$/.test(proof.unit ?? '')) return false;
  if (path.basename(resource.evidence ?? '') !== proof.unit) return false;
  if (![proof.unit, proof.unit + '.scope'].includes(path.basename(proof.group))) return false;
  if (
    resource.policy === 'delegated-2G-3G' &&
    (resource.cleanup?.removed !== true || proof.removed !== true)
  )
    return false;
  return true;
}
