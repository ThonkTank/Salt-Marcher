package src.domain.sessionplanner.session.value;

public record SessionEncounterId(long value) {

    public SessionEncounterId {
        value = Math.max(1L, value);
    }
}
