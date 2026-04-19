package src.domain.dungeon.application;

import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonMapMode;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.map.DungeonDerivedState;
import src.domain.dungeon.map.DungeonDocument;

import java.util.List;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
final class ApplyDungeonEditorOperationUseCase {

    private final DungeonDocumentStore store;
    private final BuildDungeonDerivedStateUseCase derive;

    ApplyDungeonEditorOperationUseCase(DungeonDocumentStore store, BuildDungeonDerivedStateUseCase derive) {
        this.store = store;
        this.derive = derive;
    }

    DungeonOperationResult execute(DungeonEditorOperation operation) {
        DungeonDocument current = store.load();
        DungeonDocument mutated = current.apply(operation);
        List<String> validationMessages = mutated.validationMessages();
        List<String> reactionMessages = current.reactionMessages(mutated);
        DungeonDerivedState derived = derive.execute(mutated);
        store.save(mutated);
        DungeonSnapshot snapshot = new DungeonSnapshot(
                mutated.mapName(),
                DungeonMapMode.EDITOR,
                derived.surface(),
                derived.aggregates().stream().map(aggregate -> aggregate.label() + " #" + aggregate.id()).toList(),
                derived.relations().connections().stream()
                        .map(connection -> "corridor " + connection.corridorId() + " -> room " + connection.roomId() + " (" + connection.direction() + ")")
                        .toList(),
                mutated.revision()
        );
        return new DungeonOperationResult(snapshot, validationMessages, reactionMessages);
    }
}
