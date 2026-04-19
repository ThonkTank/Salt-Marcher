package src.domain.dungeon.map;

public record ConnectionId(long value) {

    public ConnectionId {
        value = Math.max(1L, value);
    }
}
