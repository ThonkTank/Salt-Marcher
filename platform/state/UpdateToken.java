package platform.state;

public record UpdateToken(long revision) {

    public UpdateToken {
        if (revision <= 0L) {
            throw new IllegalArgumentException("revision must be positive");
        }
    }
}
