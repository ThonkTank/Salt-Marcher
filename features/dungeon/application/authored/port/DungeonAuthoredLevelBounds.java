package features.dungeon.application.authored.port;

/** Exact indexed authored cell bounds for one map level. */
public record DungeonAuthoredLevelBounds(
        int level,
        boolean present,
        int minimumQ,
        int minimumR,
        int maximumQ,
        int maximumR
) {
    public DungeonAuthoredLevelBounds {
        if (present && (maximumQ < minimumQ || maximumR < minimumR)) {
            throw new IllegalArgumentException("present authored bounds must be ordered");
        }
        if (!present) {
            minimumQ = minimumR = maximumQ = maximumR = 0;
        }
    }

    public static DungeonAuthoredLevelBounds empty(int level) {
        return new DungeonAuthoredLevelBounds(level, false, 0, 0, 0, 0);
    }
}
