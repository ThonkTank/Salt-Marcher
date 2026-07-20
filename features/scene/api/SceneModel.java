package features.scene.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

/** Revisioned, immutable and I/O-free published Scene state. */
public final class SceneModel {

    private final Supplier<SceneSnapshot> currentSupplier;
    private final Function<Consumer<SceneSnapshot>, Runnable> subscribeAction;

    public SceneModel(
            Supplier<SceneSnapshot> currentSupplier,
            Function<Consumer<SceneSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null ? SceneSnapshot::uninitialized : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public SceneSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SceneSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
