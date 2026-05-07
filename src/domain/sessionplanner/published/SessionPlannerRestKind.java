package src.domain.sessionplanner.published;

public enum SessionPlannerRestKind {
    NONE,
    SHORT_REST,
    LONG_REST;

    public boolean clearsRestGap() {
        return this == NONE;
    }
}
