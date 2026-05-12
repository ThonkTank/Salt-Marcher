package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorMapSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapSummary;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorSurface;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.ControlsProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.InteractionState;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.LocalState;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.MapEditorUiState;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.MapListEntry;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.MapSelection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.OverlayProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.RoomExitNarrationProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.RoomNarrationCardProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.StateProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.ToolFamily;

final class ProjectionFactory {

    private static final String NO_MAPS_STATUS = "Keine Dungeon-Maps vorhanden.";
    private static final String NO_SELECTED_MAP_STATUS = "Kein Dungeon ausgewählt.";

    static ProjectionBundle create(
            DungeonEditorSnapshot snapshot,
            LocalState localState
    ) {
        ProjectionSource safeSource = ProjectionSource.from(snapshot);
        LocalState safeLocalState = localState == null ? LocalState.initial() : localState;
        List<MapListEntry> mapEntries = safeSource.maps().stream().map(MapListEntry::from).toList();
        List<Integer> reachableLevels = SurfaceLevels.from(safeSource.surface(), safeSource.projectionLevel());
        int clampedProjectionLevel = clampProjectionLevel(reachableLevels, safeSource.projectionLevel());
        OverlayProjection overlayProjection = OverlayProjection.from(safeSource.overlaySettings());
        String selectedMapKey = MapSelection.keyOf(safeSource.selectedMapId());
        String viewModeLabel = ToolCatalog.labelOf(safeSource.viewMode());
        String selectedToolLabel = ToolCatalog.labelOf(safeSource.selectedTool());
        String statusText = statusTextFor(safeSource, mapEntries);
        MapEditorUiState mapEditorUiState =
                synchronizeMapEditorUiState(safeLocalState.mapEditorUiState(), mapEntries);
        List<RoomNarrationCardProjection> narrationCards =
                ProjectionTextSupport.toNarrationCards(safeSource.inspector());
        ControlsProjection controlsProjection = new ControlsProjection(
                mapEntries,
                selectedMapKey,
                reachableLevels,
                false,
                statusText,
                viewModeLabel,
                overlayProjection,
                clampedProjectionLevel,
                selectedToolLabel,
                mapEditorUiState,
                safeLocalState.toolPaletteUiState());
        StateProjection stateProjection = new StateProjection(
                ProjectionTextSupport.stateTextFor(
                        safeSource,
                        overlayProjection,
                        selectedToolLabel,
                        viewModeLabel,
                        clampedProjectionLevel),
                statusText,
                false,
                narrationCards);
        long selectedMapIdValue = safeSource.selectedMapId() == null ? LocalIds.NO_MAP_ID : safeSource.selectedMapId().value();
        return new ProjectionBundle(
                controlsProjection,
                stateProjection,
                new InteractionState(
                        selectedMapIdValue,
                        viewModeLabel,
                        selectedToolLabel,
                        overlayProjection,
                        mapEditorUiState,
                        mapEntries),
                new LocalState(mapEditorUiState, safeLocalState.toolPaletteUiState()));
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
        if (source.surface() != null) {
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

    private static MapEditorUiState synchronizeMapEditorUiState(
            MapEditorUiState mapEditorUiState,
            List<MapListEntry> mapEntries
    ) {
        MapEditorUiState safeState =
                mapEditorUiState == null ? MapEditorUiState.hidden() : mapEditorUiState;
        if (!safeState.visible() || !safeState.targetsExistingMap()) {
            return safeState;
        }
        return findMapEntry(mapEntries, safeState.mapIdValue()) == null
                ? MapEditorUiState.hidden()
                : safeState;
    }

    private static @Nullable MapListEntry findMapEntry(
            List<MapListEntry> mapEntries,
            long mapIdValue
    ) {
        return mapIdValue <= LocalIds.NO_MAP_ID
                ? null
                : mapEntries.stream().filter(entry -> entry.matchesId(mapIdValue)).findFirst().orElse(null);
    }
}

record ProjectionBundle(
        ControlsProjection controlsProjection,
        StateProjection stateProjection,
        InteractionState interactionState,
        LocalState localState
) {
}

record ProjectionSource(
        List<MapSelection> maps,
        @Nullable DungeonEditorMapId selectedMapId,
        @Nullable DungeonEditorSurface surface,
        @Nullable DungeonEditorInspectorSnapshot inspector,
        SelectionData selection,
        DungeonEditorPreview preview,
        String statusText,
        DungeonEditorViewMode viewMode,
        DungeonEditorTool selectedTool,
        DungeonEditorOverlaySettings overlaySettings,
        int projectionLevel
) {
    ProjectionSource {
        maps = maps == null ? List.of() : List.copyOf(maps);
        inspector = inspector == null && surface != null ? surface.inspector() : inspector;
        selection = selection == null ? SelectionData.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        statusText = statusText == null ? "" : statusText;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
        projectionLevel = Math.max(0, projectionLevel);
    }

    static ProjectionSource from(@Nullable DungeonEditorSnapshot snapshot) {
        DungeonEditorSnapshot safeSnapshot = snapshot == null ? DungeonEditorSnapshot.empty("") : snapshot;
        DungeonEditorSurface surface = safeSnapshot.surface();
        return new ProjectionSource(
                safeSnapshot.maps().stream().map(ProjectionSource::toMapSelection).toList(),
                safeSnapshot.selectedMapId(),
                surface,
                surface == null ? null : surface.inspector(),
                SelectionData.from(safeSnapshot.selection()),
                safeSnapshot.preview(),
                safeSnapshot.statusText(),
                safeSnapshot.viewMode(),
                safeSnapshot.selectedTool(),
                safeSnapshot.overlaySettings(),
                safeSnapshot.projectionLevel());
    }

    static ProjectionSource empty() {
        return from(DungeonEditorSnapshot.empty(""));
    }

    private static MapSelection toMapSelection(@Nullable DungeonEditorMapSummary summary) {
        DungeonEditorMapSummary safeSummary = summary == null
                ? new DungeonEditorMapSummary(new DungeonEditorMapId(1L), MapSelection.DEFAULT_MAP_NAME, 0L)
                : summary;
        return new MapSelection(
                MapSelection.keyOf(safeSummary.mapId()),
                safeSummary.mapId(),
                safeSummary.mapName(),
                safeSummary.revision());
    }

record SelectionData(String kind, long id) {
        SelectionData {
            kind = kind == null ? "EMPTY" : kind;
            id = Math.max(0L, id);
        }

        static SelectionData empty() {
            return new SelectionData("EMPTY", 0L);
        }

        static SelectionData from(DungeonEditorSnapshot.Selection selection) {
            DungeonEditorSnapshot.Selection safeSelection = selection == null
                    ? DungeonEditorSnapshot.Selection.empty()
                    : selection;
            return new SelectionData(safeSelection.topologyRef().kind(), safeSelection.topologyRef().id());
        }

        boolean isEmpty() {
            return "EMPTY".equals(kind);
        }
    }
}

final class ProjectionTextSupport {

    static String stateTextFor(
            ProjectionSource source,
            OverlayProjection overlayProjection,
            String selectedToolLabel,
            String viewModeLabel,
            int projectionLevel
    ) {
        return "Werkzeug: " + selectedToolLabel
                + "\nAnsicht: " + viewModeLabel
                + "\nEbene: z=" + projectionLevel
                + "\n" + overlayProjection.overlayLabel()
                + "\n" + selectionTextFor(source.selection(), source.inspector())
                + "\n" + previewTextFor(source.preview());
    }

    static List<RoomNarrationCardProjection> toNarrationCards(
            @Nullable DungeonEditorInspectorSnapshot inspector
    ) {
        if (inspector == null) {
            return List.of();
        }
        return inspector.roomNarrations().stream()
                .map(card -> new RoomNarrationCardProjection(
                        card.roomId(),
                        card.roomName(),
                        card.visualDescription(),
                        card.exits().stream()
                                .map(exit -> new RoomExitNarrationProjection(
                                        exit.label(),
                                        exit.cell().q(),
                                        exit.cell().r(),
                                        exit.cell().level(),
                                        exit.direction(),
                                        exit.description()))
                                .toList()))
                .toList();
    }

    private static String selectionTextFor(
            ProjectionSource.SelectionData selection,
            @Nullable DungeonEditorInspectorSnapshot inspector
    ) {
        if (selection.isEmpty()) {
            return "Auswahl: Keine";
        }
        String selectionLabel = inspector != null && !inspector.title().isBlank()
                ? inspector.title()
                : selection.kind();
        return "Auswahl: " + selectionLabel + " (" + selection.kind() + " " + selection.id() + ")";
    }

    private static String previewTextFor(DungeonEditorPreview preview) {
        if (preview == null || preview instanceof DungeonEditorPreview.NonePreview) {
            return "Topologie-Preview: inaktiv";
        }
        if (preview instanceof DungeonEditorPreview.MoveHandlePreview movePreview) {
            return "Topologie-Preview: verschieben dq=" + movePreview.deltaQ()
                    + ", dr=" + movePreview.deltaR()
                    + ", dz=" + movePreview.deltaLevel();
        }
        if (preview instanceof DungeonEditorPreview.RoomRectanglePreview roomRectangle) {
            return "Topologie-Preview: "
                    + (roomRectangle.deleteMode() ? ToolCatalog.ROOM_DELETE_LABEL : ToolCatalog.ROOM_PAINT_LABEL)
                    + " z=" + roomRectangle.start().level();
        }
        if (preview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaries) {
            return "Topologie-Preview: "
                    + (boundaries.deleteMode() ? "Kanten löschen" : "Kanten setzen")
                    + " (" + boundaries.edges().size() + ")";
        }
        if (preview instanceof DungeonEditorPreview.MoveBoundaryStretchPreview stretch) {
            return "Topologie-Preview: Wandstrecke verschieben dq=" + stretch.deltaQ()
                    + ", dr=" + stretch.deltaR()
                    + ", dz=" + stretch.deltaLevel()
                    + " (" + stretch.sourceEdges().size() + ")";
        }
        return "Topologie-Preview: aktiv";
    }
}

final class SurfaceLevels {

    static List<Integer> from(@Nullable DungeonEditorSurface surface, int fallbackLevel) {
        SortedSet<Integer> levels = new TreeSet<>();
        if (surface != null && surface.map() != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (DungeonEditorMapSnapshot.Feature feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (DungeonEditorMapSnapshot.Feature feature : surface.previewMap().features()) {
                    addCellLevels(levels, feature.cells());
                }
                surface.previewMap().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(SortedSet<Integer> levels, List<DungeonEditorCell> cells) {
        for (DungeonEditorCell cell : cells == null ? List.<DungeonEditorCell>of() : cells) {
            levels.add(cell.level());
        }
    }
}

final class ToolCatalog {

    static final String DEFAULT_TOOL_LABEL = "Auswahl";
    static final String GRID_VIEW_LABEL = "Grid";
    static final String GRAPH_VIEW_LABEL = "Graph";
    static final String ROOM_PAINT_LABEL = "Raum malen";
    static final String ROOM_DELETE_LABEL = "Raum löschen";
    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();
    private static final Map<String, DungeonEditorSessionValues.Tool> SESSION_TOOLS_BY_LABEL =
            createSessionToolsByLabel();
    private static final Map<ToolFamily, ToolPalette> PALETTES = createPalettes();

    private ToolCatalog() {
    }

    static String labelOf(@Nullable DungeonEditorTool tool) {
        return TOOL_LABELS.getOrDefault(tool == null ? DungeonEditorTool.SELECT : tool, DEFAULT_TOOL_LABEL);
    }

    static String labelOf(@Nullable DungeonEditorViewMode viewMode) {
        return viewMode == DungeonEditorViewMode.GRAPH ? GRAPH_VIEW_LABEL : GRID_VIEW_LABEL;
    }

    static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return GRAPH_VIEW_LABEL.equals(viewModeKey) ? GRAPH_VIEW_LABEL : GRID_VIEW_LABEL;
    }

    static DungeonEditorSessionValues.ViewMode toSessionViewMode(@Nullable String viewModeKey) {
        return GRAPH_VIEW_LABEL.equals(viewModeKey)
                ? DungeonEditorSessionValues.ViewMode.GRAPH
                : DungeonEditorSessionValues.ViewMode.GRID;
    }

    static DungeonEditorSessionValues.Tool toSessionTool(@Nullable String selectedToolLabel) {
        return SESSION_TOOLS_BY_LABEL.getOrDefault(selectedToolLabel, DungeonEditorSessionValues.Tool.SELECT);
    }

    static ToolPalette paletteFor(@Nullable ToolFamily family) {
        return family == null ? ToolPalette.empty() : PALETTES.getOrDefault(family, ToolPalette.empty());
    }

    private static Map<DungeonEditorTool, String> createToolLabels() {
        Map<DungeonEditorTool, String> toolLabels = new EnumMap<>(DungeonEditorTool.class);
        toolLabels.put(DungeonEditorTool.SELECT, DEFAULT_TOOL_LABEL);
        toolLabels.put(DungeonEditorTool.ROOM_PAINT, ROOM_PAINT_LABEL);
        toolLabels.put(DungeonEditorTool.ROOM_DELETE, ROOM_DELETE_LABEL);
        toolLabels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
        toolLabels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
        toolLabels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
        toolLabels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
        toolLabels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
        toolLabels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
        toolLabels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
        toolLabels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
        toolLabels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
        toolLabels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
        return Map.copyOf(toolLabels);
    }

    private static Map<String, DungeonEditorSessionValues.Tool> createSessionToolsByLabel() {
        Map<String, DungeonEditorSessionValues.Tool> toolsByLabel = new HashMap<>();
        toolsByLabel.put(DEFAULT_TOOL_LABEL, DungeonEditorSessionValues.Tool.SELECT);
        toolsByLabel.put(ROOM_PAINT_LABEL, DungeonEditorSessionValues.Tool.ROOM_PAINT);
        toolsByLabel.put(ROOM_DELETE_LABEL, DungeonEditorSessionValues.Tool.ROOM_DELETE);
        toolsByLabel.put("Wand setzen", DungeonEditorSessionValues.Tool.WALL_CREATE);
        toolsByLabel.put("Wand löschen", DungeonEditorSessionValues.Tool.WALL_DELETE);
        toolsByLabel.put("Tür setzen", DungeonEditorSessionValues.Tool.DOOR_CREATE);
        toolsByLabel.put("Tür löschen", DungeonEditorSessionValues.Tool.DOOR_DELETE);
        toolsByLabel.put("Korridor erstellen", DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
        toolsByLabel.put("Korridor löschen", DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
        toolsByLabel.put("Treppe erstellen", DungeonEditorSessionValues.Tool.STAIR_CREATE);
        toolsByLabel.put("Treppe löschen", DungeonEditorSessionValues.Tool.STAIR_DELETE);
        toolsByLabel.put("Übergang erstellen", DungeonEditorSessionValues.Tool.TRANSITION_CREATE);
        toolsByLabel.put("Übergang löschen", DungeonEditorSessionValues.Tool.TRANSITION_DELETE);
        return Map.copyOf(toolsByLabel);
    }

    private static Map<ToolFamily, ToolPalette> createPalettes() {
        Map<ToolFamily, ToolPalette> palettes = new EnumMap<>(ToolFamily.class);
        palettes.put(ToolFamily.ROOM, new ToolPalette(ROOM_PAINT_LABEL, ROOM_DELETE_LABEL));
        palettes.put(ToolFamily.WALL, new ToolPalette("Wand setzen", "Wand löschen"));
        palettes.put(ToolFamily.DOOR, new ToolPalette("Tür setzen", "Tür löschen"));
        palettes.put(ToolFamily.CORRIDOR, new ToolPalette("Korridor erstellen", "Korridor löschen"));
        palettes.put(ToolFamily.STAIR, new ToolPalette("Treppe erstellen", "Treppe löschen"));
        palettes.put(ToolFamily.TRANSITION, new ToolPalette("Übergang erstellen", "Übergang löschen"));
        return Map.copyOf(palettes);
    }
}

record ToolPalette(
        String primaryToolLabel,
        String secondaryToolLabel
) {
    ToolPalette {
        primaryToolLabel = primaryToolLabel == null ? "" : primaryToolLabel;
        secondaryToolLabel = secondaryToolLabel == null ? "" : secondaryToolLabel;
    }

    static ToolPalette empty() {
        return new ToolPalette("", "");
    }

    boolean available() {
        return !primaryToolLabel.isBlank() && !secondaryToolLabel.isBlank();
    }
}

final class LocalIds {
    private static final long NO_MAP_ID = 0L;
}
