package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorMapSummary;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorSurface;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;

record DungeonEditorProjectionSource(
        List<DungeonEditorMapSelection> maps,
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
    DungeonEditorProjectionSource {
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

    static DungeonEditorProjectionSource from(@Nullable DungeonEditorSnapshot snapshot) {
        DungeonEditorSnapshot safeSnapshot = snapshot == null ? DungeonEditorSnapshot.empty("") : snapshot;
        DungeonEditorSurface surface = safeSnapshot.surface();
        return new DungeonEditorProjectionSource(
                safeSnapshot.maps().stream().map(DungeonEditorProjectionSource::toMapSelection).toList(),
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

    static DungeonEditorProjectionSource empty() {
        return from(DungeonEditorSnapshot.empty(""));
    }

    private static DungeonEditorMapSelection toMapSelection(@Nullable DungeonEditorMapSummary summary) {
        DungeonEditorMapSummary safeSummary = summary == null
                ? new DungeonEditorMapSummary(new DungeonEditorMapId(1L), "Dungeon Map", 0L)
                : summary;
        return new DungeonEditorMapSelection(
                DungeonEditorMapSelection.keyOf(safeSummary.mapId()),
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
