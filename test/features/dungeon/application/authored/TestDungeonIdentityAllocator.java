package features.dungeon.application.authored;

import features.dungeon.application.authored.port.DungeonIdentityAllocator;
import features.dungeon.application.authored.port.DungeonIdentityKind;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import java.util.EnumMap;
import java.util.Map;

/** Deterministic per-kind identity sequences for authored application tests. */
public final class TestDungeonIdentityAllocator implements DungeonIdentityAllocator {
    private final Map<DungeonIdentityKind, Long> nextIds = new EnumMap<>(DungeonIdentityKind.class);

    public TestDungeonIdentityAllocator() {
        this(1L);
    }

    public TestDungeonIdentityAllocator(long firstId) {
        if (firstId < 1L) {
            throw new IllegalArgumentException("firstId must be positive");
        }
        for (DungeonIdentityKind kind : DungeonIdentityKind.values()) {
            nextIds.put(kind, firstId);
        }
    }

    @Override
    public synchronized DungeonIdentityRange reserve(DungeonIdentityKind kind, int count) {
        if (kind == null || count < 1) {
            throw new IllegalArgumentException("kind and a positive count are required");
        }
        long firstId = nextIds.getOrDefault(kind, 1L);
        nextIds.put(kind, Math.addExact(firstId, count));
        return new DungeonIdentityRange(firstId, count);
    }
}
