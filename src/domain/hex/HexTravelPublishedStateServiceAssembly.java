package src.domain.hex;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.hex.model.map.HexTravelPositionState;
import src.domain.hex.model.map.repository.HexTravelPublishedStateRepository;
import src.domain.hex.published.HexTravelModel;
import src.domain.hex.published.HexTravelSnapshot;

final class HexTravelPublishedStateServiceAssembly implements HexTravelPublishedStateRepository {

    private final List<Consumer<HexTravelSnapshot>> listeners = new ArrayList<>();
    private HexTravelSnapshot current = HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.");

    HexTravelModel model() {
        return new HexTravelModel(this::current, this::subscribe);
    }

    @Override
    public void publish(HexTravelPositionState state) {
        current = toSnapshot(state);
        for (Consumer<HexTravelSnapshot> listener : List.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    private HexTravelSnapshot current() {
        return current;
    }

    private Runnable subscribe(Consumer<HexTravelSnapshot> listener) {
        Consumer<HexTravelSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        safeListener.accept(current);
        return () -> listeners.remove(safeListener);
    }

    private static HexTravelSnapshot toSnapshot(HexTravelPositionState state) {
        HexTravelPositionState safeState = state == null
                ? HexTravelPositionState.empty("Keine Hex-Reiseposition ausgewaehlt.")
                : state;
        if (!safeState.active()) {
            return HexTravelSnapshot.empty(safeState.statusText());
        }
        return new HexTravelSnapshot(
                true,
                safeState.mapId(),
                safeState.q(),
                safeState.r(),
                safeState.mapDisplayName() + " " + safeState.q() + "," + safeState.r(),
                safeState.statusText(),
                "nicht verfuegbar",
                "nicht verfuegbar",
                "Normal",
                safeState.hintText(),
                safeState.characterIds());
    }
}
