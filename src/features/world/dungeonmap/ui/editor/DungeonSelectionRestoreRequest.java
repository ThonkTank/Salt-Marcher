package features.world.dungeonmap.ui.editor;

record DungeonSelectionRestoreRequest(Type type, Long entityId) {

    enum Type {
        ROOM,
        AREA,
        FEATURE,
        PASSAGE
    }

    static DungeonSelectionRestoreRequest room(Long roomId) {
        return roomId == null ? null : new DungeonSelectionRestoreRequest(Type.ROOM, roomId);
    }

    static DungeonSelectionRestoreRequest area(Long areaId) {
        return areaId == null ? null : new DungeonSelectionRestoreRequest(Type.AREA, areaId);
    }

    static DungeonSelectionRestoreRequest feature(Long featureId) {
        return featureId == null ? null : new DungeonSelectionRestoreRequest(Type.FEATURE, featureId);
    }

    static DungeonSelectionRestoreRequest passage(Long passageId) {
        return passageId == null ? null : new DungeonSelectionRestoreRequest(Type.PASSAGE, passageId);
    }
}
