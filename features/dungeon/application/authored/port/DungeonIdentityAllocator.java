package features.dungeon.application.authored.port;

/** Technical stable-identity range reservation without placeholder authored rows. */
public interface DungeonIdentityAllocator {

    DungeonIdentityRange reserve(DungeonIdentityKind kind, int count);

    default long reserveStairId() {
        return reserve(DungeonIdentityKind.STAIR, 1).firstId();
    }

    default long reserveTransitionId() {
        return reserve(DungeonIdentityKind.TRANSITION, 1).firstId();
    }

    default long reserveFeatureMarkerId() {
        return reserve(DungeonIdentityKind.FEATURE_MARKER, 1).firstId();
    }
}
