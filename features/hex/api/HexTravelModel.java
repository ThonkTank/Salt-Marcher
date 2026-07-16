package features.hex.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.state.PublishedState;

public final class HexTravelModel {

    private final Supplier<HexTravelSnapshot> currentSupplier;
    private final Function<Consumer<HexTravelSnapshot>, Runnable> subscribeAction;
    private final List<Consumer<HexTravelSnapshot>> listeners = new ArrayList<>();
    private HexTravelSnapshot current = emptySnapshot();
    private PublishedState<HexTravelSnapshot> statefulStore;

    public HexTravelModel() {
        this(new PublishedState<>(emptySnapshot()));
    }

    public HexTravelModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptySnapshot(), dispatcher));
    }

    private HexTravelModel(PublishedState<HexTravelSnapshot> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public HexTravelModel(
            Supplier<HexTravelSnapshot> currentSupplier,
            Function<Consumer<HexTravelSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> HexTravelSnapshot.empty("Hex travel readback is not registered.")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public HexTravelSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<HexTravelSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(HexTravelSnapshot snapshot) {
        if (statefulStore != null) {
            statefulStore.publish(snapshot == null ? emptySnapshot() : snapshot);
            return;
        }
        current = snapshot == null
                ? HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.")
                : snapshot;
        for (Consumer<HexTravelSnapshot> listener : List.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    private HexTravelSnapshot localCurrent() {
        return current;
    }

    private Runnable localSubscribe(Consumer<HexTravelSnapshot> listener) {
        Consumer<HexTravelSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        safeListener.accept(current);
        return () -> listeners.remove(safeListener);
    }

    private static HexTravelSnapshot emptySnapshot() {
        return HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.");
    }
}
