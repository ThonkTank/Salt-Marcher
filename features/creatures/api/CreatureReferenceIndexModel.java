package features.creatures.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class CreatureReferenceIndexModel {

    private final Supplier<CreatureReferenceIndexResult> currentSupplier;
    private final Function<Consumer<CreatureReferenceIndexResult>, Runnable> subscribeAction;
    private final Function<Consumer<CreatureReferenceIndexResult>, Runnable> observeLatestAction;

    public CreatureReferenceIndexModel(
            Supplier<CreatureReferenceIndexResult> currentSupplier,
            Function<Consumer<CreatureReferenceIndexResult>, Runnable> subscribeAction,
            Function<Consumer<CreatureReferenceIndexResult>, Runnable> observeLatestAction
    ) {
        this.currentSupplier = Objects.requireNonNull(currentSupplier, "currentSupplier");
        this.subscribeAction = Objects.requireNonNull(subscribeAction, "subscribeAction");
        this.observeLatestAction = Objects.requireNonNull(observeLatestAction, "observeLatestAction");
    }

    public Runnable observeLatest(Consumer<CreatureReferenceIndexResult> observer) {
        return Objects.requireNonNull(observeLatestAction.apply(Objects.requireNonNull(observer, "observer")),
                "unsubscribe");
    }

    public CreatureReferenceIndexResult current() {
        return Objects.requireNonNull(currentSupplier.get(), "current creature index");
    }

    public Runnable subscribe(Consumer<CreatureReferenceIndexResult> listener) {
        return Objects.requireNonNull(
                subscribeAction.apply(Objects.requireNonNull(listener, "listener")), "unsubscribe");
    }
}
