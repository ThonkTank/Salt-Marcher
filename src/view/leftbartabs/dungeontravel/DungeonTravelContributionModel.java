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
import src.domain.travel.published.TravelOverlaySettings;

public final class DungeonTravelContributionModel {

    private final ReadOnlyObjectWrapper<List<ActionProjection>> actions =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("Dungeon");
    private final ReadOnlyObjectWrapper<OverlayProjection> overlaySettings =
            new ReadOnlyObjectWrapper<>(OverlayProjection.defaults());
    private final ReadOnlyIntegerWrapper projectionLevel = new ReadOnlyIntegerWrapper(0);
    public DungeonTravelContributionModel() {
        refreshStateText();
    }

    public ReadOnlyObjectProperty<List<ActionProjection>> actionsProperty() {
        return actions.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty mapNameProperty() {
        return mapName.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<OverlayProjection> overlaySettingsProperty() {
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
        overlaySettings.set(toOverlaySettings(safeSnapshot.overlaySettings()));
        projectionLevel.set(safeSnapshot.projectionLevel());
        if (workspaceState == null) {
            actions.set(List.of());
            mapName.set("Dungeon");
            refreshStateText();
            return;
        }
        mapName.set(workspaceState.mapName());
        actions.set(workspaceState.actions().stream()
                        .map(action -> new ActionProjection(
                                action.actionId(),
                                action.label(),
                                action.description()))
                        .toList());
        refreshStateText(workspaceState);
    }

    int currentProjectionLevel() {
        return projectionLevel.get();
    }

    OverlayProjection currentOverlaySettings() {
        return overlaySettings.get();
    }

    private void refreshStateText() {
        state.set("Position: Kein Standort\n"
                + "Tile: z=" + projectionLevel.get() + "\n"
                + "Heading: Sueden\n"
                + "Status: Token auf der Karte ziehen\n"
                + overlaySettings.get().overlayLabel());
    }

    private void refreshStateText(TravelDungeonWorkspaceState workspaceState) {
        if (workspaceState == null) {
            refreshStateText();
            return;
        }
        state.set("Position: " + workspaceState.areaLabel() + "\n"
                + "Tile: " + workspaceState.tileLabel() + "\n"
                + "Heading: " + workspaceState.headingLabel() + "\n"
                + "Status: " + (workspaceState.statusLabel().isBlank()
                ? (workspaceState.outsideDungeon()
                        ? "Gruppe befindet sich ausserhalb des Dungeons"
                        : "Token auf der Karte ziehen")
                : workspaceState.statusLabel()) + "\n"
                + overlaySettings.get().overlayLabel());
    }

    private static OverlayProjection toOverlaySettings(
            TravelOverlaySettings overlaySettings
    ) {
        TravelOverlaySettings safeOverlay =
                overlaySettings == null ? TravelOverlaySettings.defaults() : overlaySettings;
        return new OverlayProjection(
                normalizeOverlayMode(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static String normalizeOverlayMode(String modeKey) {
        if ("NEARBY".equalsIgnoreCase(modeKey)) {
            return "NEARBY";
        }
        if ("SELECTED".equalsIgnoreCase(modeKey)) {
            return "SELECTED";
        }
        return "OFF";
    }

    public record ActionProjection(
            String actionId,
            String label,
            String description
    ) {

        public ActionProjection {
            actionId = actionId == null ? "" : actionId.trim();
            label = label == null || label.isBlank() ? "Aktion" : label.trim();
            description = description == null ? "" : description.trim();
        }
    }

    public record OverlayProjection(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {

        public OverlayProjection {
            modeKey = normalizeOverlayMode(modeKey);
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        static OverlayProjection defaults() {
            return new OverlayProjection("OFF", 2, 0.35, List.of());
        }

        String overlayLabel() {
            return switch (modeKey) {
                case "NEARBY" -> "Nahe Ebenen";
                case "SELECTED" -> "Ausgewählte Ebenen";
                default -> "Overlays aus";
            };
        }
    }
}
