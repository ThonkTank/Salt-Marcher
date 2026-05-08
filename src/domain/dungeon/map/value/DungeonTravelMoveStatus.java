package src.domain.dungeon.map.value;

public final class DungeonTravelMoveStatus {
    public static final DungeonTravelMoveStatus SUCCESS = new DungeonTravelMoveStatus("SUCCESS");
    public static final DungeonTravelMoveStatus INVALID_ACTION = new DungeonTravelMoveStatus("INVALID_ACTION");
    public static final DungeonTravelMoveStatus TARGET_UNAVAILABLE = new DungeonTravelMoveStatus("TARGET_UNAVAILABLE");
    public static final DungeonTravelMoveStatus EXTERNAL_TARGET = new DungeonTravelMoveStatus("EXTERNAL_TARGET");
    public static final DungeonTravelMoveStatus NO_MAP = new DungeonTravelMoveStatus("NO_MAP");

    private final String name;

    private DungeonTravelMoveStatus(String name) {
        this.name = name;
    }

    public static DungeonTravelMoveStatus valueOf(String name) {
        return switch (name) {
            case "INVALID_ACTION" -> INVALID_ACTION;
            case "TARGET_UNAVAILABLE" -> TARGET_UNAVAILABLE;
            case "EXTERNAL_TARGET" -> EXTERNAL_TARGET;
            case "NO_MAP" -> NO_MAP;
            default -> SUCCESS;
        };
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
