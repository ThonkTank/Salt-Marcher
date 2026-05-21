package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadCommand permits
        DungeonAuthoredReadCommand.MapSelection,
        DungeonAuthoredReadCommand.DescribeSelection {

    default long mapIdValue() {
        return 1L;
    }

    default boolean describesSelection() {
        return false;
    }

    default String topologyKindName() {
        return "EMPTY";
    }

    default long topologyId() {
        return 0L;
    }

    default long clusterIdValue() {
        return 0L;
    }

    default boolean clusterSelectionValue() {
        return false;
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

        @Override
        public boolean describesSelection() {
            return true;
        }

        @Override
        public String topologyKindName() {
            return topologyRef.kind().name();
        }

        @Override
        public long topologyId() {
            return topologyRef.id();
        }

        @Override
        public long clusterIdValue() {
            return clusterId;
        }

        @Override
        public boolean clusterSelectionValue() {
            return clusterSelection;
        }
    }
}
