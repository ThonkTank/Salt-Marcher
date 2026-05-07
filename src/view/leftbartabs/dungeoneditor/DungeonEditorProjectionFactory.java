package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.domain.dungeoneditor.published.DungeonEditorSurface;

final class DungeonEditorProjectionFactory {

    private static final String NO_MAPS_STATUS = "Keine Dungeon-Maps vorhanden.";
    private static final String NO_SELECTED_MAP_STATUS = "Kein Dungeon ausgewählt.";

    private DungeonEditorProjectionFactory() {
    }

    static DungeonEditorProjectionBundle create(
            DungeonEditorProjectionSource source,
            DungeonEditorLocalState localState
    ) {
        DungeonEditorProjectionSource safeSource = source == null ? DungeonEditorProjectionSource.empty() : source;
        DungeonEditorLocalState safeLocalState = localState == null ? DungeonEditorLocalState.initial() : localState;
        List<DungeonEditorMapListEntry> mapEntries = safeSource.maps().stream().map(DungeonEditorMapListEntry::from).toList();
        List<Integer> reachableLevels = levelsFrom(safeSource.surface(), safeSource.projectionLevel());
        int clampedProjectionLevel = clampProjectionLevel(reachableLevels, safeSource.projectionLevel());
        DungeonEditorOverlayProjection overlayProjection = DungeonEditorOverlayProjection.from(safeSource.overlaySettings());
        String selectedMapKey = DungeonEditorMapSelection.keyOf(safeSource.selectedMapId());
        String viewModeLabel = DungeonEditorToolCatalog.labelOf(safeSource.viewMode());
        String selectedToolLabel = DungeonEditorToolCatalog.labelOf(safeSource.selectedTool());
        String statusText = statusTextFor(safeSource, mapEntries);
        DungeonEditorMapEditorUiState mapEditorUiState =
                synchronizeMapEditorUiState(safeLocalState.mapEditorUiState(), mapEntries);
        DungeonEditorToolPaletteUiState toolPaletteUiState = safeLocalState.toolPaletteUiState();
        List<DungeonEditorRoomNarrationCardProjection> narrationCards = toNarrationCards(safeSource.inspector());
        DungeonEditorControlsProjection controlsProjection = new DungeonEditorControlsProjection(
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
                toolPaletteUiState);
        DungeonEditorStateProjection stateProjection = new DungeonEditorStateProjection(
                stateTextFor(safeSource, overlayProjection, selectedToolLabel, viewModeLabel, clampedProjectionLevel),
                statusText,
                false,
                narrationCards);
        long selectedMapIdValue = safeSource.selectedMapId() == null
                ? DungeonEditorInteractionState.NO_MAP_ID
                : safeSource.selectedMapId().value();
        DungeonEditorMapListEntry currentSelectedMapEntry = findMapEntry(mapEntries, selectedMapIdValue);
        DungeonEditorInteractionState interactionState = new DungeonEditorInteractionState(
                selectedMapIdValue,
                currentSelectedMapEntry,
                viewModeLabel,
                selectedToolLabel,
                overlayProjection,
                mapEditorUiState,
                mapEntries);
        return new DungeonEditorProjectionBundle(
                controlsProjection,
                stateProjection,
                interactionState,
                new DungeonEditorLocalState(mapEditorUiState, toolPaletteUiState));
    }

    private static int clampProjectionLevel(List<Integer> reachableLevels, int projectionLevel) {
        if (reachableLevels == null || reachableLevels.isEmpty()) {
            return Math.max(0, projectionLevel);
        }
        return Math.max(reachableLevels.getFirst(), Math.min(reachableLevels.getLast(), projectionLevel));
    }

    private static String stateTextFor(
            DungeonEditorProjectionSource source,
            DungeonEditorOverlayProjection overlayProjection,
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

    private static String selectionTextFor(
            DungeonEditorProjectionSource.SelectionData selection,
            @Nullable DungeonEditorInspectorSnapshot inspector
    ) {
        if ("EMPTY".equals(selection.kind())) {
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
                    + (roomRectangle.deleteMode() ? "Raum löschen" : "Raum malen")
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

    private static String statusTextFor(
            DungeonEditorProjectionSource source,
            List<DungeonEditorMapListEntry> mapEntries
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

    private static List<Integer> levelsFrom(@Nullable DungeonEditorSurface surface, int fallbackLevel) {
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

    private static DungeonEditorMapEditorUiState synchronizeMapEditorUiState(
            DungeonEditorMapEditorUiState mapEditorUiState,
            List<DungeonEditorMapListEntry> mapEntries
    ) {
        DungeonEditorMapEditorUiState safeState =
                mapEditorUiState == null ? DungeonEditorMapEditorUiState.hidden() : mapEditorUiState;
        if (!safeState.visible() || !safeState.targetsExistingMap()) {
            return safeState;
        }
        return findMapEntry(mapEntries, safeState.mapIdValue()) == null
                ? DungeonEditorMapEditorUiState.hidden()
                : safeState;
    }

    private static @Nullable DungeonEditorMapListEntry findMapEntry(
            List<DungeonEditorMapListEntry> mapEntries,
            long mapIdValue
    ) {
        if (mapIdValue <= DungeonEditorInteractionState.NO_MAP_ID) {
            return null;
        }
        return mapEntries.stream()
                .filter(entry -> entry.matchesId(mapIdValue))
                .findFirst()
                .orElse(null);
    }

    private static List<DungeonEditorRoomNarrationCardProjection> toNarrationCards(
            @Nullable DungeonEditorInspectorSnapshot inspector
    ) {
        if (inspector == null) {
            return List.of();
        }
        return inspector.roomNarrations().stream()
                .map(card -> new DungeonEditorRoomNarrationCardProjection(
                        card.roomId(),
                        card.roomName(),
                        card.visualDescription(),
                        card.exits().stream()
                                .map(exit -> new DungeonEditorRoomExitNarrationProjection(
                                        exit.label(),
                                        exit.cell().q(),
                                        exit.cell().r(),
                                        exit.cell().level(),
                                        exit.direction(),
                                        exit.description()))
                                .toList()))
                .toList();
    }
}

record DungeonEditorProjectionBundle(
        DungeonEditorControlsProjection controlsProjection,
        DungeonEditorStateProjection stateProjection,
        DungeonEditorInteractionState interactionState,
        DungeonEditorLocalState localState
) {
}
