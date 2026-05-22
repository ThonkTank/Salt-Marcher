package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

public final class DungeonEditorContributionModel {

    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final DungeonEditorStateContentModel stateContentModel;
    private static final long NO_MAP_ID = 0L;

    private DungeonEditorControlsSnapshot controlsSnapshot = DungeonEditorControlsSnapshot.empty("");
    private DungeonEditorStateSnapshot stateSnapshot = DungeonEditorStateSnapshot.empty("");
    private InteractionState interactionState = InteractionState.empty();

    DungeonEditorContributionModel(DungeonEditorStateContentModel stateContentModel) {
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
        refreshProjection();
    }

    public ReadOnlyObjectProperty<ControlsProjection> controlsProjectionProperty() {
        return controlsProjection.getReadOnlyProperty();
    }

    public void applyControls(DungeonEditorControlsSnapshot controlsSnapshot) {
        this.controlsSnapshot = controlsSnapshot == null ? DungeonEditorControlsSnapshot.empty("") : controlsSnapshot;
        refreshProjection();
    }

    public void applyState(DungeonEditorStateSnapshot stateSnapshot) {
        this.stateSnapshot = stateSnapshot == null ? DungeonEditorStateSnapshot.empty("") : stateSnapshot;
        refreshProjection();
    }

    InteractionState currentInteractionState() {
        return interactionState;
    }

    void bindControlsContentModel(DungeonEditorControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        controlsProjection.addListener((ignored, before, after) -> applyControlsProjection(after, contentModel));
        applyControlsProjection(controlsProjection.get(), contentModel);
    }

    private static void applyControlsProjection(
            ControlsProjection projection,
            DungeonEditorControlsContentModel contentModel
    ) {
        ControlsProjection safeProjection = projection == null
                ? ControlsProjection.initial()
                : projection;
        OverlayProjection overlay = safeProjection.overlayProjection();
        contentModel.showControls(
                safeProjection.mapEntries().stream()
                        .map(entry -> new DungeonEditorControlsContentModel.MapItem(
                                entry.key(),
                                entry.mapIdValue(),
                                entry.mapName(),
                                entry.revision()))
                        .toList(),
                safeProjection.selectedMapKey(),
                safeProjection.reachableLevels(),
                safeProjection.busy(),
                safeProjection.statusText(),
                safeProjection.viewModeLabel(),
                overlay == null
                        ? DungeonEditorControlsContentModel.OverlaySettings.defaults()
                        : new DungeonEditorControlsContentModel.OverlaySettings(
                                overlay.modeKey(),
                                overlay.levelRange(),
                                overlay.opacity(),
                                overlay.selectedLevels()),
                safeProjection.projectionLevel(),
                safeProjection.selectedToolLabel());
    }

    private void refreshProjection() {
        var bundle = ProjectionFactory.create(controlsSnapshot);
        interactionState = bundle.interactionState();
        controlsProjection.set(bundle.controlsProjection());
        stateContentModel.apply(stateSnapshot, bundle.stateProjectionContext());
    }

    private static final class ProjectionFactory {
        private static final String NO_MAPS_STATUS = "Keine Dungeon-Maps vorhanden.";
        private static final String NO_SELECTED_MAP_STATUS = "Kein Dungeon ausgewählt.";

