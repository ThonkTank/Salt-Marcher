package src.view.leftbartabs.dungeontravel;

import java.util.List;
import javafx.beans.property.ReadOnlyIntegerProperty;
import javafx.beans.property.ReadOnlyIntegerWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.published.TravelDungeonAction;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.dungeon.published.TravelDungeonWorkspaceState;
import src.domain.dungeon.published.DungeonOverlaySettings;

public final class DungeonTravelContributionModel {

    private static final String DEFAULT_MAP_NAME = "Dungeon";
    private static final String DEFAULT_ACTION_LABEL = "Aktion";
    private static final String DEFAULT_HEADING_LABEL = "Sueden";
    private static final String DEFAULT_STATUS_LABEL = "Token auf der Karte ziehen";
    private static final String OUTSIDE_DUNGEON_STATUS = "Gruppe befindet sich ausserhalb des Dungeons";
    private static final String NO_LOCATION_LABEL = "Kein Standort";

    private final ReadOnlyObjectWrapper<List<ActionProjection>> actions =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper(DEFAULT_MAP_NAME);
    private final ReadOnlyObjectWrapper<OverlayProjection> overlaySettings =
            new ReadOnlyObjectWrapper<>(OverlayProjection.defaults());
    private final ReadOnlyIntegerWrapper projectionLevel = new ReadOnlyIntegerWrapper(0);

    public DungeonTravelContributionModel() {
        refreshStateText(null);
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

    int currentProjectionLevel() {
        return projectionLevel.get();
    }

    void bindStateContentModel(DungeonTravelStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        state.addListener((ignored, before, after) -> contentModel.showState(after));
        actions.addListener((ignored, before, after) -> contentModel.showActions(toStateActionItems(after)));
        contentModel.apply(state.get(), toStateActionItems(actions.get()));
    }

    void bindControlsContentModel(DungeonTravelControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        mapName.addListener((ignored, before, after) -> contentModel.showMapName(after));
        overlaySettings.addListener((ignored, before, after) ->
                contentModel.showOverlaySettings(toControlsOverlaySettings(after), false));
        projectionLevel.addListener((ignored, before, after) -> contentModel.showProjectionLevel(after.intValue()));
        contentModel.showMapName(mapName.get());
        contentModel.showOverlaySettings(toControlsOverlaySettings(overlaySettings.get()), false);
        contentModel.showProjectionLevel(projectionLevel.get());
    }

    void apply(TravelDungeonSnapshot snapshot) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        TravelDungeonWorkspaceState workspaceState = safeSnapshot.workspaceState();
        overlaySettings.set(OverlayProjection.from(safeSnapshot.overlaySettings()));
        projectionLevel.set(safeSnapshot.projectionLevel());
        if (workspaceState == null) {
            actions.set(List.of());
            mapName.set(DEFAULT_MAP_NAME);
            refreshStateText(null);
            return;
        }
        mapName.set(workspaceState.mapName());
        actions.set(workspaceState.actions().stream()
                        .map(ActionProjection::from)
                        .toList());
        refreshStateText(workspaceState);
    }

    static final class ActionProjection {

        private final String actionId;
        private final String buttonLabel;
        private final String descriptionText;

        private ActionProjection(String actionId, String buttonLabel, String descriptionText) {
            this.actionId = actionId == null ? "" : actionId.trim();
            this.buttonLabel = buttonLabel == null || buttonLabel.isBlank()
                    ? DEFAULT_ACTION_LABEL
                    : buttonLabel.trim();
            this.descriptionText = descriptionText == null ? "" : descriptionText.trim();
        }

        static ActionProjection from(TravelDungeonAction action) {
            if (action == null) {
                return new ActionProjection("", DEFAULT_ACTION_LABEL, "");
            }
            return new ActionProjection(action.actionId(), action.label(), action.description());
        }

        String actionId() {
            return actionId;
        }

        String buttonLabel() {
            return buttonLabel;
        }

        boolean hasDescription() {
            return !descriptionText.isBlank();
        }

        String descriptionText() {
            return descriptionText;
        }
    }

    private static List<DungeonTravelStateContentModel.ActionItem> toStateActionItems(List<ActionProjection> projections) {
        if (projections == null) {
            return List.of();
        }
        return projections.stream()
                .map(DungeonTravelContributionModel::toStateActionItem)
                .toList();
    }

    private static DungeonTravelStateContentModel.ActionItem toStateActionItem(ActionProjection projection) {
        if (projection == null) {
            return DungeonTravelStateContentModel.ActionItem.of("", "", "");
        }
        return DungeonTravelStateContentModel.ActionItem.of(
                projection.actionId(),
                projection.buttonLabel(),
                projection.descriptionText());
    }

