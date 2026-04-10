# Crawler Config

## Purpose

`shared/crawler/config` owns crawler runtime configuration loading and validation: `crawler.properties`, `cobalt.session`, `delay.ms`, and project-local runtime paths.

## Canonical Types and APIs

- `shared.crawler.config.ConfigObject.loadRuntimeConfig(LoadRuntimeConfigInput)` - loads `crawler.properties` and returns validated session, delay, and raw properties for crawler-specific path keys.
- `shared.crawler.config.ConfigObject.resolveProjectPath(ResolveProjectPathInput)` - resolves and validates one configured crawler runtime path within the project root.
- `shared.crawler.config.CrawlerConfigException` - user-safe invalid configuration failure for missing or malformed crawler settings.

## Where New Code Goes

- Put shared crawler properties-file loading, property parsing, and path validation here.
- Keep feature-specific property keys in the calling crawler until a later slice unifies them.

## Forbidden Drift

- Do not move HTTP client creation or request behavior here; that belongs to crawler HTTP.
- Do not let individual crawler mains parse session, delay, or project-local paths directly once this seam exists.