        private static ProjectionBundle create(DungeonEditorControlsSnapshot controlsSnapshot) {
            ProjectionSource safeSource = ProjectionSource.from(controlsSnapshot);
            List<MapListEntry> mapEntries = safeSource.maps().stream().map(MapListEntry::from).toList();
            List<Integer> reachableLevels = safeSource.reachableLevels();
            int clampedProjectionLevel = clampProjectionLevel(reachableLevels, safeSource.projectionLevel());
            OverlayProjection overlayProjection = OverlayProjection.from(safeSource.overlaySettings());
            String selectedMapKey = MapSelection.keyOf(safeSource.selectedMapId());
            String viewModeLabel = DungeonEditorControlsContentModel.ToolCatalog.labelOf(safeSource.viewMode());
            String selectedToolLabel = DungeonEditorControlsContentModel.ToolCatalog.labelOf(safeSource.selectedTool());
            String statusText = statusTextFor(safeSource, mapEntries);
            long selectedMapIdValue = safeSource.selectedMapId() == null
                    ? NO_MAP_ID
                    : safeSource.selectedMapId().value();
            ControlsProjection controls = new ControlsProjection(
                    mapEntries,
                    selectedMapKey,
                    reachableLevels,
                    false,
                    statusText,
                    viewModeLabel,
                    overlayProjection,
                    clampedProjectionLevel,
                    selectedToolLabel);
            DungeonEditorStateContentModel.StateProjectionContext stateContext =
                    new DungeonEditorStateContentModel.StateProjectionContext(
                            selectedMapIdValue,
                            statusText,
                            false,
                            selectedToolLabel,
                            viewModeLabel,
                            clampedProjectionLevel,
                            overlayProjection.overlayLabel());
            return new ProjectionBundle(
                    controls,
                    stateContext,
                    new InteractionState(
                            selectedMapIdValue,
                            viewModeLabel,
                            selectedToolLabel,
                            safeSource.selectedTool(),
                            overlayProjection));
        }

        private static int clampProjectionLevel(List<Integer> reachableLevels, int projectionLevel) {
            if (reachableLevels == null || reachableLevels.isEmpty()) {
                return Math.max(0, projectionLevel);
            }
            return Math.max(reachableLevels.getFirst(), Math.min(reachableLevels.getLast(), projectionLevel));
        }

        private static String statusTextFor(
                ProjectionSource source,
                List<MapListEntry> mapEntries
        ) {
            if (source.surfaceLoaded()) {
                return source.statusText();
            }
            if (mapEntries.isEmpty()) {
                return NO_MAPS_STATUS;
            }
            if (source.selectedMapId() == null) {
                return NO_SELECTED_MAP_STATUS;
            }
            return source.statusText();
        }

    }

    private record ProjectionBundle(
            ControlsProjection controlsProjection,
            DungeonEditorStateContentModel.StateProjectionContext stateProjectionContext,
            InteractionState interactionState
    ) {
    }

    private record ProjectionSource(
            List<MapSelection> maps,
            @Nullable DungeonMapId selectedMapId,
            boolean surfaceLoaded,
            String statusText,
            DungeonEditorViewMode viewMode,
            DungeonEditorTool selectedTool,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            List<Integer> reachableLevels
    ) {
        ProjectionSource {
            maps = maps == null ? List.of() : List.copyOf(maps);
            reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
            statusText = statusText == null ? "" : statusText;
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            projectionLevel = Math.max(0, projectionLevel);
        }

        private static ProjectionSource from(@Nullable DungeonEditorControlsSnapshot controlsSnapshot) {
            DungeonEditorControlsSnapshot safeControls = controlsSnapshot == null
                    ? DungeonEditorControlsSnapshot.empty("")
                    : controlsSnapshot;
            return new ProjectionSource(
                    safeControls.maps().stream().map(ProjectionSource::toMapSelection).toList(),
                    safeControls.selectedMapId(),
                    safeControls.surfaceLoaded(),
                    safeControls.statusText(),
                    safeControls.viewMode(),
                    safeControls.selectedTool(),
                    safeControls.overlaySettings(),
                    safeControls.projectionLevel(),
                    safeControls.reachableLevels());
        }

        private static MapSelection toMapSelection(@Nullable DungeonMapSummary summary) {
            DungeonMapSummary safeSummary = summary == null
                    ? new DungeonMapSummary(new DungeonMapId(1L), MapSelection.DEFAULT_MAP_NAME, 0L)
                    : summary;
            return new MapSelection(
                    MapSelection.keyOf(safeSummary.mapId()),
                    safeSummary.mapId(),
                    safeSummary.mapName(),
                    safeSummary.revision());
        }
    }

