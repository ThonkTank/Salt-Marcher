package features.dungeon.application.editor.usecase;

import java.util.List;
import java.util.Objects;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.DungeonRoomCluster;

/**
 * Builds dungeon inspector snapshots from authored truth and selection context.
 */
public final class InspectDungeonSelectionUseCase {

    private final BuildDungeonSelectionFactsUseCase selectionFacts;
    private final BuildDungeonRoomNarrationsUseCase roomNarrations;

    public InspectDungeonSelectionUseCase() {
        this(
                new BuildDungeonSelectionFactsUseCase(),
                new BuildDungeonRoomNarrationsUseCase());
    }

    public InspectDungeonSelectionUseCase(
            BuildDungeonSelectionFactsUseCase selectionFacts,
            BuildDungeonRoomNarrationsUseCase roomNarrations
    ) {
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
                    factsSnapshot.statePanelFacts(),
                    narrations);
        }
        if (!narrations.isEmpty() && selectionFacts.isFallbackSelection(factsSnapshot)) {
            return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                    narrationTitle(narrations),
                    narrationDescription(narrations),
                    factsSnapshot.facts(),
                    factsSnapshot.statePanelFacts(),
                    narrations);
        }
        return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                factsSnapshot.title(),
                factsSnapshot.description(),
                factsSnapshot.facts(),
                factsSnapshot.statePanelFacts(),
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
