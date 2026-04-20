package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonDocument;

import java.util.List;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    public record OperationResultData(
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        public OperationResultData {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }
    }

    private final DungeonDocumentRepository store;
    private final BuildDungeonDerivedStateUseCase derive;

    public ApplyDungeonEditorOperationUseCase(DungeonDocumentRepository store, BuildDungeonDerivedStateUseCase derive) {
        this.store = store;
        this.derive = derive;
    }

    public OperationResultData execute(DungeonEditorOperation operation) {
        DungeonDocument current = store.load();
        DungeonDocument mutated = apply(current, operation);
        List<String> validationMessages = mutated.validationMessages();
        List<String> reactionMessages = current.reactionMessages(mutated);
        DungeonDerivedState derived = derive.execute(mutated);
        store.save(mutated);
        var snapshot = new LoadDungeonSnapshotUseCase.DungeonSnapshotData(
                mutated.mapName(),
                derived,
                mutated.revision());
        return new OperationResultData(snapshot, validationMessages, reactionMessages);
    }

    private DungeonDocument apply(DungeonDocument current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor) {
            return current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
        }
        if (operation instanceof DungeonEditorOperation.ResetDemoLayout) {
            return DungeonDocument.demo();
        }
        return current;
    }
}
