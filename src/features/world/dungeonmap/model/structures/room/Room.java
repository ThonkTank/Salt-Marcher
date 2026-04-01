package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.TargetKey;

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
    private static final String TARGET_KEY_PREFIX = "room:";

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

    public String targetKey() {
        return targetKey(roomId);
    }

    public static String targetKey(Long roomId) {
        return TargetKey.of(TARGET_KEY_PREFIX, roomId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long roomIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
    }

    public Room movedBy(Point2i delta) {
        return movedBy(delta, 0);
    }

    public Room movedBy(Point2i delta, int levelDelta) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                structure.movedBy(delta, levelDelta),
                narration);
    }

    public Room movedToLevel(int targetPrimaryLevel) {
        return movedBy(new Point2i(0, 0), targetPrimaryLevel - structure.primaryLevel());
    }

    public Room movedByLevel(int levelDelta) {
        return movedBy(new Point2i(0, 0), levelDelta);
    }

    private static StructureObject normalizeStructure(StructureObject structure) {
        if (structure == null || structure.levels().isEmpty()) {
            return defaultStructure();
        }
        return structure;
    }

    private static StructureObject defaultStructure() {
        return StructureObject.fromDescriptor(StructureDescriptor.fromCellsByLevel(Map.of(0, Set.of(new Point2i(0, 0)))));
    }
}
