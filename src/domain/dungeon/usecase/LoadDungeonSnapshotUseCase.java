package src.domain.dungeon.usecase;

import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonMapMode;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.entity.DungeonAggregate;
import src.domain.dungeon.entity.DungeonDerivedState;
import src.domain.dungeon.entity.DungeonPrimitive;

import java.util.ArrayList;
import java.util.List;

/**
 * Loads the current committed dungeon snapshot.
 */
public final class LoadDungeonSnapshotUseCase {

    private final DungeonDocumentStore store;
    private final BuildDungeonDerivedStateUseCase derive;

    public LoadDungeonSnapshotUseCase(DungeonDocumentStore store, BuildDungeonDerivedStateUseCase derive) {
        this.store = store;
        this.derive = derive;
    }

    public DungeonSnapshot execute() {
        DungeonDerivedState derived = derive.execute(store.load());
        List<String> aggregateSummaries = derived.aggregates().stream()
                .map(this::aggregateSummary)
                .toList();
        List<String> relationSummaries = derived.relations().connections().stream()
                .map(connection -> "corridor " + connection.corridorId() + " -> room " + connection.roomId() + " (" + connection.direction() + ")")
                .toList();
        return new DungeonSnapshot(
                store.load().mapName(),
                DungeonMapMode.EDITOR,
                derived.surface(),
                aggregateSummaries,
                relationSummaries,
                store.load().revision()
        );
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        DungeonDerivedState derived = derive.execute(store.load());
        for (DungeonAggregate aggregate : derived.aggregates()) {
            if (aggregate.id() == ownerId && ownerKind != null && ownerKind.equalsIgnoreCase(aggregate.label().contains("Corridor") ? "corridor" : "room")) {
                return new DungeonInspectorSnapshot(
                        aggregate.label(),
                        "Aggregate owner in committed dungeon truth.",
                        List.of(
                                "id: " + aggregate.id(),
                                "kind: " + ownerKind,
                                "label: " + aggregate.label()
                        )
                );
            }
        }
        for (DungeonPrimitive primitive : derived.primitives()) {
            if (primitive.id() == ownerId) {
                List<String> facts = new ArrayList<>();
                facts.add("id: " + primitive.id());
                facts.add("kind: " + ownerKind);
                return new DungeonInspectorSnapshot("Primitive " + ownerId, "Primitive boundary object.", facts);
            }
        }
        return new DungeonInspectorSnapshot("Dungeon", "No selection details available.", List.of("selection: none"));
    }

    private String aggregateSummary(DungeonAggregate aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
