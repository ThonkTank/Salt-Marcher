package src.domain.creatures.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record CreatureCatalogModel(
        Supplier<CreatureCatalogPageResult> currentSupplier,
        Function<Consumer<CreatureCatalogPageResult>, Runnable> subscribeAction
) {

    public CreatureCatalogModel {
        currentSupplier = currentSupplier == null
                ? () -> new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, CreatureCatalogPage.empty(50, 0))
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public CreatureCatalogPageResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureCatalogPageResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
