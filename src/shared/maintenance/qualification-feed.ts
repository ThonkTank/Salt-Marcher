export function qualificationFeed(value: string | undefined): URL {
  const feed = new URL(value ?? '')
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
    throw new Error('Release UI qualification requires a loopback feed origin.')
  return feed
}
export function qualificationFetch(
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
