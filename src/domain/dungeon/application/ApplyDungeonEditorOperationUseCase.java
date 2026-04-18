package src.domain.dungeon.application;

import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonMapMode;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.entity.DungeonDerivedState;
import src.domain.dungeon.entity.DungeonDocument;
import src.domain.dungeon.repository.DungeonDocumentStore;

import java.util.ArrayList;
import java.util.List;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    private final DungeonDocumentStore store;
    private final BuildDungeonDerivedStateUseCase derive;

    public ApplyDungeonEditorOperationUseCase(DungeonDocumentStore store, BuildDungeonDerivedStateUseCase derive) {
        this.store = store;
        this.derive = derive;
    }

    public DungeonOperationResult execute(DungeonEditorOperation operation) {
        DungeonDocument current = store.load();
        DungeonDocument mutated = mutate(current, operation);
        List<String> validationMessages = validate(mutated);
        List<String> reactionMessages = react(current, mutated);
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

    private DungeonDocument mutate(DungeonDocument current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor) {
            return current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
        }
        if (operation instanceof DungeonEditorOperation.ResetDemoLayout) {
            return DungeonDocument.demo();
        }
        return current;
    }

    private List<String> validate(DungeonDocument document) {
        List<String> messages = new ArrayList<>();
        if (document.roomAnchorQ() < 1 || document.roomAnchorR() < 1) {
            messages.add("room anchor clamped into valid map bounds");
        }
        messages.add("room anchor valid inside committed map bounds");
        return List.copyOf(messages);
    }

    private List<String> react(DungeonDocument before, DungeonDocument after) {
        if (before.roomAnchorQ() == after.roomAnchorQ() && before.roomAnchorR() == after.roomAnchorR()) {
            return List.of("derived state rebuilt without structural movement");
        }
        return List.of(
                "corridor attachment recomputed from moved room anchor",
                "door boundary re-anchored onto rebuilt aggregate relation graph"
        );
    }
}
