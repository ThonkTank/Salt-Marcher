package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.map.repository.DungeonDocumentRepository;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonDocument;

import java.util.List;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    private final DungeonDocumentRepository store;
    private final BuildDungeonDerivedStateUseCase derive;
    private final MapDungeonFactsUseCase mapper = new MapDungeonFactsUseCase();

    public ApplyDungeonEditorOperationUseCase(DungeonDocumentRepository store, BuildDungeonDerivedStateUseCase derive) {
        this.store = store;
        this.derive = derive;
    }

    public DungeonOperationResult execute(DungeonEditorOperation operation) {
        DungeonDocument current = store.load();
        DungeonDocument mutated = apply(current, operation);
        List<String> validationMessages = mutated.validationMessages();
        List<String> reactionMessages = current.reactionMessages(mutated);
        DungeonDerivedState derived = derive.execute(mutated);
        store.save(mutated);
        DungeonSnapshot snapshot = new DungeonSnapshot(
                mutated.mapName(),
                DungeonMapMode.EDITOR,
                mapper.toPublishedSnapshot(derived.map()),
                derived.aggregates().stream().map(aggregate -> aggregate.label() + " #" + aggregate.id()).toList(),
                derived.relations().connections().stream()
                        .map(connection -> "corridor " + connection.corridorId() + " -> room " + connection.roomId() + " (" + connection.direction() + ")")
                        .toList(),
                mutated.revision()
        );
        return new DungeonOperationResult(snapshot, validationMessages, reactionMessages);
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
