package src.view.leftbartabs.catalog;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class CatalogMainContentModel {

    private final ReadOnlyObjectWrapper<CatalogContributionModel.MainProjection> projection =
            new ReadOnlyObjectWrapper<>(CatalogContributionModel.MainProjection.initial());

    ReadOnlyObjectProperty<CatalogContributionModel.MainProjection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyProjection(CatalogContributionModel.MainProjection nextProjection) {
        projection.set(nextProjection == null ? CatalogContributionModel.MainProjection.initial() : nextProjection);
    }
}
