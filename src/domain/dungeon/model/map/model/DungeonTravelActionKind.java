package src.domain.dungeon.model.map.model;

public final class DungeonTravelActionKind {
    public static final DungeonTravelActionKind TRAVERSAL = new DungeonTravelActionKind("TRAVERSAL");
    public static final DungeonTravelActionKind TRANSITION = new DungeonTravelActionKind("TRANSITION");

    private final String name;

    private DungeonTravelActionKind(String name) {
        this.name = name;
    }

    public static DungeonTravelActionKind valueOf(String name) {
        return "TRANSITION".equals(name) ? TRANSITION : TRAVERSAL;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
