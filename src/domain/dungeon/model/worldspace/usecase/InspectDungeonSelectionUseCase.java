package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.structure.DungeonMap;

/**
 * Builds dungeon inspector snapshots from authored truth and selection context.
 */
public final class InspectDungeonSelectionUseCase {

    private final BuildDungeonDerivedStateUseCase derive;
    private final BuildDungeonSelectionFactsUseCase selectionFacts;
    private final BuildDungeonRoomNarrationsUseCase roomNarrations;

    public InspectDungeonSelectionUseCase(BuildDungeonDerivedStateUseCase derive) {
        this(
                derive,
                new BuildDungeonSelectionFactsUseCase(),
                new BuildDungeonRoomNarrationsUseCase());
    }

    public InspectDungeonSelectionUseCase(
            BuildDungeonDerivedStateUseCase derive,
            BuildDungeonSelectionFactsUseCase selectionFacts,
            BuildDungeonRoomNarrationsUseCase roomNarrations
    ) {
        this.derive = Objects.requireNonNull(derive, "derive");
        this.selectionFacts = Objects.requireNonNull(selectionFacts, "selectionFacts");
        this.roomNarrations = Objects.requireNonNull(roomNarrations, "roomNarrations");
    }

    public LoadDungeonSnapshotUseCase.InspectorSnapshotData execute(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        DungeonTopologyRef safeRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        List<LoadDungeonSnapshotUseCase.RoomNarrationData> narrations = roomNarrations.execute(
                dungeonMap,
                derived,
                safeRef,
                clusterId,
                clusterSelection);
        LoadDungeonSnapshotUseCase.InspectorSnapshotData factsSnapshot = selectionFacts.execute(derived, safeRef);
        if (!narrations.isEmpty() && selectionFacts.isFallbackSelection(factsSnapshot)) {
            return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                    narrationTitle(narrations),
                    narrationDescription(narrations),
                    factsSnapshot.facts(),
                    narrations);
        }
        return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                factsSnapshot.title(),
                factsSnapshot.description(),
                factsSnapshot.facts(),
                narrations);
    }

    private static String narrationTitle(List<LoadDungeonSnapshotUseCase.RoomNarrationData> narrations) {
        return narrations.size() == 1 ? narrations.getFirst().roomName() : "Raumgruppe";
    }

    private static String narrationDescription(List<LoadDungeonSnapshotUseCase.RoomNarrationData> narrations) {
        return narrations.size() == 1
                ? "Raumbeschreibung"
                : "Raumbeschreibungen im ausgewählten Cluster";
    }
}
