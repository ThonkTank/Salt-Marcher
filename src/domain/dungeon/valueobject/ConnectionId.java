package src.domain.dungeon.valueobject;

public record ConnectionId(long value) {

    public ConnectionId {
        value = Math.max(1L, value);
    }
}
