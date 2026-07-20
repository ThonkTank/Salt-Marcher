package features.sessiongeneration.domain.generation;

import java.nio.charset.StandardCharsets;

final class KeyedEntropy {

    private static final long MODULUS = 1_000_003L;
    private final long seed;

    KeyedEntropy(long seed) {
        this.seed = seed;
    }

    double unit(String key, long first, long second) {
        long keyHash = 0xcbf29ce484222325L;
        for (byte value : key.getBytes(StandardCharsets.UTF_8)) {
            keyHash ^= Byte.toUnsignedLong(value);
            keyHash *= 0x100000001b3L;
        }
        long base = seed + keyHash + first * 1009L + second * 719L;
        long mixed = base * base + first * second * 2131L;
        return Math.floorMod(mixed, MODULUS) / (double) MODULUS;
    }

    int index(String key, long first, long second, int size) {
        if (size <= 0) {
            throw new IllegalArgumentException("entropy pool must not be empty");
        }
        long scaled = (long) Math.floor(unit(key, first, second) * size);
        return (int) Math.min(size - 1L, scaled);
    }
}
