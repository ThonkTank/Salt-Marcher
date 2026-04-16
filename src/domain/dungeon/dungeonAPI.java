package src.domain.dungeon;

import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.usecase.DungeonDocumentStore;
import src.domain.dungeon.usecase.LoadDungeonSnapshotUseCase;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class dungeonAPI {

    private final LoadDungeonSnapshotUseCase loadSnapshotUseCase;
    private final ApplyDungeonEditorOperationUseCase applyOperationUseCase;

    public dungeonAPI() {
        DungeonDocumentStore store = DungeonDocumentStore.demo();
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        this.loadSnapshotUseCase = new LoadDungeonSnapshotUseCase(store, derive);
        this.applyOperationUseCase = new ApplyDungeonEditorOperationUseCase(store, derive);
    }

    public DungeonSnapshot loadSnapshot() {
        return loadSnapshotUseCase.execute();
    }

    public DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        return applyOperationUseCase.execute(operation);
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return loadSnapshotUseCase.describeSelection(ownerKind, ownerId);
    }
}
