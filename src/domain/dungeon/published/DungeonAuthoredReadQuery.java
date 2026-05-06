package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadQuery permits
        DungeonAuthoredReadQuery.LoadSnapshot,
        DungeonAuthoredReadQuery.DescribeSelection {

    record LoadSnapshot(DungeonMapId mapId) implements DungeonAuthoredReadQuery {

        public LoadSnapshot {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }

    record DescribeSelection(
            DungeonMapId mapId,
            DungeonTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) implements DungeonAuthoredReadQuery {

        public DescribeSelection {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
        }
    }
}
