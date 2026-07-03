package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorRuntimeControlValues {
    private DungeonEditorRuntimeControlValues() {
    }

    static DungeonMapId mapId(DungeonEditorWorkspaceValues.MapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
    }

    static DungeonEditorViewMode viewMode(DungeonEditorSessionValues.ViewMode viewMode) {
        return viewMode != null && "GRAPH".equals(viewMode.name())
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    static DungeonEditorTool tool(DungeonEditorSessionValues.Tool tool) {
        return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
    }

    static DungeonOverlaySettings overlay(DungeonEditorSessionValues.OverlaySettings overlay) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }
}
