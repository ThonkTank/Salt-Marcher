package features.world.dungeonmap.model;

public enum PassageDirection {
    EAST, SOUTH;

    public String edgeKey(int x, int y) {
        return x + ":" + y + ":" + name().charAt(0);
    }

    public String dbValue() {
        return name().toLowerCase();
    }

    public static PassageDirection fromDb(String value) {
        if ("east".equals(value)) {
            return EAST;
        }
        if ("south".equals(value)) {
            return SOUTH;
        }
        throw new IllegalArgumentException("Unknown passage direction: " + value);
    }
}
