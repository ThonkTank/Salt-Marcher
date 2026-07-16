package features.dungeon.adapter.javafx.travel;

import java.util.List;
import javafx.beans.property.ReadOnlyIntegerWrapper;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringWrapper;
import features.dungeon.api.TravelDungeonAction;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.api.TravelDungeonWorkspaceState;
import features.dungeon.api.DungeonMapCatalogResponse;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.DungeonOverlaySettings;
import platform.ui.catalogcrud.CatalogCrudControlsContentModel;

public final class DungeonTravelContributionModel {

    private final ReadOnlyObjectWrapper<List<ActionProjection>> actions =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("Dungeon");
    private final ReadOnlyObjectWrapper<OverlayProjection> overlaySettings =
            new ReadOnlyObjectWrapper<>(OverlayProjection.defaults());
    private final ReadOnlyIntegerWrapper projectionLevel = new ReadOnlyIntegerWrapper(0);
    private CatalogCrudControlsContentModel mapCatalogContentModel;

    public DungeonTravelContributionModel() {
        refreshStateText(null);
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

    void bindMapCatalogContentModel(CatalogCrudControlsContentModel contentModel) {
        mapCatalogContentModel = contentModel;
    }

    void applyMapCatalog(DungeonMapCatalogResponse response, long selectedMapId) {
        if (mapCatalogContentModel == null || !(response instanceof DungeonMapCatalogResponse.MapList mapList)) {
            return;
        }
        mapCatalogContentModel.showCatalog(new CatalogCrudControlsContentModel.CatalogState(
                "Dungeon Maps",
                "Dungeon auswählen",
                "Keine Dungeon Maps verfuegbar.",
                selectedMapId <= 0L ? "" : Long.toString(selectedMapId),
                mapList.maps().stream()
                        .map(DungeonTravelContributionModel::catalogItem)
                        .toList(),
                CatalogCrudControlsContentModel.Actions.hiddenReadOnly(),
                false,
                ""));
    }

    private static CatalogCrudControlsContentModel.Item catalogItem(DungeonMapSummary summary) {
        return new CatalogCrudControlsContentModel.Item(
                Long.toString(summary.mapId().value()),
                summary.mapName(),
                "",
                0L,
                true);
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
            mapName.set("Dungeon");
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

        private final String buttonLabel;
        private final String descriptionText;

        private ActionProjection(String buttonLabel, String descriptionText) {
            this.buttonLabel = buttonLabel == null || buttonLabel.isBlank()
                    ? "Aktion"
                    : buttonLabel.trim();
            this.descriptionText = descriptionText == null ? "" : descriptionText.trim();
        }

        static ActionProjection from(TravelDungeonAction action) {
            if (action == null) {
                return new ActionProjection("Aktion", "");
            }
            return new ActionProjection(action.label(), action.description());
        }

        String buttonLabel() {
            return buttonLabel;
        }

        String descriptionText() {
            return descriptionText;
        }
    }

    private static List<DungeonTravelStateContentModel.ActionItem> toStateActionItems(List<ActionProjection> projections) {
        if (projections == null) {
            return List.of();
        }
        List<DungeonTravelStateContentModel.ActionItem> items = new java.util.ArrayList<>();
        for (int index = 0; index < projections.size(); index++) {
            items.add(toStateActionItem(index, projections.get(index)));
        }
        return List.copyOf(items);
    }

    private static DungeonTravelStateContentModel.ActionItem toStateActionItem(
            int rowIndex,
            ActionProjection projection
    ) {
        if (projection == null) {
            return DungeonTravelStateContentModel.ActionItem.of(rowIndex, "", "");
        }
        return DungeonTravelStateContentModel.ActionItem.of(
                rowIndex,
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
        private final DungeonOverlaySettings overlaySettings;

        private OverlayProjection(
                OverlayMode mode,
                DungeonOverlaySettings overlaySettings
        ) {
            this.mode = OverlayMode.safe(mode);
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
                    safeOverlay);
        }

        String overlayLabel() {
            return mode.contributionLabel();
        }

        DungeonOverlaySettings overlaySettings() {
            return overlaySettings;
        }

    }

    private enum OverlayMode {
        OFF("OFF", "Overlays aus"),
        NEARBY("NEARBY", "Nahe Ebenen"),
        SELECTED("SELECTED", "Ausgewählte Ebenen");

        private final String key;
        private final String contributionLabel;

        OverlayMode(String key, String contributionLabel) {
            this.key = key;
            this.contributionLabel = contributionLabel;
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
            return "Position: Kein Standort\n"
                    + "Tile: z=" + projectionLevel + "\n"
                    + "Heading: Sueden\n"
                    + "Status: Token auf der Karte ziehen\n"
                    + resolvedOverlay.overlayLabel();
        }

        private static String statusLabel(TravelDungeonWorkspaceState workspaceState) {
            if (!workspaceState.statusLabel().isBlank()) {
                return workspaceState.statusLabel();
            }
            return workspaceState.outsideDungeon()
                    ? "Gruppe befindet sich ausserhalb des Dungeons"
                    : "Token auf der Karte ziehen";
        }
    }
}
