package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.objects.StructureObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Room identity and narration are persisted directly.
 *
 * <p>The enclosed-space topology is derived from the owning cluster and cached here as a projection so existing
 * editor/runtime readers can keep using room-local queries without making the room the physical owner again.
 */
public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        Map<Integer, CellCoord> anchorsByLevel,
        RoomTopology topology,
        RoomNarration narration
) {
    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure
    ) {
        return create(roomId, mapId, clusterId, name, structure, RoomNarration.empty());
    }

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure,
            RoomNarration narration
    ) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                anchorsFromStructure(structure),
                RoomTopology.fromStructure(structure),
                narration);
    }

    public static Room metadata(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, CellCoord> anchorsByLevel,
            RoomNarration narration
    ) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, RoomTopology.empty(), narration);
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure
    ) {
        return resolved(roomId, mapId, clusterId, name, structure, RoomNarration.empty());
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure,
            RoomNarration narration
    ) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                anchorsFromStructure(structure),
                RoomTopology.fromStructure(structure),
                narration);
    }

    public Room {
        anchorsByLevel = normalizeAnchors(anchorsByLevel, topology);
        topology = topology == null ? RoomTopology.empty() : topology;
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    /**
     * Compatibility bridge for existing readers. The structure is derived topology, not persisted room-owned truth.
     */
    public StructureObject structure() {
        return topology.structure();
    }

    public Room withNarration(RoomNarration narration) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, topology, narration);
    }

    public Room withName(String name) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, topology, narration);
    }

    public Room withClusterId(long clusterId) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, topology, narration);
    }

    public Room withAnchorsByLevel(Map<Integer, CellCoord> anchorsByLevel) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, topology, narration);
    }

    public Room withTopology(RoomTopology topology) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, topology, narration);
    }

    public Room withStructure(StructureObject structure) {
        return withTopology(RoomTopology.fromStructure(structure));
    }

    public Room movedBy(CellCoord delta) {
        return movedBy(delta, 0);
    }

    public Room movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        Map<Integer, CellCoord> movedAnchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, CellCoord> entry : anchorsByLevel.entrySet()) {
            movedAnchors.put(entry.getKey() + levelDelta, entry.getValue().add(resolvedDelta));
        }
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                movedAnchors,
                topology.movedBy(resolvedDelta, levelDelta),
                narration);
    }

    public Room movedToLevel(int targetPrimaryLevel) {
        return movedBy(new CellCoord(0, 0), targetPrimaryLevel - structure().primaryLevel());
    }

    public Room movedByLevel(int levelDelta) {
        return movedBy(new CellCoord(0, 0), levelDelta);
    }

    private static Map<Integer, CellCoord> normalizeAnchors(
            Map<Integer, CellCoord> anchorsByLevel,
            RoomTopology topology
    ) {
        Map<Integer, CellCoord> resolved = new LinkedHashMap<>();
        if (anchorsByLevel != null) {
            anchorsByLevel.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> resolved.put(entry.getKey(), entry.getValue()));
        }
        StructureObject structure = topology == null ? null : topology.structure();
        if (resolved.isEmpty() && structure != null) {
            resolved.putAll(anchorsFromStructure(structure));
        }
        return resolved.isEmpty() ? Map.of() : Map.copyOf(resolved);
    }

    private static Map<Integer, CellCoord> anchorsFromStructure(StructureObject structure) {
        StructureObject resolvedStructure = structure == null ? StructureObject.empty() : structure;
        Map<Integer, CellCoord> anchors = new LinkedHashMap<>();
        for (Integer levelZ : resolvedStructure.levels().stream().sorted().toList()) {
            CellCoord anchor = resolvedStructure.anchorCellCoordAtLevel(levelZ);
            if (anchor != null) {
                anchors.put(levelZ, anchor);
            }
        }
        return anchors.isEmpty() ? Map.of() : Map.copyOf(anchors);
    }
}
