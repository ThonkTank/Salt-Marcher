package src.domain.mapcore.api;

/**
 * Display-neutral cell styling surface.
 */
public record MapCellStyle(
        boolean room,
        boolean corridor,
        boolean blocked,
        boolean interactive,
        boolean current
) {

    public static MapCellStyle roomStyle() {
        return new MapCellStyle(true, false, false, true, false);
    }

    public static MapCellStyle corridorStyle() {
        return new MapCellStyle(false, true, false, true, false);
    }

    public static MapCellStyle blockedStyle() {
        return new MapCellStyle(false, false, true, false, false);
    }

    public MapCellStyle currentVariant() {
        return new MapCellStyle(room, corridor, blocked, interactive, true);
    }
}
