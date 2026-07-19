package features.catalog.application;

import java.util.Objects;
import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.IntConsumer;

/** Typed, framework-neutral commands exposed by the active Catalog section. */
public record CatalogSectionCommands<Q, K>(
        Consumer<Q> editDraft,
        Runnable submit,
        IntConsumer shiftPage,
        Consumer<Optional<K>> select,
        BiConsumer<CatalogActionId, K> rowAction,
        Consumer<CatalogActionId> sectionAction,
        Consumer<CatalogConfirmation<K>> confirm,
        Consumer<CatalogConfirmation<K>> cancel
) {
    public CatalogSectionCommands {
        editDraft = Objects.requireNonNull(editDraft, "editDraft");
        submit = Objects.requireNonNull(submit, "submit");
        shiftPage = Objects.requireNonNull(shiftPage, "shiftPage");
        select = Objects.requireNonNull(select, "select");
        rowAction = Objects.requireNonNull(rowAction, "rowAction");
        sectionAction = Objects.requireNonNull(sectionAction, "sectionAction");
        confirm = Objects.requireNonNull(confirm, "confirm");
        cancel = Objects.requireNonNull(cancel, "cancel");
    }
}