    private static DungeonOverlaySettings toControlsOverlaySettings(
            OverlayProjection projection
    ) {
        OverlayProjection resolved = projection == null ? OverlayProjection.defaults() : projection;
        return resolved.overlaySettings();
    }

    static final class OverlayProjection {

        private final OverlayMode mode;
        private final int levelRange;
        private final double opacity;
        private final List<Integer> selectedLevels;
        private final DungeonOverlaySettings overlaySettings;

        private OverlayProjection(
                OverlayMode mode,
                int levelRange,
                double opacity,
                List<Integer> selectedLevels,
                DungeonOverlaySettings overlaySettings
        ) {
            this.mode = OverlayMode.safe(mode);
            this.levelRange = Math.max(0, levelRange);
            this.opacity = Math.max(0.0, Math.min(1.0, opacity));
            this.selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
            this.overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        }

        static OverlayProjection defaults() {
            return from(DungeonOverlaySettings.defaults());
        }

        static OverlayProjection from(DungeonOverlaySettings overlaySettings) {
            DungeonOverlaySettings safeOverlay =
                    overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            return new OverlayProjection(
                    OverlayMode.fromKey(safeOverlay.modeKey()),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    safeOverlay.selectedLevels(),
                    safeOverlay);
        }

        String modeKey() {
            return mode.key();
        }

        String overlayLabel() {
            return mode.contributionLabel();
        }

        int levelRange() {
            return levelRange;
        }

        double opacity() {
            return opacity;
        }

        List<Integer> selectedLevels() {
            return selectedLevels;
        }

        DungeonOverlaySettings overlaySettings() {
            return overlaySettings;
        }

    }

    enum OverlayMode {
        OFF("OFF", "Overlays aus"),
        NEARBY("NEARBY", "Nahe Ebenen"),
        SELECTED("SELECTED", "Ausgewählte Ebenen");

        private final String key;
        private final String contributionLabel;

        OverlayMode(String key, String contributionLabel) {
            this.key = key;
            this.contributionLabel = contributionLabel;
        }

        String key() {
            return key;
        }

        String contributionLabel() {
            return contributionLabel;
        }

        static OverlayMode safe(OverlayMode mode) {
            return mode == null ? OFF : mode;
        }

        static OverlayMode fromKey(String modeKey) {
            if (NEARBY.key.equalsIgnoreCase(modeKey)) {
                return NEARBY;
            }
            if (SELECTED.key.equalsIgnoreCase(modeKey)) {
                return SELECTED;
            }
            return OFF;
        }
    }

    private void refreshStateText(TravelDungeonWorkspaceState workspaceState) {
        state.set(StateText.from(
                workspaceState,
                projectionLevel.get(),
                overlaySettings.get()));
    }

    private static final class StateText {

        private static String from(
                TravelDungeonWorkspaceState workspaceState,
                int projectionLevel,
                OverlayProjection overlayProjection
        ) {
            if (workspaceState == null) {
                return defaultText(projectionLevel, overlayProjection);
            }
            OverlayProjection resolvedOverlay = overlayProjection == null
                    ? OverlayProjection.defaults()
                    : overlayProjection;
            return "Position: " + workspaceState.areaLabel() + "\n"
                    + "Tile: " + workspaceState.tileLabel() + "\n"
                    + "Heading: " + workspaceState.headingLabel() + "\n"
                    + "Status: " + statusLabel(workspaceState) + "\n"
                    + resolvedOverlay.overlayLabel();
        }

        private static String defaultText(int projectionLevel, OverlayProjection overlayProjection) {
            OverlayProjection resolvedOverlay = overlayProjection == null
                    ? OverlayProjection.defaults()
                    : overlayProjection;
            return "Position: " + NO_LOCATION_LABEL + "\n"
                    + "Tile: z=" + projectionLevel + "\n"
                    + "Heading: " + DEFAULT_HEADING_LABEL + "\n"
                    + "Status: " + DEFAULT_STATUS_LABEL + "\n"
                    + resolvedOverlay.overlayLabel();
        }

        private static String statusLabel(TravelDungeonWorkspaceState workspaceState) {
            if (!workspaceState.statusLabel().isBlank()) {
                return workspaceState.statusLabel();
            }
            return workspaceState.outsideDungeon()
                    ? OUTSIDE_DUNGEON_STATUS
                    : DEFAULT_STATUS_LABEL;
        }
    }
}
