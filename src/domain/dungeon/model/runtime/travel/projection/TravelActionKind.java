package src.domain.dungeon.model.runtime.travel.projection;

public enum TravelActionKind {
    TRAVERSAL,
    TRANSITION;

    public static TravelActionKind defaultKind() {
        return TRAVERSAL;
    }
}
