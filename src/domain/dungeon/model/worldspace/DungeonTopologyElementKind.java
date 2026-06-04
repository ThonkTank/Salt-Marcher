package src.domain.dungeon.model.worldspace;

import java.util.Locale;
import src.domain.dungeon.model.core.projection.DungeonAreaType;
import src.domain.dungeon.model.core.projection.DungeonFeatureType;

public final class DungeonTopologyElementKind {
    private static final String DOOR_KIND = "door";
    private static final String OPEN_KIND = "open";

    public static final DungeonTopologyElementKind EMPTY = new DungeonTopologyElementKind("EMPTY");
    public static final DungeonTopologyElementKind ROOM = new DungeonTopologyElementKind("ROOM");
    public static final DungeonTopologyElementKind CORRIDOR = new DungeonTopologyElementKind("CORRIDOR");
    public static final DungeonTopologyElementKind CORRIDOR_ANCHOR = new DungeonTopologyElementKind("CORRIDOR_ANCHOR");
    public static final DungeonTopologyElementKind DOOR = new DungeonTopologyElementKind("DOOR");
    public static final DungeonTopologyElementKind WALL = new DungeonTopologyElementKind("WALL");
    public static final DungeonTopologyElementKind STAIR = new DungeonTopologyElementKind("STAIR");
    public static final DungeonTopologyElementKind TRANSITION = new DungeonTopologyElementKind("TRANSITION");

    private final String name;

    private DungeonTopologyElementKind(String name) {
        this.name = name;
    }

    public static DungeonTopologyElementKind valueOf(String name) {
        return switch (name) {
            case "ROOM" -> ROOM;
            case "CORRIDOR" -> CORRIDOR;
            case "CORRIDOR_ANCHOR" -> CORRIDOR_ANCHOR;
            case "DOOR" -> DOOR;
            case "WALL" -> WALL;
            case "STAIR" -> STAIR;
            case "TRANSITION" -> TRANSITION;
            default -> EMPTY;
        };
    }

    public static DungeonTopologyElementKind fromAreaType(DungeonAreaType kind) {
        return kind == DungeonAreaType.CORRIDOR ? CORRIDOR : ROOM;
    }

    public static DungeonTopologyElementKind fromBoundaryKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return WALL;
        }
        String normalized = kind.trim().toLowerCase(Locale.ROOT);
        if (DOOR_KIND.equals(normalized)) {
            return DOOR;
        }
        if (OPEN_KIND.equals(normalized)) {
            return EMPTY;
        }
        return WALL;
    }

    public static DungeonTopologyElementKind fromFeatureType(DungeonFeatureType kind) {
        return kind == DungeonFeatureType.TRANSITION ? TRANSITION : STAIR;
    }

    public String name() {
        return name;
    }

    public boolean isCorridor() {
        return this == CORRIDOR;
    }

    @Override
    public String toString() {
        return name;
    }
}
