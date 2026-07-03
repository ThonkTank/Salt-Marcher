package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
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
                        safeTarget.targetKind(),
                        safeTarget.targetId(),
                        name)));
    }

    DungeonEditorRuntimeOperationResult saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                saveTransitionLinkUseCase.execute(new SaveDungeonEditorTransitionLinkUseCase.TransitionLinkInput(
                        sourceTransitionId,
                        targetMapId,
                        targetTransitionId,
                        bidirectional)));
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

    DungeonEditorRuntimeOperationResult saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                saveStairGeometryUseCase.execute(new SaveDungeonEditorStairGeometryUseCase.StairGeometryInput(
                        stairId,
                        shapeName,
                        directionName,
                        dimension1,
                        dimension2)));
    }
}
