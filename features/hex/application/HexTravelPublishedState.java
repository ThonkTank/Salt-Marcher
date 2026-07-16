package features.hex.application;

import features.hex.api.HexTravelModel;
import features.hex.api.HexTravelSnapshot;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class HexTravelPublishedState {

    private static final String NO_TRAVEL_SELECTED = "Keine Hex-Reiseposition ausgewaehlt.";

    private final PublishedState<HexTravelSnapshot> travel;
    private final HexTravelModel model;

    public HexTravelPublishedState(UiDispatcher dispatcher) {
        travel = new PublishedState<>(HexTravelSnapshot.empty(NO_TRAVEL_SELECTED), dispatcher);
        model = new HexTravelModel(travel::current, travel::subscribe);
    }

    public HexTravelModel model() {
        return model;
    }

    void publish(HexTravelSnapshot snapshot) {
        travel.publish(snapshot == null ? HexTravelSnapshot.empty(NO_TRAVEL_SELECTED) : snapshot);
    }
}
