package src.view.leftbartabs.hexmap;

import java.util.List;
import java.util.Objects;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelSnapshot;

public final class HexMapContributionModel {

    private final HexMapControlsContentModel controlsContentModel;
    private final HexMapMainContentModel mainContentModel;
    private final HexMapStateContentModel stateContentModel;
    private HexTravelSnapshot travelSnapshot = HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.");

    HexMapContributionModel(
            HexMapControlsContentModel controlsContentModel,
            HexMapMainContentModel mainContentModel,
            HexMapStateContentModel stateContentModel
    ) {
        this.controlsContentModel = Objects.requireNonNull(
                controlsContentModel,
                "controlsContentModel");
        this.mainContentModel = Objects.requireNonNull(mainContentModel, "mainContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        HexEditorSnapshot safeSnapshot = snapshot == null
                ? HexEditorSnapshot.empty("Hex editor service is not registered.")
                : snapshot;
        controlsContentModel.applySnapshot(safeSnapshot);
        mainContentModel.applySnapshot(safeSnapshot);
        stateContentModel.applySnapshot(safeSnapshot);
    }

    void applyTravelSnapshot(HexTravelSnapshot snapshot) {
        travelSnapshot = snapshot == null
                ? HexTravelSnapshot.empty("Hex travel service is not registered.")
                : snapshot;
        mainContentModel.applyTravelSnapshot(travelSnapshot);
        stateContentModel.applyTravelSnapshot(travelSnapshot);
    }

    void showLocalFailure(String failureText) {
        stateContentModel.showLocalFailure(failureText);
    }

    HexMapControlsContentModel controlsContentModel() {
        return controlsContentModel;
    }

    HexMapMainContentModel mainContentModel() {
        return mainContentModel;
    }

    HexMapStateContentModel stateContentModel() {
        return stateContentModel;
    }

    List<Long> partyTokenCharacterIds() {
        return travelSnapshot.partyTokenCharacterIds();
    }
}
