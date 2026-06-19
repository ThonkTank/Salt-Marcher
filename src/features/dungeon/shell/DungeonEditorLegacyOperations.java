package src.features.dungeon.shell;

import java.util.Locale;
import java.util.Objects;
import src.domain.dungeon.published.ApplyDungeonEditorPointerCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorBoundaryTargetRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorPointerSample;
import src.domain.dungeon.published.DungeonEditorPointerTarget;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.MoveDungeonEditorHandleCommand;
import src.domain.dungeon.published.SaveDungeonEditorLabelNameCommand;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand;
import src.domain.dungeon.published.SaveDungeonEditorStairGeometryCommand;
import src.domain.dungeon.published.SaveDungeonEditorTransitionDescriptionCommand;
import src.domain.dungeon.published.SaveDungeonEditorTransitionLinkCommand;
import src.domain.dungeon.published.SelectDungeonEditorMapCommand;
import src.domain.dungeon.published.SetDungeonEditorOverlayCommand;
import src.domain.dungeon.published.SetDungeonEditorToolCommand;
import src.domain.dungeon.published.SetDungeonEditorViewModeCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations;

final class DungeonEditorLegacyOperations implements DungeonEditorRuntimeOperations {
    private final DungeonEditorLegacyMapOperations mapOperations;
    private final DungeonEditorLegacyProjectionOperations projectionOperations;
    private final DungeonEditorLegacyPointerOperations pointerOperations;
    private final DungeonEditorLegacyDetailOperations detailOperations;

    DungeonEditorLegacyOperations(
            DungeonEditorLegacyMapOperations mapOperations,
            DungeonEditorLegacyProjectionOperations projectionOperations,
            DungeonEditorLegacyPointerOperations pointerOperations,
            DungeonEditorLegacyDetailOperations detailOperations
    ) {
        this.mapOperations = Objects.requireNonNull(mapOperations, "mapOperations");
        this.projectionOperations = Objects.requireNonNull(projectionOperations, "projectionOperations");
        this.pointerOperations = Objects.requireNonNull(pointerOperations, "pointerOperations");
        this.detailOperations = Objects.requireNonNull(detailOperations, "detailOperations");
    }

    @Override
    public void selectMap(long mapIdValue) {
        mapOperations.selectMap(new SelectDungeonEditorMapCommand(new DungeonMapId(mapIdValue)));
    }

    @Override
    public void createMap(String mapName) {
        mapOperations.createMap(new DungeonMapCatalogCommand.CreateMapCommand(mapName));
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        mapOperations.renameMap(new DungeonMapCatalogCommand.RenameMapCommand(new DungeonMapId(mapIdValue), mapName));
    }

    @Override
    public void deleteMap(long mapIdValue) {
        mapOperations.deleteMap(new DeleteDungeonMapCommand(new DungeonMapId(mapIdValue)));
    }

    @Override
    public void setViewMode(String viewModeKey) {
        projectionOperations.setViewMode(new SetDungeonEditorViewModeCommand(viewMode(viewModeKey)));
    }

    @Override
    public void setTool(String toolKey) {
        projectionOperations.setTool(new SetDungeonEditorToolCommand(tool(toolKey)));
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        projectionOperations.shiftProjectionLevel(new ShiftDungeonEditorProjectionLevelCommand(levelShift));
    }

    @Override
    public void setOverlay(String modeKey, int levelRange, double opacity, java.util.List<Integer> selectedLevels) {
        projectionOperations.setOverlay(new SetDungeonEditorOverlayCommand(new DungeonOverlaySettings(
                modeKey,
                levelRange,
                opacity,
                selectedLevels)));
    }

