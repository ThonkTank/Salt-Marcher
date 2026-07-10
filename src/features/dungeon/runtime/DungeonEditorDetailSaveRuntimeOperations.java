package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import java.util.OptionalInt;
import src.domain.dungeon.DungeonAuthoredApplicationService;

final class DungeonEditorDetailSaveRuntimeOperations {
    private final DungeonAuthoredApplicationService.RuntimeCommands commands;

    DungeonEditorDetailSaveRuntimeOperations(DungeonEditorAuthoredRuntimeOperationUseCases.DetailUseCases useCases) {
        DungeonEditorAuthoredRuntimeOperationUseCases.DetailUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        commands = Objects.requireNonNull(safeUseCases.commands(), "commands");
    }

    DungeonEditorRuntimeOperationResult saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", List.of()) : narration;
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                commands.saveRoomNarration(new DungeonAuthoredApplicationService.RoomNarrationInput(
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
                commands.saveLabelName(new DungeonAuthoredApplicationService.LabelNameInput(
                        labelTargetKind(safeTarget),
                        safeTarget.targetId(),
                        name)));
    }

    private static DungeonAuthoredApplicationService.LabelTargetKind labelTargetKind(
            DungeonEditorRuntimeLabelTarget target
    ) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        return switch (safeTarget.kind()) {
            case ROOM -> DungeonAuthoredApplicationService.LabelTargetKind.ROOM;
            case CLUSTER -> DungeonAuthoredApplicationService.LabelTargetKind.CLUSTER;
            case EMPTY -> DungeonAuthoredApplicationService.LabelTargetKind.EMPTY;
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
                commands.saveTransitionLink(new DungeonAuthoredApplicationService.TransitionLinkInput(
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
                commands.saveTransitionDescription(
                        new DungeonAuthoredApplicationService.TransitionDescriptionInput(
                                transitionId,
                                description)));
    }

    DungeonEditorRuntimeOperationResult saveStairGeometry(StairGeometryDraftInput input) {
        StairGeometryDraftInput safeInput = input == null ? StairGeometryDraftInput.empty() : input;
        OptionalInt dimension1 = safeInput.dimension1Value();
        OptionalInt dimension2 = safeInput.dimension2Value();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                commands.saveStairGeometry(new DungeonAuthoredApplicationService.StairGeometryInput(
                        safeInput.stairId(),
                        safeInput.shapeName(),
                        safeInput.directionName(),
                        dimension1.orElse(0),
                        dimension2.orElse(0))));
    }
}
