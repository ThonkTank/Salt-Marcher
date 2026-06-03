package src.domain.dungeon.model.runtime.travel.projection;


public final class TravelActionKind {
    public static final TravelActionKind TRAVERSAL = new TravelActionKind("TRAVERSAL");
    public static final TravelActionKind TRANSITION = new TravelActionKind("TRANSITION");

    private final String name;

    private TravelActionKind(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    public static TravelActionKind defaultKind() {
        return TRAVERSAL;
    }

    @Override
    public String toString() {
        return name;
    }
}
