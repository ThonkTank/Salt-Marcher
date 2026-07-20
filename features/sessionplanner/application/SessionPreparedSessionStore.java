package features.sessionplanner.application;

public interface SessionPreparedSessionStore {

    CommitPreparedSessionResult commitPreparedSession(CommitPreparedSessionCommand command);
}
