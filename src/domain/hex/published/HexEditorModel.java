package src.domain.hex.published;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class HexEditorModel {

    private final Supplier<HexEditorSnapshot> currentSupplier;
    private final Function<Consumer<HexEditorSnapshot>, Runnable> subscribeAction;
    private final List<Consumer<HexEditorSnapshot>> listeners = new ArrayList<>();
    private HexEditorSnapshot current = HexEditorSnapshot.empty("No Hex map loaded.");

    public HexEditorModel() {
        currentSupplier = this::localCurrent;
        subscribeAction = this::localSubscribe;
    }

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

    public void publish(HexEditorSnapshot snapshot) {
        current = snapshot == null ? HexEditorSnapshot.empty("Hex editor service is not registered.") : snapshot;
        for (Consumer<HexEditorSnapshot> listener : List.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    private HexEditorSnapshot localCurrent() {
        return current;
    }

    private Runnable localSubscribe(Consumer<HexEditorSnapshot> listener) {
        Consumer<HexEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        safeListener.accept(current);
        return () -> listeners.remove(safeListener);
    }
}
