package src.view.slotcontent.main.dungeonmap;

import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.MapSurfaceFrame;

final class DungeonMapFrameProjector {
    private final DungeonMapRoomLabelPlanner roomLabelPlanner = new DungeonMapRoomLabelPlanner();
    private final DungeonMapEditorRenderProjector editorRenderProjector =
            new DungeonMapEditorRenderProjector(roomLabelPlanner);
    private final DungeonMapTravelRenderProjector travelRenderProjector =
            new DungeonMapTravelRenderProjector(roomLabelPlanner);

    DungeonMapRenderState mapEditorSurface(
            String placeholderTitle,
            MapSurfaceFrame frame,
            DungeonMapContentModel.MapInteractionFrame interactionFrame
    ) {
        MapSurfaceFrame safeFrame = frame == null
                ? MapSurfaceFrame.empty()
                : frame;
        DungeonMapRenderState baseState = editorRenderProjector.project(
                placeholderTitle,
                safeFrame.surface(),
                safeFrame.selection(),
                safeFrame.previewRender(),
                safeFrame.previewRenderDiff(),
                interactionFrame,
                true);
        return baseState.withViewMode(
                        DungeonMapRenderState.ViewMode.fromEditor(safeFrame.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeFrame.overlaySettings()))
                .withProjectionLevel(safeFrame.projectionLevel())
                .withSelectedTool(toolLabel(safeFrame.selectedTool()));
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
