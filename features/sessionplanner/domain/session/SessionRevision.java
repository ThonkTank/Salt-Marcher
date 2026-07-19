package features.sessionplanner.domain.session;

public record SessionRevision(long value) {

    public SessionRevision {
        if (value < 1L) {
            throw new IllegalArgumentException("session revision must be positive");
        }
    }

    public static SessionRevision initial() {
        return new SessionRevision(1L);
    }

    public SessionRevision next() {
        return new SessionRevision(Math.addExact(value, 1L));
    }
}
