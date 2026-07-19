package features.catalog.adapter.javafx;

import features.catalog.application.CatalogActionId;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.IntConsumer;

/** Typed callbacks from the one renderer into the active BrowseSession workspace route. */
record CatalogSectionCommands<Q, K>(
        Consumer<Q> editDraft,
        Runnable submit,
        IntConsumer shiftPage,
        Consumer<Optional<K>> select,
        BiConsumer<CatalogActionId, K> rowAction,
        Consumer<CatalogActionId> sectionAction,
        Runnable confirm,
        Runnable cancel
) {
    CatalogSectionCommands {
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
