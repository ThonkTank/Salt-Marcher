package src.view.leftbartabs.hexmap;

import java.util.Objects;

public final class HexMapContributionModel {

    private final HexMapMainContentModel mainContentModel;

    HexMapContributionModel(HexMapMainContentModel mainContentModel) {
        this.mainContentModel = Objects.requireNonNull(mainContentModel, "mainContentModel");
    }

    HexMapMainContentModel mainContentModel() {
        return mainContentModel;
    }
}
