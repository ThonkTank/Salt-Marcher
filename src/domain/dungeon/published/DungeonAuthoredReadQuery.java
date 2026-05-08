package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadQuery permits
        DungeonAuthoredReadQuery.LoadSnapshot,
        DungeonAuthoredReadQuery.DescribeSelection {

    final class LoadSnapshot implements DungeonAuthoredReadQuery {
        private final DungeonMapId mapId;

        public LoadSnapshot() {
            this(new DungeonMapId(1L));
        }

        public LoadSnapshot(DungeonMapId mapId) {
            this.mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }

        public DungeonMapId mapId() {
            return mapId;
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
