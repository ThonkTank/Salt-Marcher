package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionLinkUseCase;
import src.domain.dungeon.model.runtime.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;

record DungeonEditorAuthoredRuntimeOperationUseCases(
        MapUseCases map,
        ProjectionUseCases projection,
        ApplyDungeonEditorToolWorkflowUseCase toolWorkflow,
        DungeonEditorWallBoundaryDraftRuntimeOperation wallBoundaryDraft,
        DungeonEditorDoorBoundaryDraftRuntimeOperation doorBoundaryDraft,
        DungeonEditorCorridorDraftRuntimeOperation corridorDraft,
        DungeonEditorStairDraftRuntimeOperation stairDraft,
        DungeonEditorSelectedHandleRuntimeOperation selectedHandle,
        DetailUseCases detail
) {
    record MapUseCases(
            SelectDungeonEditorMapUseCase select,
            CreateDungeonEditorMapUseCase create,
            RenameDungeonEditorMapUseCase rename,
            DeleteDungeonEditorMapUseCase delete
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
            SaveDungeonEditorRoomNarrationUseCase saveRoomNarration,
            SaveDungeonEditorLabelNameUseCase saveLabelName,
            SaveDungeonEditorTransitionDescriptionUseCase saveTransitionDescription,
            SaveDungeonEditorTransitionLinkUseCase saveTransitionLink,
            SaveDungeonEditorStairGeometryUseCase saveStairGeometry
    ) {
    }
}
