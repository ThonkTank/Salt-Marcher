package src.view.leftbartabs.catalog;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class CatalogControlsContentModel {

    private final ReadOnlyObjectWrapper<CatalogContributionModel.ControlsProjection> projection =
            new ReadOnlyObjectWrapper<>(CatalogContributionModel.ControlsProjection.initial());

    ReadOnlyObjectProperty<CatalogContributionModel.ControlsProjection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyProjection(CatalogContributionModel.ControlsProjection nextProjection) {
        projection.set(nextProjection == null ? CatalogContributionModel.ControlsProjection.initial() : nextProjection);
    }
}
