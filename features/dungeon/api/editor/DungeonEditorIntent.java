package features.dungeon.api.editor;

import features.dungeon.api.DungeonEditorTool;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.DungeonOverlaySettings;

/** Typed editor inputs introduced ahead of the JavaFX consumer migration. */
public sealed interface DungeonEditorIntent {

    record SelectMap(DungeonMapId mapId) implements DungeonEditorIntent {
        public SelectMap {
            if (mapId == null) {
                throw new IllegalArgumentException("mapId is required");
            }
        }
    }

    record CreateMap(String mapName) implements DungeonEditorIntent {
        public CreateMap {
            mapName = cleanName(mapName);
        }
    }

    record RenameMap(DungeonMapId mapId, String mapName) implements DungeonEditorIntent {
        public RenameMap {
            if (mapId == null) {
                throw new IllegalArgumentException("mapId is required");
            }
            mapName = cleanName(mapName);
        }
    }

    record DeleteMap(DungeonMapId mapId) implements DungeonEditorIntent {
        public DeleteMap {
            if (mapId == null) {
                throw new IllegalArgumentException("mapId is required");
            }
        }
    }

    record SetViewMode(DungeonEditorViewMode viewMode) implements DungeonEditorIntent {
        public SetViewMode {
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        }
    }

    record SetTool(DungeonEditorTool tool) implements DungeonEditorIntent {
        public SetTool {
            tool = tool == null ? DungeonEditorTool.SELECT : tool;
        }
    }

    record ShiftProjectionLevel(int levelShift) implements DungeonEditorIntent {
    }

    record SetOverlay(DungeonOverlaySettings overlaySettings) implements DungeonEditorIntent {
        public SetOverlay {
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        }
    }

    record ScrollSelection(int levelDelta) implements DungeonEditorIntent {
    }

    enum CancelPreview implements DungeonEditorIntent {
        INSTANCE
    }

    enum Undo implements DungeonEditorIntent {
        INSTANCE
    }

    enum Redo implements DungeonEditorIntent {
        INSTANCE
    }

    private static String cleanName(String mapName) {
        if (mapName == null || mapName.isBlank()) {
            throw new IllegalArgumentException("mapName is required");
        }
        return mapName.strip();
    }
}
