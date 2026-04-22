package src.domain.dungeon.published;

public record DescribeDungeonSelectionQuery(
        DungeonMapId mapId,
        DungeonTopologyElementRef topologyRef,
        long clusterId,
        boolean clusterSelection
) {

    public DescribeDungeonSelectionQuery {
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        clusterId = Math.max(0L, clusterId);
    }
}
