package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.repository.DungeonDocumentRepository;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.entity.DungeonPrimitive;

import java.util.ArrayList;
import java.util.List;

/**
 * Loads the current committed dungeon snapshot.
 */
public final class LoadDungeonSnapshotUseCase {

    private final DungeonDocumentRepository store;
    private final BuildDungeonDerivedStateUseCase derive;
    private final MapDungeonFactsUseCase mapper = new MapDungeonFactsUseCase();

    public LoadDungeonSnapshotUseCase(DungeonDocumentRepository store, BuildDungeonDerivedStateUseCase derive) {
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
                mapper.toPublishedSnapshot(derived.map()),
                aggregateSummaries,
                relationSummaries,
                store.load().revision()
        );
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        DungeonDerivedState derived = derive.execute(store.load());
        for (DungeonAggregate aggregate : derived.aggregates()) {
            if (aggregate.id() == ownerId && ownerKind != null && ownerKind.equalsIgnoreCase(aggregate.kind().name())) {
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
