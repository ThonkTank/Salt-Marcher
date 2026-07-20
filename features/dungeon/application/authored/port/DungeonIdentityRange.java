package features.dungeon.application.authored.port;

/** Contiguous reservation used by one command plan. */
public record DungeonIdentityRange(long firstId, int count) {
    public DungeonIdentityRange {
        if (firstId < 1L || count < 1) {
            throw new IllegalArgumentException("identity range must be positive");
        }
        Math.addExact(firstId, count - 1L);
    }

    public long idAt(int index) {
        if (index < 0 || index >= count) {
            throw new IndexOutOfBoundsException(index);
        }
        return firstId + index;
    }
}
