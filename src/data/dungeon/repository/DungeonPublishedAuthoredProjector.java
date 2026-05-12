package src.data.dungeon.repository;

import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.model.DungeonState;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;

final class DungeonPublishedAuthoredProjector {

    private final DungeonPublishedMapSnapshotProjector mapProjector;

    DungeonPublishedAuthoredProjector(DungeonPublishedMapSnapshotProjector mapProjector) {
        this.mapProjector = mapProjector;
    }

    DungeonAuthoredReadResult snapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonAuthoredReadResult.CommittedSnapshot(dungeonSnapshot(snapshot));
    }

    DungeonAuthoredReadResult inspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return new DungeonAuthoredReadResult.SelectionInspector(inspectorSnapshot(snapshot));
    }

    DungeonAuthoredMutationResult mutation(ApplyDungeonEditorOperationUseCase.OperationResultData result) {
        return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                dungeonSnapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages()));
    }

    private DungeonSnapshot dungeonSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonSnapshot(
                snapshot.mapName(),
                DungeonMapMode.EDITOR,
                mapProjector.snapshot(snapshot.derived().map(), snapshot.editorHandles()),
                snapshot.derived().aggregates().stream().map(DungeonPublishedAuthoredProjector::aggregateSummary).toList(),
                snapshot.derived().relations().summaries(),
                DungeonPublishedStateValues.revision(snapshot.revision()));
    }

    private static DungeonInspectorSnapshot inspectorSnapshot(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return new DungeonInspectorSnapshot(
                snapshot.title(),
                snapshot.description(),
                snapshot.facts(),
                snapshot.roomNarrations().stream()
                        .map(roomNarration -> new DungeonInspectorSnapshot.RoomNarrationCard(
                                roomNarration.roomId(),
                                roomNarration.roomName(),
                                roomNarration.visualDescription(),
                                roomNarration.exits().stream()
                                        .map(exit -> new DungeonInspectorSnapshot.RoomExitNarration(
                                                exit.label(),
                                                DungeonPublishedStateValues.cell(exit.cell()),
                                                exit.direction().name(),
                                                exit.description()))
                                        .toList()))
                        .toList());
    }

    private static String aggregateSummary(DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
