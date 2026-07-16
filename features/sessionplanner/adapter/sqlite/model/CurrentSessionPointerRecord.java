package features.sessionplanner.adapter.sqlite.model;

public record CurrentSessionPointerRecord(long sessionId) {

    public CurrentSessionPointerRecord {
        sessionId = Math.max(1L, sessionId);
    }
}
