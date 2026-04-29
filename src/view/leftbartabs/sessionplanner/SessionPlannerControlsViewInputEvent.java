package src.view.leftbartabs.sessionplanner;

public record SessionPlannerControlsViewInputEvent(
        Kind kind,
        long planId
) {

    public SessionPlannerControlsViewInputEvent {
        kind = kind == null ? Kind.REFRESH : kind;
        planId = Math.max(0L, planId);
    }

    static SessionPlannerControlsViewInputEvent refresh() {
        return new SessionPlannerControlsViewInputEvent(Kind.REFRESH, 0L);
    }

    static SessionPlannerControlsViewInputEvent importPlan(long planId) {
        return new SessionPlannerControlsViewInputEvent(Kind.IMPORT_PLAN, planId);
    }

    enum Kind {
        REFRESH,
        IMPORT_PLAN
    }
}
