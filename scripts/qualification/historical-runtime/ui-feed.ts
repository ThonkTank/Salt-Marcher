import { isAbsolute } from 'node:path'

/** Test-harness transport only; original production update controllers remain in use. */
export function historicalUiFeed(env: NodeJS.ProcessEnv): URL | null {
  if (env['SALT_MARCHER_HISTORICAL_UI'] !== 'true') return null
  if (
    !env['XDG_DATA_HOME'] ||
    !isAbsolute(env['XDG_DATA_HOME']) ||
    env['SALT_MARCHER_RELEASE_QUALIFICATION'] === 'true'
  )
    throw new Error(
      'UI qualification requires isolated storage and no headless updater'
    )
  const feed = new URL(env['SALT_MARCHER_HISTORICAL_UI_FEED'] ?? '')
  if (
    feed.protocol !== 'http:' ||
    feed.hostname !== '127.0.0.1' ||
    !feed.port ||
    feed.username ||
    feed.password ||
    feed.pathname !== '/' ||
    feed.search ||
    feed.hash
  )
    throw new Error('UI qualification requires a loopback feed origin')
  return feed
}

export function historicalUiFetch(
  feed: URL,
  original: typeof fetch
): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (
      url.protocol !== 'https:' ||
      !['github.com', 'api.github.com'].includes(url.hostname)
    )
      return original(input, init)
    const mapped = new URL(url.pathname + url.search, feed)
    return original(
      input instanceof Request ? new Request(mapped, input) : mapped,
      init
    )
  }
}
