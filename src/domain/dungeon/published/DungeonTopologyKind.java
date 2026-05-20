package src.domain.dungeon.published;

public enum DungeonTopologyKind {
    SQUARE,
    HEX;

    public static DungeonTopologyKind fromName(String name) {
        return "HEX".equals(name) ? HEX : SQUARE;
    }

    public boolean isHex() {
        return this == HEX;
    }
}
