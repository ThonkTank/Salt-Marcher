package src.view.leftbartabs.dungeontravel;

import java.util.List;
import javafx.beans.property.ReadOnlyIntegerProperty;
import javafx.beans.property.ReadOnlyIntegerWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelDungeonWorkspaceState;

public final class DungeonTravelContributionModel {

    private final ReadOnlyObjectWrapper<List<DungeonTravelActionProjection>> actions =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper(DungeonTravelUiText.DEFAULT_MAP_NAME);
    private final ReadOnlyObjectWrapper<DungeonTravelOverlayProjection> overlaySettings =
            new ReadOnlyObjectWrapper<>(DungeonTravelOverlayProjection.defaults());
    private final ReadOnlyIntegerWrapper projectionLevel = new ReadOnlyIntegerWrapper(0);

    public DungeonTravelContributionModel() {
        refreshStateText(null);
    }

    public ReadOnlyObjectProperty<List<DungeonTravelActionProjection>> actionsProperty() {
        return actions.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty mapNameProperty() {
        return mapName.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonTravelOverlayProjection> overlaySettingsProperty() {
        return overlaySettings.getReadOnlyProperty();
    }

    public ReadOnlyIntegerProperty projectionLevelProperty() {
        return projectionLevel.getReadOnlyProperty();
    }

    void apply(TravelDungeonSnapshot snapshot) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        TravelDungeonWorkspaceState workspaceState = safeSnapshot.workspaceState();
        overlaySettings.set(DungeonTravelOverlayProjection.from(safeSnapshot.overlaySettings()));
        projectionLevel.set(safeSnapshot.projectionLevel());
        if (workspaceState == null) {
            actions.set(List.of());
            mapName.set(DungeonTravelUiText.DEFAULT_MAP_NAME);
            refreshStateText(null);
            return;
        }
        mapName.set(workspaceState.mapName());
        actions.set(workspaceState.actions().stream()
                        .map(action -> new DungeonTravelActionProjection(
                                action.actionId(),
                                action.label(),
                                action.description()))
                        .toList());
        refreshStateText(workspaceState);
    }

    int currentProjectionLevel() {
        return projectionLevel.get();
    }

    private void refreshStateText(TravelDungeonWorkspaceState workspaceState) {
        if (workspaceState == null) {
            state.set(DungeonTravelStateTextFormatter.defaultState(
                    projectionLevel.get(),
                    overlaySettings.get()));
            return;
        }
        state.set(DungeonTravelStateTextFormatter.fromWorkspaceState(workspaceState, overlaySettings.get()));
    }
}
