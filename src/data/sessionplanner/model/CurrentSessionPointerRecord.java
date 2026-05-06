package src.data.sessionplanner.model;

public record CurrentSessionPointerRecord(long sessionId) {

    public CurrentSessionPointerRecord {
        sessionId = Math.max(1L, sessionId);
    }
}
