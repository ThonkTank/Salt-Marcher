package src.domain.dungeon.published;

public sealed interface DungeonEditorPointerCommand permits ApplyDungeonEditorPointerCommand {

    DungeonEditorPointerSample pointer();

    default double pointerCanvasX() {
        return pointerOrEmpty().canvasX();
    }

    default double pointerCanvasY() {
        return pointerOrEmpty().canvasY();
    }

    default boolean pointerPrimaryButtonDown() {
        return pointerOrEmpty().primaryButtonDown();
    }

    default boolean pointerSecondaryButtonDown() {
        return pointerOrEmpty().secondaryButtonDown();
    }

    default String pointerTargetKindName() {
        return targetOrEmpty().targetKind().name();
    }

    default String pointerElementKindName() {
        return targetOrEmpty().elementKind().name();
    }

    default long pointerOwnerId() {
        return targetOrEmpty().ownerId();
    }

    default long pointerClusterId() {
        return targetOrEmpty().clusterId();
    }

    default String pointerTopologyKindName() {
        return topologyOrEmpty().kind().name();
    }

    default long pointerTopologyId() {
        return topologyOrEmpty().id();
    }

    default String pointerHandleKindName() {
        return handleOrEmpty().kind().name();
    }

    default String pointerHandleTopologyKindName() {
        return handleTopologyOrEmpty().kind().name();
    }

    default long pointerHandleTopologyId() {
        return handleTopologyOrEmpty().id();
    }

    default long pointerHandleOwnerId() {
        return handleOrEmpty().ownerId();
    }

    default long pointerHandleClusterId() {
        return handleOrEmpty().clusterId();
    }

    default long pointerHandleCorridorId() {
        return handleOrEmpty().corridorId();
    }

    default long pointerHandleRoomId() {
        return handleOrEmpty().roomId();
    }

    default int pointerHandleIndex() {
        return handleOrEmpty().index();
    }

    default int pointerHandleCellQ() {
        return handleCellOrEmpty().q();
    }

    default int pointerHandleCellR() {
        return handleCellOrEmpty().r();
    }

    default int pointerHandleCellLevel() {
        return handleCellOrEmpty().level();
    }

    default String pointerHandleDirection() {
        return handleOrEmpty().direction();
    }

    default String pointerBoundaryKindName() {
        return boundaryOrEmpty().kind().name();
    }

    default String pointerBoundaryKey() {
        return boundaryOrEmpty().key();
    }

    default long pointerBoundaryOwnerId() {
        return boundaryOrEmpty().ownerId();
    }

    default String pointerBoundaryTopologyKindName() {
        return boundaryTopologyOrEmpty().kind().name();
    }

    default long pointerBoundaryTopologyId() {
        return boundaryTopologyOrEmpty().id();
    }

    default int pointerBoundaryStartQ() {
        return boundaryStartOrEmpty().q();
    }

    default int pointerBoundaryStartR() {
        return boundaryStartOrEmpty().r();
    }

    default int pointerBoundaryStartLevel() {
        return boundaryStartOrEmpty().level();
    }

    default int pointerBoundaryEndQ() {
        return boundaryEndOrEmpty().q();
    }

    default int pointerBoundaryEndR() {
        return boundaryEndOrEmpty().r();
    }

    default int pointerBoundaryEndLevel() {
        return boundaryEndOrEmpty().level();
    }

    private DungeonEditorPointerSample pointerOrEmpty() {
        DungeonEditorPointerSample sample = pointer();
        return sample == null ? DungeonEditorPointerSample.empty() : sample;
    }

    private DungeonEditorPointerTarget targetOrEmpty() {
        DungeonEditorPointerTarget target = pointerOrEmpty().target();
        return target == null ? DungeonEditorPointerTarget.empty() : target;
    }

    private DungeonTopologyElementRef topologyOrEmpty() {
        DungeonTopologyElementRef topologyRef = targetOrEmpty().topologyRef();
        return topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
    }

    private DungeonEditorHandleRef handleOrEmpty() {
        DungeonEditorHandleRef handleRef = targetOrEmpty().handleRef();
        return handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
    }

    private DungeonTopologyElementRef handleTopologyOrEmpty() {
        DungeonTopologyElementRef topologyRef = handleOrEmpty().topologyRef();
        return topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
    }

    private DungeonCellRef handleCellOrEmpty() {
        DungeonCellRef cell = handleOrEmpty().cell();
        return cell == null ? emptyCell() : cell;
    }

    private DungeonEditorBoundaryTargetRef boundaryOrEmpty() {
        DungeonEditorBoundaryTargetRef boundaryRef = targetOrEmpty().boundaryRef();
        return boundaryRef == null ? DungeonEditorBoundaryTargetRef.empty() : boundaryRef;
    }

    private DungeonTopologyElementRef boundaryTopologyOrEmpty() {
        DungeonTopologyElementRef topologyRef = boundaryOrEmpty().topologyRef();
        return topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
    }

    private DungeonCellRef boundaryStartOrEmpty() {
        DungeonCellRef cell = boundaryOrEmpty().start();
        return cell == null ? emptyCell() : cell;
    }

    private DungeonCellRef boundaryEndOrEmpty() {
        DungeonCellRef cell = boundaryOrEmpty().end();
        return cell == null ? emptyCell() : cell;
    }

    private static DungeonCellRef emptyCell() {
        return new DungeonCellRef(0, 0, 0);
    }
}
