package src.domain.hex.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class HexEditorModel {

    private final Supplier<HexEditorSnapshot> currentSupplier;
    private final Function<Consumer<HexEditorSnapshot>, Runnable> subscribeAction;

    public HexEditorModel(
            Supplier<HexEditorSnapshot> currentSupplier,
            Function<Consumer<HexEditorSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> HexEditorSnapshot.empty("Hex editor service is not registered.")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public HexEditorSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<HexEditorSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
