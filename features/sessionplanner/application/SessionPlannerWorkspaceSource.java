package features.sessionplanner.application;

/** Application port for exactly one set-based planner workspace read. */
public interface SessionPlannerWorkspaceSource {
    SessionPlannerReadCapture readWorkspace();
}
