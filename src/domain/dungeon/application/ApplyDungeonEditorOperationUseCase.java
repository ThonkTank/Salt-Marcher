package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonDerivedState;

import java.util.List;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    public sealed interface OperationInput permits
            OperationInput.MoveRoomAnchor,
            OperationInput.ResetDemoLayout,
            OperationInput.NoChange {

        record MoveRoomAnchor(int deltaQ, int deltaR) implements OperationInput {
        }

        record ResetDemoLayout() implements OperationInput {
        }

        record NoChange() implements OperationInput {
        }
    }

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

    private final DungeonMapRepository repository;
    private final DungeonMapSearch search;
    private final BuildDungeonDerivedStateUseCase derive;

    public ApplyDungeonEditorOperationUseCase(
            DungeonMapRepository repository,
            DungeonMapSearch search,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.search = search;
        this.derive = derive;
    }

    public OperationResultData execute(OperationInput operation) {
        DungeonMap current = search.firstMap()
                .orElseGet(() -> DungeonMap.empty(repository.nextMapId(), "Dungeon Bastion"));
        DungeonMap mutated = apply(current, operation);
        List<String> validationMessages = mutated.validationMessages();
        List<String> reactionMessages = current.reactionMessages(mutated);
        DungeonDerivedState derived = derive.execute(mutated);
        repository.save(mutated);
        var snapshot = new LoadDungeonSnapshotUseCase.DungeonSnapshotData(
                mutated.metadata().mapName(),
                derived,
                mutated.revision());
        return new OperationResultData(snapshot, validationMessages, reactionMessages);
    }

    private DungeonMap apply(DungeonMap current, OperationInput operation) {
        if (operation instanceof OperationInput.MoveRoomAnchor moveRoomAnchor) {
            return current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
        }
        if (operation instanceof OperationInput.ResetDemoLayout) {
            return current.resetDemoLayout();
        }
        return current;
    }
}
