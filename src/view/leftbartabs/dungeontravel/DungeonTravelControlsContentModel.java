package src.view.leftbartabs.dungeontravel;

import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyDoubleWrapper;
import javafx.beans.property.ReadOnlyIntegerProperty;
import javafx.beans.property.ReadOnlyIntegerWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

final class DungeonTravelControlsContentModel {

    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonTravelContributionModel.OverlayProjection> overlaySettings =
            new ReadOnlyObjectWrapper<>(DungeonTravelContributionModel.OverlayProjection.defaults());
    private final ReadOnlyIntegerWrapper projectionLevel = new ReadOnlyIntegerWrapper(0);
    private final ReadOnlyDoubleWrapper zoom = new ReadOnlyDoubleWrapper(1.0);

    ReadOnlyStringProperty mapNameProperty() {
        return mapName.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<DungeonTravelContributionModel.OverlayProjection> overlaySettingsProperty() {
        return overlaySettings.getReadOnlyProperty();
    }

    ReadOnlyIntegerProperty projectionLevelProperty() {
        return projectionLevel.getReadOnlyProperty();
    }

    ReadOnlyDoubleProperty zoomProperty() {
        return zoom.getReadOnlyProperty();
    }

    void bindTo(DungeonTravelContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.mapNameProperty().addListener((ignored, before, after) -> mapName.set(after));
        contributionModel.overlaySettingsProperty().addListener((ignored, before, after) -> overlaySettings.set(after));
        contributionModel.projectionLevelProperty().addListener((ignored, before, after) ->
                projectionLevel.set(after.intValue()));
        mapName.set(contributionModel.mapNameProperty().get());
        overlaySettings.set(contributionModel.overlaySettingsProperty().get());
        projectionLevel.set(contributionModel.projectionLevelProperty().get());
    }

    void showZoom(double nextZoom) {
        zoom.set(nextZoom);
    }
}
