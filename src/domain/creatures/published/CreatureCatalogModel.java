package src.domain.creatures.published;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class CreatureCatalogModel {

    private final Supplier<CreatureCatalogPageResult> currentSupplier;
    private final Function<Consumer<CreatureCatalogPageResult>, Runnable> subscribeAction;
    private CreaturePublishedState<CreatureCatalogPageResult> statefulStore;

    public CreatureCatalogModel() {
        this(new CreaturePublishedState<>(emptyResult()));
    }

    private CreatureCatalogModel(CreaturePublishedState<CreatureCatalogPageResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public CreatureCatalogModel(
            Supplier<CreatureCatalogPageResult> currentSupplier,
            Function<Consumer<CreatureCatalogPageResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? CreatureCatalogModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public CreatureCatalogPageResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureCatalogPageResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(CreatureCatalogPageResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static CreatureCatalogPageResult emptyResult() {
        return new CreatureCatalogPageResult(
                CreatureQueryStatus.STORAGE_ERROR,
                CreatureCatalogPage.empty(50, 0));
    }
}

final class CreaturePublishedState<T> {

    private final Set<Consumer<T>> listeners = new LinkedHashSet<>();
    private T current;

    CreaturePublishedState(T initialValue) {
        current = Objects.requireNonNull(initialValue, "initialValue");
    }

    T current() {
        return current;
    }

    Runnable subscribe(Consumer<T> listener) {
        Consumer<T> subscriber = Objects.requireNonNull(listener, "listener");
        listeners.add(subscriber);
        return () -> listeners.remove(subscriber);
    }

    void publish(T nextValue) {
        current = Objects.requireNonNull(nextValue, "nextValue");
        for (Consumer<T> listener : Set.copyOf(listeners)) {
            listener.accept(current);
        }
    }
}
