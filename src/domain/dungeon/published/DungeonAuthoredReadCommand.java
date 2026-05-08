package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadCommand permits
        DungeonAuthoredReadCommand.LoadSnapshot,
        DungeonAuthoredReadCommand.DescribeSelection {

    record LoadSnapshot(DungeonMapId mapId) implements DungeonAuthoredReadCommand {
        public LoadSnapshot() {
            this(new DungeonMapId(1L));
        }

        public LoadSnapshot {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }

    record DescribeSelection(
            DungeonMapId mapId,
            DungeonTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) implements DungeonAuthoredReadCommand {

        public DescribeSelection {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
        }
    }
}
