# Crawler HTTP

## Purpose

`shared/crawler/http` owns the raw authenticated fetch boundary for crawler requests: HTTP client creation, request throttling, retry behavior, redirect guards, and status-to-error translation.

## Canonical Types and APIs

- `shared.crawler.http.HttpObject.composeHttp(ComposeHttpInput)` - builds the shared crawler HTTP handoff from validated runtime config.
- `shared.crawler.http.input.ComposeHttpInput.CrawlerHttpInput` - passive runtime handoff carrying request delay and the raw fetch callback for crawler entrypoints.
- `shared.crawler.http.CrawlerHttpClient` - package-local low-level single-request helper that applies headers, redirect guards, and status handling.

## Where New Code Goes

- Put crawler-wide retry, throttling, and raw HTML fetch behavior here.
- Keep slug discovery and file-writing orchestration in the calling crawler mains.

## Forbidden Drift

- Do not recreate `HttpClient.newBuilder()` or per-request `Thread.sleep(...)` in individual crawler mains.
- Do not move slug parsing, HTML normalization, or import orchestration into this package.
