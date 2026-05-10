package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;

public final class PublishDungeonAuthoredResultUseCase {

    private final PublishDungeonAuthoredSnapshotUseCase snapshotUseCase =
            new PublishDungeonAuthoredSnapshotUseCase();
    private final PublishDungeonAuthoredInspectorUseCase inspectorUseCase =
            new PublishDungeonAuthoredInspectorUseCase();

    public DungeonSnapshot committedSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return snapshotUseCase.snapshot(snapshot);
    }

    public DungeonInspectorSnapshot selectionInspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return inspectorUseCase.inspector(snapshot);
    }

    public DungeonOperationResult operationResult(ApplyDungeonEditorOperationUseCase.OperationResultData result) {
        return new DungeonOperationResult(
                committedSnapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages());
    }
}
