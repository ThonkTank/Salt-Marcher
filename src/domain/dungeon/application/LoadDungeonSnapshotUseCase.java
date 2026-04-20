package src.domain.dungeon.application;

import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.entity.DungeonPrimitive;

import java.util.ArrayList;
import java.util.List;

/**
 * Loads the current committed dungeon snapshot.
 */
public final class LoadDungeonSnapshotUseCase {

    public record DungeonSnapshotData(
            String mapName,
            DungeonDerivedState derived,
            long revision
    ) {
    }

    public record InspectorSnapshotData(
            String title,
            String description,
            List<String> facts
    ) {
        public InspectorSnapshotData {
            facts = facts == null ? List.of() : List.copyOf(facts);
        }
    }

    private final DungeonDocumentRepository store;
    private final BuildDungeonDerivedStateUseCase derive;

    public LoadDungeonSnapshotUseCase(DungeonDocumentRepository store, BuildDungeonDerivedStateUseCase derive) {
        this.store = store;
        this.derive = derive;
    }

    public DungeonSnapshotData execute() {
        var document = store.load();
        return new DungeonSnapshotData(
                document.mapName(),
                derive.execute(document),
                document.revision());
    }

    public InspectorSnapshotData describeSelection(String ownerKind, long ownerId) {
        DungeonDerivedState derived = derive.execute(store.load());
        for (DungeonAggregate aggregate : derived.aggregates()) {
            if (aggregate.id() == ownerId && ownerKind != null && ownerKind.equalsIgnoreCase(aggregate.kind().name())) {
                return new InspectorSnapshotData(
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
                return new InspectorSnapshotData("Primitive " + ownerId, "Primitive boundary object.", facts);
            }
        }
        return new InspectorSnapshotData("Dungeon", "No selection details available.", List.of("selection: none"));
    }
}
