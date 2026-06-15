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

    public int handleSourceEdgeFromQ() {
        return sourceEdgeFrom() == null ? 0 : sourceEdgeFrom().q();
    }

    public int handleSourceEdgeFromR() {
        return sourceEdgeFrom() == null ? 0 : sourceEdgeFrom().r();
    }

    public int handleSourceEdgeFromLevel() {
        return sourceEdgeFrom() == null ? 0 : sourceEdgeFrom().level();
    }

    public int handleSourceEdgeToQ() {
        return sourceEdgeTo() == null ? 0 : sourceEdgeTo().q();
    }

    public int handleSourceEdgeToR() {
        return sourceEdgeTo() == null ? 0 : sourceEdgeTo().r();
    }

    public int handleSourceEdgeToLevel() {
        return sourceEdgeTo() == null ? 0 : sourceEdgeTo().level();
    }

    private DungeonCellRef sourceEdgeFrom() {
        return handleRef.sourceEdge() == null ? null : handleRef.sourceEdge().from();
    }

    private DungeonCellRef sourceEdgeTo() {
        return handleRef.sourceEdge() == null ? null : handleRef.sourceEdge().to();
    }
}
