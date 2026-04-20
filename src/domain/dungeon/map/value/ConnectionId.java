package src.domain.dungeon.map.value;

public record ConnectionId(long value) {

    public ConnectionId {
        value = Math.max(1L, value);
    }
}