    record ControlsProjection(
            List<MapListEntry> mapEntries,
            String selectedMapKey,
            List<Integer> reachableLevels,
            boolean busy,
            String statusText,
            String viewModeLabel,
            OverlayProjection overlayProjection,
            int projectionLevel,
            String selectedToolLabel
    ) {
        ControlsProjection {
            mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
            selectedMapKey = selectedMapKey == null ? "" : selectedMapKey;
            reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
            statusText = statusText == null ? "" : statusText;
            viewModeLabel = DungeonEditorControlsContentModel.ToolCatalog.normalizeViewModeKey(viewModeLabel);
            overlayProjection = overlayProjection == null
                    ? OverlayProjection.from(DungeonOverlaySettings.defaults())
                    : overlayProjection;
            projectionLevel = Math.max(0, projectionLevel);
            selectedToolLabel = selectedToolLabel == null
                    ? DungeonEditorControlsContentModel.ToolCatalog.DEFAULT_TOOL_LABEL
                    : selectedToolLabel;
        }

        static ControlsProjection initial() {
            return new ControlsProjection(
                    List.of(),
                    "",
                    List.of(0),
                    false,
                    "",
                    DungeonEditorControlsContentModel.ToolCatalog.GRID_VIEW_LABEL,
                    OverlayProjection.from(DungeonOverlaySettings.defaults()),
                    0,
                    DungeonEditorControlsContentModel.ToolCatalog.DEFAULT_TOOL_LABEL);
        }
    }

    record InteractionState(
            long currentSelectedMapIdValue,
            String currentViewModeKey,
            String currentSelectedToolLabel,
            DungeonEditorTool currentSelectedTool,
            OverlayProjection currentOverlayProjection
    ) {
        InteractionState {
            currentSelectedMapIdValue = Math.max(NO_MAP_ID, currentSelectedMapIdValue);
            currentViewModeKey = DungeonEditorControlsContentModel.ToolCatalog.normalizeViewModeKey(currentViewModeKey);
            currentSelectedToolLabel = currentSelectedToolLabel == null
                    ? DungeonEditorControlsContentModel.ToolCatalog.DEFAULT_TOOL_LABEL
                    : currentSelectedToolLabel;
            currentSelectedTool = currentSelectedTool == null
                    ? DungeonEditorTool.SELECT
                    : currentSelectedTool;
            currentOverlayProjection = currentOverlayProjection == null
                    ? OverlayProjection.from(DungeonOverlaySettings.defaults())
                    : currentOverlayProjection;
        }

        static InteractionState empty() {
            return new InteractionState(
                    NO_MAP_ID,
                    DungeonEditorControlsContentModel.ToolCatalog.GRID_VIEW_LABEL,
                    DungeonEditorControlsContentModel.ToolCatalog.DEFAULT_TOOL_LABEL,
                    DungeonEditorTool.SELECT,
                    OverlayProjection.from(DungeonOverlaySettings.defaults()));
        }
    }

    record MapSelection(
            String key,
            DungeonMapId mapId,
            String mapName,
            long revision
    ) {
        static final String DEFAULT_MAP_NAME = "Dungeon Map";

        MapSelection {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? DEFAULT_MAP_NAME : mapName;
            revision = Math.max(0L, revision);
        }

        static String keyOf(@Nullable DungeonMapId mapId) {
            return mapId == null ? "" : Long.toString(mapId.value());
        }
    }

    record MapListEntry(
            String key,
            long mapIdValue,
            String mapName,
            long revision
    ) {
        MapListEntry {
            key = key == null ? "" : key;
            mapIdValue = Math.max(0L, mapIdValue);
            mapName = mapName == null || mapName.isBlank() ? MapSelection.DEFAULT_MAP_NAME : mapName;
            revision = Math.max(0L, revision);
        }

        static MapListEntry from(MapSelection selection) {
            MapSelection safeSelection = selection == null
                    ? new MapSelection("", null, MapSelection.DEFAULT_MAP_NAME, 0L)
                    : selection;
            return new MapListEntry(
                    safeSelection.key(),
                    safeSelection.mapId() == null ? 0L : safeSelection.mapId().value(),
                    safeSelection.mapName(),
                    safeSelection.revision());
        }

    }

    record OverlayProjection(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels,
            String selectedLevelsText
    ) {
        OverlayProjection {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
        }

        static OverlayProjection from(DungeonOverlaySettings overlaySettings) {
            DungeonOverlaySettings safeOverlay =
                    overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            List<Integer> selectedLevels = safeOverlay.selectedLevels();
            return new OverlayProjection(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    selectedLevels,
                    selectedLevels == null || selectedLevels.isEmpty()
                            ? ""
                            : selectedLevels.stream().map(String::valueOf).collect(Collectors.joining(", ")));
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
