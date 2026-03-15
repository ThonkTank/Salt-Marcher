package features.world.dungeonmap.ui.editor.state;

public record DungeonSelectionRestoreRequest(Type type, Long entityId) {

    public enum Type {
        ROOM,
        AREA,
        FEATURE,
        CONNECTION
    }

    public static DungeonSelectionRestoreRequest room(Long roomId) {
        return roomId == null ? null : new DungeonSelectionRestoreRequest(Type.ROOM, roomId);
    }

    public static DungeonSelectionRestoreRequest area(Long areaId) {
        return areaId == null ? null : new DungeonSelectionRestoreRequest(Type.AREA, areaId);
    }

    public static DungeonSelectionRestoreRequest feature(Long featureId) {
        return featureId == null ? null : new DungeonSelectionRestoreRequest(Type.FEATURE, featureId);
    }

    public static DungeonSelectionRestoreRequest connection(Long connectionId) {
        return connectionId == null ? null : new DungeonSelectionRestoreRequest(Type.CONNECTION, connectionId);
    }
}
