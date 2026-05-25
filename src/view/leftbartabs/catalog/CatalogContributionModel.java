package src.view.leftbartabs.catalog;

import javafx.beans.property.ReadOnlyLongProperty;
import javafx.beans.property.ReadOnlyLongWrapper;

public final class CatalogContributionModel {

    private final CatalogMainContentModel mainContentModel = new CatalogMainContentModel();
    private final CatalogControlsContentModel controlsContentModel = new CatalogControlsContentModel();
    private final ReadOnlyLongWrapper creatureDetailSelection = new ReadOnlyLongWrapper(0L);

    CatalogMainContentModel mainContentModel() {
        return mainContentModel;
    }

    CatalogControlsContentModel controlsContentModel() {
        return controlsContentModel;
    }

    ReadOnlyLongProperty creatureDetailSelectionProperty() {
        return creatureDetailSelection.getReadOnlyProperty();
    }

    void setCreatureDetailSelection(long creatureId) {
        creatureDetailSelection.set(Math.max(0L, creatureId));
    }
}
