package src.domain.dungeon.published;

public sealed interface DungeonAuthoredReadCommand permits
        DungeonAuthoredReadCommand.MapSelection,
        DungeonAuthoredReadCommand.DescribeSelection {

    record MapSelection(DungeonMapId mapId) implements DungeonAuthoredReadCommand, DungeonMapCatalogCommand {
        public MapSelection() {
            this(new DungeonMapId(1L));
        }

        public MapSelection {
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
