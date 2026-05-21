package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadCommand permits
        DungeonAuthoredReadCommand.MapSelection,
        DungeonAuthoredReadCommand.DescribeSelection {

    default long mapIdValue() {
        return 1L;
    }

    record MapSelection(DungeonMapId mapId) implements DungeonAuthoredReadCommand {
        public MapSelection() {
            this(new DungeonMapId(1L));
        }

        public MapSelection {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }

        @Override
        public long mapIdValue() {
            return mapId.value();
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

        @Override
        public long mapIdValue() {
            return mapId.value();
        }
    }
}
