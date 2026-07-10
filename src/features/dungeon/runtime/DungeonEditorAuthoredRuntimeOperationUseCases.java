package src.features.dungeon.runtime;

import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;

record DungeonEditorAuthoredRuntimeOperationUseCases(
        MapUseCases map,
        ProjectionUseCases projection,
        DungeonEditorRoomPaintRuntimeOperation roomPaint,
        DungeonEditorWallBoundaryDraftRuntimeOperation wallBoundaryDraft,
        DungeonEditorDoorBoundaryDraftRuntimeOperation doorBoundaryDraft,
        DungeonEditorCorridorDraftRuntimeOperation corridorDraft,
        DungeonEditorStairDraftRuntimeOperation stairDraft,
        DungeonEditorStairDeleteRuntimeOperation stairDelete,
        DungeonEditorTransitionRuntimeOperation transition,
        DungeonEditorFeatureMarkerRuntimeOperation featureMarker,
        DungeonEditorSelectedHandleRuntimeOperation selectedHandle,
        DetailUseCases detail
) {
    record MapUseCases(
            DungeonAuthoredApplicationService.RuntimeCommands commands
    ) {
    }

    record ProjectionUseCases(
            SetDungeonEditorViewModeUseCase setViewMode,
            SetDungeonEditorToolUseCase setTool,
            ShiftDungeonEditorProjectionLevelUseCase shiftLevel,
            SetDungeonEditorOverlayUseCase setOverlay
    ) {
    }

    record DetailUseCases(
            DungeonAuthoredApplicationService.RuntimeCommands commands
    ) {
    }
}
