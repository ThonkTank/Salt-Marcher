package src.domain.dungeon.map.value;

import java.util.Locale;

public enum DungeonTopologyElementKind {
    EMPTY,
    ROOM,
    CORRIDOR,
    DOOR,
    WALL,
    STAIR,
    TRANSITION;

    public static DungeonTopologyElementKind fromAreaType(DungeonAreaType kind) {
        return kind == DungeonAreaType.CORRIDOR ? CORRIDOR : ROOM;
    }

    public static DungeonTopologyElementKind fromBoundaryKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return WALL;
        }
        return "door".equals(kind.trim().toLowerCase(Locale.ROOT)) ? DOOR : WALL;
    }

    public static DungeonTopologyElementKind fromFeatureType(DungeonFeatureType kind) {
        return kind == DungeonFeatureType.TRANSITION ? TRANSITION : STAIR;
    }
}
