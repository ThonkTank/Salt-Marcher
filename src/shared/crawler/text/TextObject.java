package shared.crawler.text;

import shared.crawler.text.input.NormalizeTextInput;

/**
 * Canonical shared crawler-text seam for parser-facing whitespace cleanup.
 * It owns NBSP replacement, whitespace collapse, trimming, and optional
 * blank-to-null handling so parser classes do not each keep their own
 * normalization rules.
 */
@SuppressWarnings("unused")
public final class TextObject {

    public NormalizeTextInput.NormalizedTextInput normalizeText(NormalizeTextInput input) {
        String normalized = input.value();
        if (normalized == null) {
            return new NormalizeTextInput.NormalizedTextInput(input.blankToNull() ? null : "");
        }
        normalized = normalized.replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
        if (normalized.isEmpty() && input.blankToNull()) {
            return new NormalizeTextInput.NormalizedTextInput(null);
        }
        return new NormalizeTextInput.NormalizedTextInput(normalized);
    }
}
