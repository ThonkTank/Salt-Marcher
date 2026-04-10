# Crawler Text

## Purpose

`shared/crawler/text` owns crawler-wide text normalization: whitespace collapse, NBSP cleanup, trimming, blank handling, and small shared case-formatting helpers.

## Canonical Types and APIs

- `shared.crawler.text.TextObject.normalizeText(NormalizeTextInput)` - normalizes one raw text value for parser/crawler consumption and optionally collapses blanks to `null`.
- `shared.crawler.text.CaseText` - shared case-formatting helper for title-casing and first-word capitalization.

## Where New Code Goes

- Put reusable text cleanup that applies across multiple crawler/import parsers here.

## Forbidden Drift

- Do not move feature-specific HTML parsing or domain extraction into this package.
- Do not rebuild local `cleanText()` canonical logic in each parser once the shared seam can own it.
