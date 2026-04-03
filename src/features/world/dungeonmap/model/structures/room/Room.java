package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.connection.DoorExitCatalog;
import features.world.dungeonmap.model.structures.connection.RoomExitDescriptor;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        StructureObject structure,
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
                normalizeStructure(structure),
                narration);
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
                normalizeStructure(structure),
                narration);
    }

    public Room {
        structure = normalizeStructure(structure);
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    public Room withNarration(RoomNarration narration) {
        return new Room(roomId, mapId, clusterId, name, structure, narration);
    }

    public List<RoomExitDescriptor> describeExits(DungeonLayout layout) {
        if (layout == null || roomId == null) {
            return List.of();
        }
        return structure.levels().stream()
                .sorted()
                .flatMap(levelZ -> DoorExitCatalog.describe(
                        structure.cellCoordsAtLevel(levelZ),
                        levelZ,
                        layout.connectionsForRoom(roomId)).stream())
                .toList();
    }

    public Room movedBy(CellCoord delta) {
        return movedBy(delta, 0);
    }

    public Room movedBy(CellCoord delta, int levelDelta) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                structure.movedBy(delta, levelDelta),
                narration);
    }

    public Room movedToLevel(int targetPrimaryLevel) {
        return movedBy(new CellCoord(0, 0), targetPrimaryLevel - structure.primaryLevel());
    }

    public Room movedByLevel(int levelDelta) {
        return movedBy(new CellCoord(0, 0), levelDelta);
    }

    private static StructureObject normalizeStructure(StructureObject structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return defaultStructure();
        }
        return structure;
    }

    private static StructureObject defaultStructure() {
        return StructureObject.fromDescriptor(StructureDescriptor.fromCellCoordsByLevel(Map.of(0, Set.of(new CellCoord(0, 0)))));
    }
}
