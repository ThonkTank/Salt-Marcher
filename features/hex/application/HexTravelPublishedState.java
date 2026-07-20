package features.hex.application;

import features.hex.api.HexTravelModel;
import features.hex.api.HexTravelSnapshot;
import java.util.concurrent.atomic.AtomicLong;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class HexTravelPublishedState {

    private static final String NO_TRAVEL_SELECTED = "Keine Hex-Reiseposition ausgewaehlt.";

    private final PublishedState<HexTravelSnapshot> travel;
    private final HexTravelModel model;
    private final AtomicLong sourceRevision = new AtomicLong();

    public HexTravelPublishedState(UiDispatcher dispatcher) {
        travel = new PublishedState<>(HexTravelSnapshot.empty(NO_TRAVEL_SELECTED), dispatcher);
        model = new HexTravelModel(travel::current, travel::subscribe);
    }

    public HexTravelModel model() {
        return model;
    }

    void publish(HexTravelSnapshot snapshot) {
        HexTravelSnapshot safeSnapshot = snapshot == null
                ? HexTravelSnapshot.empty(NO_TRAVEL_SELECTED)
                : snapshot;
        travel.publish(safeSnapshot.withSourceRevision(sourceRevision.incrementAndGet()));
    }

    void publishStorageError(String statusText) {
        publish(HexTravelSnapshot.empty(travel.current().partyPositionRevision(), statusText));
    }
}
