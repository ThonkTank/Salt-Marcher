package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase;

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
        if (clusterSelection && clusterId > 0L) {
            return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                    clusterName(dungeonMap, clusterId),
                    narrationDescription(narrations),
                    factsSnapshot.facts(),
                    narrations);
        }
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

    private static String clusterName(DungeonMap dungeonMap, long clusterId) {
        if (dungeonMap == null) {
            return "Cluster " + clusterId;
        }
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                return cluster.name();
            }
        }
        return "Cluster " + clusterId;
    }
}
