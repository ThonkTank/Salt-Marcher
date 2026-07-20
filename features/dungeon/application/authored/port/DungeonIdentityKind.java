package features.dungeon.application.authored.port;

/** Persisted map-wide stable identity families created by authored commands. */
public enum DungeonIdentityKind {
    ROOM,
    ROOM_CLUSTER,
    CORRIDOR,
    CORRIDOR_ANCHOR,
    STAIR,
    STAIR_EXIT,
    TRANSITION,
    FEATURE_MARKER
}
