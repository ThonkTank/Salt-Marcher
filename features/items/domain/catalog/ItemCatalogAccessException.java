package features.items.domain.catalog;

import java.util.Objects;

/** Typed provider failure that keeps persistence implementation details below Items. */
public final class ItemCatalogAccessException extends IllegalStateException {

    private final Reason reason;

    public ItemCatalogAccessException(Reason reason, Throwable cause) {
        super("Item catalog access failed: " + Objects.requireNonNull(reason, "reason"), cause);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }

    public enum Reason {
        INCOMPATIBLE,
        STORAGE
    }
}
