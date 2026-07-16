package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionGenerationPreviewModel {

    private final Supplier<SessionGenerationPreviewSnapshot> currentSupplier;
    private final Function<Consumer<SessionGenerationPreviewSnapshot>, Runnable> subscribeAction;

    public SessionGenerationPreviewModel(
            Supplier<SessionGenerationPreviewSnapshot> currentSupplier,
            Function<Consumer<SessionGenerationPreviewSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? SessionGenerationPreviewSnapshot::idle
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionGenerationPreviewSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionGenerationPreviewSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
