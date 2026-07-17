package features.dungeon.adapter.javafx.map;

import features.dungeon.api.DungeonEditorTool;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.api.editor.DungeonEditorState;

final class DungeonMapFrameProjector {
    private final DungeonMapRoomLabelPlanner roomLabelPlanner = new DungeonMapRoomLabelPlanner();
    private final DungeonMapEditorRenderProjector editorRenderProjector =
            new DungeonMapEditorRenderProjector(roomLabelPlanner);
    private final DungeonMapTravelRenderProjector travelRenderProjector =
            new DungeonMapTravelRenderProjector(roomLabelPlanner);

    DungeonMapRenderState mapEditorSurface(
            String placeholderTitle,
            DungeonEditorState state
    ) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        DungeonMapRenderState baseState = editorRenderProjector.project(
                placeholderTitle,
                safeState.selectedWindow(),
                safeState.selection(),
                safeState.preview(),
                DungeonMapPreviewModel.renderFrame(safeState.preview()),
                DungeonMapPreviewModel.diffFrame(safeState),
                true);
        return baseState.withViewMode(
                        DungeonMapRenderState.ViewMode.fromEditor(safeState.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeState.overlaySettings()))
                .withProjectionLevel(safeState.projectionLevel())
                .withSelectedTool(toolLabel(safeState.selectedTool()));
    }

    DungeonMapRenderState mapTravel(
            String placeholderTitle,
            TravelDungeonSnapshot snapshot
    ) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = travelRenderProjector.project(
                placeholderTitle,
                safeSnapshot.travelSurface());
        return baseState.withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(DungeonMapRenderState.selectToolLabel());
    }

    private static DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            DungeonOverlaySettings overlaySettings
    ) {
        DungeonOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return DungeonEditorTool.labelFor(selectedTool);
    }
}
