package src.domain.dungeon.application;

import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;

public final class DungeonAuthoredProjector {

    private DungeonAuthoredProjector() {
    }

    public static DungeonSnapshot committedSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonSnapshot(
                snapshot.mapName(),
                DungeonMapMode.EDITOR,
                DungeonMapProjector.snapshot(snapshot.derived().map(), snapshot.editorHandles()),
                snapshot.derived().aggregates().stream().map(DungeonAuthoredProjector::aggregateSummary).toList(),
                snapshot.derived().relations().summaries(),
                DungeonIdentityBoundaryTranslator.revision(snapshot.revision()));
    }

    public static DungeonInspectorSnapshot selectionInspector(
            LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot
    ) {
        return new DungeonInspectorSnapshot(
                snapshot.title(),
                snapshot.description(),
                snapshot.facts(),
                snapshot.roomNarrations().stream().map(DungeonAuthoredProjector::roomNarration).toList());
    }

    public static DungeonOperationResult operationResult(
            ApplyDungeonEditorOperationUseCase.OperationResultData result
    ) {
        return new DungeonOperationResult(
                committedSnapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages());
    }

    private static DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
            LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
    ) {
        return new DungeonInspectorSnapshot.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomNarration.exits().stream().map(DungeonAuthoredProjector::exitNarration).toList());
    }

    private static DungeonInspectorSnapshot.RoomExitNarration exitNarration(
            LoadDungeonSnapshotUseCase.RoomExitNarrationData exitNarration
    ) {
        return new DungeonInspectorSnapshot.RoomExitNarration(
                exitNarration.label(),
                DungeonCellEdgeBoundaryTranslator.cell(exitNarration.cell()),
                exitNarration.direction().name(),
                exitNarration.description());
    }

    private static String aggregateSummary(DungeonAggregate aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