    @Override
    public void applyPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        ApplyDungeonEditorPointerCommand command =
                pointerCommand(action, toolKey, sample, wallSingleClickMode, transitionDestination);
        if (command != null) {
            pointerOperations.applyPointer(command);
        }
    }

    @Override
    public void scrollSelection(int levelDelta) {
        pointerOperations.scrollSelection(new ShiftDungeonEditorProjectionLevelCommand(levelDelta));
    }

    @Override
    public void moveHandle(HandleTarget handle, int q, int r) {
        pointerOperations.moveHandle(new MoveDungeonEditorHandleCommand(handleRef(handle), q, r));
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", java.util.List.of()) : narration;
        detailOperations.saveRoomNarration(new SaveDungeonEditorRoomNarrationCommand(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                safeNarration.exits().stream().map(ExitNarration::label).toList(),
                safeNarration.exits().stream().map(ExitNarration::q).toList(),
                safeNarration.exits().stream().map(ExitNarration::r).toList(),
                safeNarration.exits().stream().map(ExitNarration::level).toList(),
                safeNarration.exits().stream().map(ExitNarration::direction).toList(),
                safeNarration.exits().stream().map(ExitNarration::description).toList()));
    }

    @Override
    public void saveLabelName(String targetKind, long targetId, String name) {
        detailOperations.saveLabelName(new SaveDungeonEditorLabelNameCommand(targetKind, targetId, name));
    }

    @Override
    public void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        detailOperations.saveTransitionLink(new SaveDungeonEditorTransitionLinkCommand(
                sourceTransitionId,
                targetMapId,
                targetTransitionId,
                bidirectional));
    }

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        detailOperations.saveTransitionDescription(
                new SaveDungeonEditorTransitionDescriptionCommand(transitionId, description));
    }

    @Override
    public void saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        detailOperations.saveStairGeometry(new SaveDungeonEditorStairGeometryCommand(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2));
    }

    private static ApplyDungeonEditorPointerCommand pointerCommand(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, PointerTarget.empty())
                : sample;
        DungeonEditorTool selectedTool = tool(toolKey);
        DungeonEditorPointerSample pointerSample = new DungeonEditorPointerSample(
                safeSample.sceneX(),
                safeSample.sceneY(),
                safeSample.primaryButtonDown(),
                safeSample.secondaryButtonDown(),
                pointerTarget(safeSample.target(), selectedTool));
        if (action == null) {
            return ApplyDungeonEditorPointerCommand.moved(selectedTool, pointerSample, wallSingleClickMode);
        }
        return switch (action) {
            case PRESSED -> pressedCommand(selectedTool, pointerSample, wallSingleClickMode, transitionDestination);
            case DRAGGED -> ApplyDungeonEditorPointerCommand.dragged(
                    selectedTool,
                    pointerSample,
                    wallSingleClickMode);
            case RELEASED -> ApplyDungeonEditorPointerCommand.released(
                    selectedTool,
                    pointerSample,
                    wallSingleClickMode);
            case MOVED -> ApplyDungeonEditorPointerCommand.moved(selectedTool, pointerSample, wallSingleClickMode);
        };
    }

    private static ApplyDungeonEditorPointerCommand pressedCommand(
            DungeonEditorTool selectedTool,
            DungeonEditorPointerSample pointerSample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (selectedTool == DungeonEditorTool.TRANSITION_CREATE) {
            TransitionDestination safeDestination = transitionDestination == null
                    ? TransitionDestination.empty()
                    : transitionDestination;
            return ApplyDungeonEditorPointerCommand.pressedWithTransitionDestination(
                    selectedTool,
                    pointerSample,
                    wallSingleClickMode,
                    safeDestination.destinationType(),
                    safeDestination.targetMapId(),
                    safeDestination.targetTileId(),
                    safeDestination.targetTransitionId());
        }
        return ApplyDungeonEditorPointerCommand.pressed(selectedTool, pointerSample, wallSingleClickMode);
    }

    private static DungeonEditorPointerTarget pointerTarget(PointerTarget target, DungeonEditorTool selectedTool) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        DungeonEditorPointerTarget doorDeleteTarget = doorDeleteBoundaryTarget(safeTarget, selectedTool);
        return doorDeleteTarget == null ? plainPointerTarget(safeTarget) : doorDeleteTarget;
    }

    private static DungeonEditorPointerTarget plainPointerTarget(PointerTarget target) {
        return switch (normalizedEnumName(target.targetKind())) {
            case "CELL" -> DungeonEditorPointerTarget.cell(
                    topologyElementKind(target.elementKind()),
                    target.ownerId(),
                    target.clusterId(),
                    topologyRef(target.topologyKind(), target.topologyId()));
            case "LABEL" -> DungeonEditorPointerTarget.label(
                    target.ownerId(),
                    target.clusterId(),
                    topologyRef(target.topologyKind(), target.topologyId()),
                    target.labelKind());
            case "GRAPH_NODE" -> DungeonEditorPointerTarget.graphNode(
                    target.ownerId(),
                    target.clusterId(),
                    topologyRef(target.topologyKind(), target.topologyId()));
            case "HANDLE" -> DungeonEditorPointerTarget.handle(handleRef(target.handle()));
            case "BOUNDARY" -> DungeonEditorPointerTarget.boundary(boundaryRef(target.boundary()));
            default -> DungeonEditorPointerTarget.empty();
        };
    }

    private static DungeonEditorPointerTarget doorDeleteBoundaryTarget(
            PointerTarget target,
            DungeonEditorTool selectedTool
    ) {
        HandleTarget handle = target.handle();
        if (selectedTool != DungeonEditorTool.DOOR_DELETE
                || !"HANDLE".equals(normalizedEnumName(target.targetKind()))
                || !handleKind(handle.kind()).isDoor()
                || !handle.sourceEdgePresent()) {
            return null;
        }
        return DungeonEditorPointerTarget.boundary(new DungeonEditorBoundaryTargetRef(
                DungeonBoundaryKind.DOOR,
                "",
                handle.ownerId(),
                topologyRef(handle.topologyKind(), handle.topologyId()),
                cellRef(handle.sourceStartQ(), handle.sourceStartR(), handle.sourceStartLevel()),
                cellRef(handle.sourceEndQ(), handle.sourceEndR(), handle.sourceEndLevel())));
    }

    private static DungeonEditorHandleRef handleRef(HandleTarget handle) {
        HandleTarget safeHandle = handle == null ? HandleTarget.empty() : handle;
        DungeonEditorHandleRef baseRef = new DungeonEditorHandleRef(
                handleKind(safeHandle.kind()),
                topologyRef(safeHandle.topologyKind(), safeHandle.topologyId()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.orderIndex(),
                cellRef(safeHandle.q(), safeHandle.r(), safeHandle.level()),
                safeHandle.direction(),
                null);
        return safeHandle.sourceEdgePresent()
                ? DungeonEditorHandleRef.withSourceEdge(
                        baseRef,
                        cellRef(safeHandle.sourceStartQ(), safeHandle.sourceStartR(), safeHandle.sourceStartLevel()),
                        cellRef(safeHandle.sourceEndQ(), safeHandle.sourceEndR(), safeHandle.sourceEndLevel()))
                : baseRef;
    }

    private static DungeonEditorBoundaryTargetRef boundaryRef(BoundaryTarget boundary) {
        BoundaryTarget safeBoundary = boundary == null ? BoundaryTarget.empty() : boundary;
        return new DungeonEditorBoundaryTargetRef(
                boundaryKind(safeBoundary.kind()),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                topologyRef(safeBoundary.topologyKind(), safeBoundary.topologyId()),
                cellRef(safeBoundary.startQ(), safeBoundary.startR(), safeBoundary.startLevel()),
                cellRef(safeBoundary.endQ(), safeBoundary.endR(), safeBoundary.endLevel()));
    }

    private static DungeonCellRef cellRef(double q, double r, int level) {
        return new DungeonCellRef((int) Math.round(q), (int) Math.round(r), level);
    }

    private static DungeonTopologyElementRef topologyRef(String kind, long id) {
        return new DungeonTopologyElementRef(topologyElementKind(kind), id);
    }

    private static DungeonTopologyElementKind topologyElementKind(String value) {
        try {
            return DungeonTopologyElementKind.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    private static DungeonEditorTool tool(String value) {
        try {
            return DungeonEditorTool.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonEditorTool.SELECT;
        }
    }

    private static DungeonEditorViewMode viewMode(String value) {
        return "GRAPH".equals(normalizedEnumName(value))
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    private static DungeonBoundaryKind boundaryKind(String value) {
        return "DOOR".equals(normalizedEnumName(value)) ? DungeonBoundaryKind.DOOR : DungeonBoundaryKind.WALL;
    }

    private static DungeonEditorHandleKind handleKind(String value) {
        try {
            return DungeonEditorHandleKind.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonEditorHandleKind.CLUSTER_LABEL;
        }
    }

    private static String normalizedEnumName(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }
}
