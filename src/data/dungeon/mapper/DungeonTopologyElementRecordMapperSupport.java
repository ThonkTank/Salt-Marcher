package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonTopologyElementRecord;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;

final class DungeonTopologyElementRecordMapperSupport {
    private static final String DOOR_EDGE_TYPE = "DOOR";
    private static final String OPEN_EDGE_TYPE = "OPEN";

    private DungeonTopologyElementRecordMapperSupport() {
    }

    static DungeonMapTopology toTopologyIndex(List<DungeonTopologyElementRecord> records) {
        List<DungeonMapTopology.DungeonTopologyBinding> bindings = new ArrayList<>();
        for (DungeonTopologyElementRecord record
                : records == null ? List.<DungeonTopologyElementRecord>of() : records) {
            DungeonTopologyElementKind kind = topologyKind(record.elementKind());
            if (kind == DungeonTopologyElementKind.EMPTY || record.elementId() <= 0L) {
                continue;
            }
            bindings.add(new DungeonMapTopology.DungeonTopologyBinding(
                    new DungeonTopologyRef(kind, record.elementId()),
                    record.clusterId() == null ? 0L : record.clusterId(),
                    record.corridorId() == null ? 0L : record.corridorId(),
                    record.label()));
        }
        return new DungeonMapTopology(bindings);
    }

    static List<DungeonTopologyElementRecord> toTopologyElementRecords(
            long mapId,
            DungeonMapTopology topologyIndex
    ) {
        List<DungeonTopologyElementRecord> result = new ArrayList<>();
        Set<DungeonTopologyRef> seen = new LinkedHashSet<>();
        int sortOrder = 0;
        for (DungeonMapTopology.DungeonTopologyBinding binding
                : topologyIndex == null ? List.<DungeonMapTopology.DungeonTopologyBinding>of()
                        : topologyIndex.bindings()) {
            if (!binding.ref().present() || !seen.add(binding.ref())) {
                continue;
            }
            result.add(new DungeonTopologyElementRecord(
                    mapId,
                    binding.ref().kind().name(),
                    binding.ref().id(),
                    binding.clusterId() <= 0L ? null : binding.clusterId(),
                    binding.corridorId() <= 0L ? null : binding.corridorId(),
                    binding.label(),
                    sortOrder));
            sortOrder++;
        }
        return List.copyOf(result);
    }

    static DungeonTopologyRef topologyRef(String edgeType, @Nullable Long topologyElementId) {
        if (topologyElementId == null || topologyElementId <= 0L) {
            return DungeonTopologyRef.empty();
        }
        if (OPEN_EDGE_TYPE.equalsIgnoreCase(edgeType == null ? "" : edgeType.trim())) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(
                topologyKindForBoundary(edgeType),
                topologyElementId);
    }

    private static DungeonTopologyElementKind topologyKindForBoundary(String edgeType) {
        if (edgeType == null || edgeType.isBlank()) {
            return DungeonTopologyElementKind.WALL;
        }
        String normalized = edgeType.trim();
        if (OPEN_EDGE_TYPE.equalsIgnoreCase(normalized)) {
            return DungeonTopologyElementKind.EMPTY;
        }
        if (DOOR_EDGE_TYPE.equalsIgnoreCase(normalized)) {
            return DungeonTopologyElementKind.DOOR;
        }
        return DungeonTopologyElementKind.WALL;
    }

    private static DungeonTopologyElementKind topologyKind(String value) {
        if (value == null || value.isBlank()) {
            return DungeonTopologyElementKind.EMPTY;
        }
        try {
            return DungeonTopologyElementKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }
}
