package src.view.leftbartabs.hexmap;

import java.util.Objects;
import src.domain.hex.published.HexEditorSnapshot;

public final class HexMapContributionModel {

    private final HexMapControlsContentModel controlsContentModel;
    private final HexMapMainContentModel mainContentModel;
    private final HexMapStateContentModel stateContentModel;

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
}
