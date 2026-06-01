package src.domain.dungeon.published;

public record MoveDungeonEditorHandleCommand(
        DungeonEditorHandleRef handleRef,
        int targetQ,
        int targetR
) {

    public MoveDungeonEditorHandleCommand {
        handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
    }

    public boolean hasHandleRef() {
        return handleRef.topologyRef().kind() != DungeonTopologyElementKind.EMPTY
                && handleRef.topologyRef().id() > 0L;
    }

    public String handleKindName() {
        return handleRef.kind().name();
    }

    public String handleTopologyKindName() {
        return handleRef.topologyRef().kind().name();
    }

    public long handleTopologyId() {
        return handleRef.topologyRef().id();
    }

    public long handleOwnerId() {
        return handleRef.ownerId();
    }

    public long handleClusterId() {
        return handleRef.clusterId();
    }

    public long handleCorridorId() {
        return handleRef.corridorId();
    }

    public long handleRoomId() {
        return handleRef.roomId();
    }

    public int handleIndex() {
        return handleRef.index();
    }

    public int handleCellQ() {
        return handleRef.cell().q();
    }

    public int handleCellR() {
        return handleRef.cell().r();
    }

    public int handleCellLevel() {
        return handleRef.cell().level();
    }

    public String handleDirection() {
        return handleRef.direction();
    }
}
