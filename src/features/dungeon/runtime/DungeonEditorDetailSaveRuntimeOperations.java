package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import java.util.OptionalInt;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionLinkUseCase;

final class DungeonEditorDetailSaveRuntimeOperations {
    private final SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase;
    private final SaveDungeonEditorLabelNameUseCase saveLabelNameUseCase;
    private final SaveDungeonEditorTransitionDescriptionUseCase saveTransitionDescriptionUseCase;
    private final SaveDungeonEditorTransitionLinkUseCase saveTransitionLinkUseCase;
    private final SaveDungeonEditorStairGeometryUseCase saveStairGeometryUseCase;

    DungeonEditorDetailSaveRuntimeOperations(DungeonEditorAuthoredRuntimeOperationUseCases.DetailUseCases useCases) {
        DungeonEditorAuthoredRuntimeOperationUseCases.DetailUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        saveRoomNarrationUseCase = Objects.requireNonNull(
                safeUseCases.saveRoomNarration(),
                "saveRoomNarrationUseCase");
        saveLabelNameUseCase = Objects.requireNonNull(
                safeUseCases.saveLabelName(),
                "saveLabelNameUseCase");
        saveTransitionDescriptionUseCase = Objects.requireNonNull(
                safeUseCases.saveTransitionDescription(),
                "saveTransitionDescriptionUseCase");
        saveTransitionLinkUseCase = Objects.requireNonNull(
                safeUseCases.saveTransitionLink(),
                "saveTransitionLinkUseCase");
        saveStairGeometryUseCase = Objects.requireNonNull(
                safeUseCases.saveStairGeometry(),
                "saveStairGeometryUseCase");
    }

    DungeonEditorRuntimeOperationResult saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", List.of()) : narration;
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                saveRoomNarrationUseCase.execute(new SaveDungeonEditorRoomNarrationUseCase.RoomNarrationInput(
                        safeNarration.roomId(),
                        safeNarration.visualDescription(),
                        DungeonEditorRuntimeInputTranslator.exitInputs(safeNarration))));
    }

    DungeonEditorRuntimeOperationResult saveLabelName(
            DungeonEditorRuntimeLabelTarget target,
            String name
    ) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                saveLabelNameUseCase.execute(new SaveDungeonEditorLabelNameUseCase.LabelNameInput(
                        labelTargetKind(safeTarget),
                        safeTarget.targetId(),
                        name)));
    }

    private static SaveDungeonEditorLabelNameUseCase.TargetKind labelTargetKind(
            DungeonEditorRuntimeLabelTarget target
    ) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        return switch (safeTarget.kind()) {
            case ROOM -> SaveDungeonEditorLabelNameUseCase.TargetKind.ROOM;
            case CLUSTER -> SaveDungeonEditorLabelNameUseCase.TargetKind.CLUSTER;
            case EMPTY -> SaveDungeonEditorLabelNameUseCase.TargetKind.EMPTY;
        };
    }

    DungeonEditorRuntimeOperationResult saveTransitionLink(
            long sourceTransitionId,
            TransitionDestinationDraftInput input
    ) {
        TransitionDestinationDraftInput safeInput = input == null
                ? TransitionDestinationDraftInput.unlinkedEntrance()
                : input;
        return DungeonEditorRuntimeResultTranslator.fromOperationResult(
                saveTransitionLinkUseCase.execute(new SaveDungeonEditorTransitionLinkUseCase.TransitionLinkInput(
                        sourceTransitionId,
                        safeInput.targetMapId(),
                        safeInput.targetTransitionId(),
                        safeInput.bidirectional())));
    }

    DungeonEditorRuntimeOperationResult saveTransitionDescription(
            long transitionId,
            String description
    ) {
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                saveTransitionDescriptionUseCase.execute(
                        new SaveDungeonEditorTransitionDescriptionUseCase.TransitionDescriptionInput(
                                transitionId,
                                description)));
    }

    DungeonEditorRuntimeOperationResult saveStairGeometry(StairGeometryDraftInput input) {
        StairGeometryDraftInput safeInput = input == null ? StairGeometryDraftInput.empty() : input;
        OptionalInt dimension1 = safeInput.dimension1Value();
        OptionalInt dimension2 = safeInput.dimension2Value();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                saveStairGeometryUseCase.execute(new SaveDungeonEditorStairGeometryUseCase.StairGeometryInput(
                        safeInput.stairId(),
                        safeInput.shapeName(),
                        safeInput.directionName(),
                        dimension1.orElse(0),
                        dimension2.orElse(0))));
    }
}
