package src.domain.dungeon.model.worldspace.model;

public final class DungeonTravelActionKind {
    public static final DungeonTravelActionKind TRAVERSAL = new DungeonTravelActionKind("TRAVERSAL");
    public static final DungeonTravelActionKind TRANSITION = new DungeonTravelActionKind("TRANSITION");

    private final String name;

    private DungeonTravelActionKind(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
