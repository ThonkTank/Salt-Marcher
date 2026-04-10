# Crawler Slug Discovery

## Purpose

`shared/crawler/slug` owns crawler-wide slug discovery: paginated listing scans, slug-file loading, and deduplication via shared slug identity rules.

## Canonical Types and APIs

- `shared.crawler.slug.SlugObject.collectListingSlugs(CollectListingSlugsInput)` - scans paginated listing HTML through the shared HTTP seam and returns deduplicated slugs.
- `shared.crawler.slug.SlugObject.loadSlugFile(LoadSlugFileInput)` - loads a slug file, validates each line against the caller-supplied pattern, and returns deduplicated slugs.
- `shared.crawler.slug.SlugIdentity` - canonical shared helpers for slug deduplication, filename-to-slug mapping, and stable slug keys.

## Where New Code Goes

- Put crawler-wide listing-page loops, href-pattern extraction, slug-file fallback loading, and shared deduplication orchestration here.

## Forbidden Drift

- Do not rebuild paginated slug discovery loops in individual crawler mains.
- Do not move raw HTTP fetching, HTML text normalization, or importer file-writing workflows into this package.
