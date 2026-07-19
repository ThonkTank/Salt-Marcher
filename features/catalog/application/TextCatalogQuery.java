package features.catalog.application;

import java.util.Objects;

/** Shared typed query for text-only sections. */
public record TextCatalogQuery(String text) {
    public TextCatalogQuery {
        text = Objects.requireNonNullElse(text, "");
    }

    public static TextCatalogQuery empty() {
        return new TextCatalogQuery("");
    }
}
