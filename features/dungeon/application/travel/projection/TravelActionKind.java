package features.dungeon.application.travel.projection;

public enum TravelActionKind {
    TRAVERSAL,
    TRANSITION;

    public static TravelActionKind defaultKind() {
        return TRAVERSAL;
    }
}
