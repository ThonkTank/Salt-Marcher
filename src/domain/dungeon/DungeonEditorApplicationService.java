package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorPaintRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSelectionUseCase;
import src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.editor.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.editor.usecase.ShiftDungeonEditorProjectionLevelUseCase;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.CreateDungeonEditorCorridorCommand;
import src.domain.dungeon.published.CreateDungeonEditorDoorCommand;
import src.domain.dungeon.published.CreateDungeonEditorWallCommand;
import src.domain.dungeon.published.DeleteDungeonEditorCorridorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorDoorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorRoomCommand;
import src.domain.dungeon.published.DeleteDungeonEditorWallCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorPointerSample;
import src.domain.dungeon.published.DungeonEditorPointerTarget;
import src.domain.dungeon.published.DungeonEditorSelectionCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.PaintDungeonEditorRoomCommand;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand;
import src.domain.dungeon.published.SetDungeonEditorOverlayCommand;
import src.domain.dungeon.published.SetDungeonEditorToolCommand;
import src.domain.dungeon.published.SetDungeonEditorViewModeCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;

public final class DungeonEditorApplicationService {

    private final SelectDungeonEditorMapUseCase selectMapUseCase;
    private final CreateDungeonEditorMapUseCase createMapUseCase;
    private final RenameDungeonEditorMapUseCase renameMapUseCase;
    private final DeleteDungeonEditorMapUseCase deleteMapUseCase;
    private final SetDungeonEditorViewModeUseCase setViewModeUseCase;
    private final SetDungeonEditorToolUseCase setToolUseCase;
    private final ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase;
    private final SetDungeonEditorOverlayUseCase setOverlayUseCase;
    private final ApplyDungeonEditorSelectionUseCase applySelectionUseCase;
    private final ApplyDungeonEditorPaintRoomUseCase applyPaintRoomUseCase;
    private final ApplyDungeonEditorDeleteRoomUseCase applyDeleteRoomUseCase;
    private final ApplyDungeonEditorCreateWallUseCase applyCreateWallUseCase;
    private final ApplyDungeonEditorDeleteWallUseCase applyDeleteWallUseCase;
    private final ApplyDungeonEditorCreateDoorUseCase applyCreateDoorUseCase;
    private final ApplyDungeonEditorDeleteDoorUseCase applyDeleteDoorUseCase;
    private final ApplyDungeonEditorCreateCorridorUseCase applyCreateCorridorUseCase;
    private final ApplyDungeonEditorDeleteCorridorUseCase applyDeleteCorridorUseCase;
    private final SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase;

    DungeonEditorApplicationService(
            SelectDungeonEditorMapUseCase selectMapUseCase,
            CreateDungeonEditorMapUseCase createMapUseCase,
            RenameDungeonEditorMapUseCase renameMapUseCase,
            DeleteDungeonEditorMapUseCase deleteMapUseCase,
            SetDungeonEditorViewModeUseCase setViewModeUseCase,
            SetDungeonEditorToolUseCase setToolUseCase,
            ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase,
            SetDungeonEditorOverlayUseCase setOverlayUseCase,
            ApplyDungeonEditorSelectionUseCase applySelectionUseCase,
            ApplyDungeonEditorPaintRoomUseCase applyPaintRoomUseCase,
            ApplyDungeonEditorDeleteRoomUseCase applyDeleteRoomUseCase,
            ApplyDungeonEditorCreateWallUseCase applyCreateWallUseCase,
            ApplyDungeonEditorDeleteWallUseCase applyDeleteWallUseCase,
            ApplyDungeonEditorCreateDoorUseCase applyCreateDoorUseCase,
            ApplyDungeonEditorDeleteDoorUseCase applyDeleteDoorUseCase,
            ApplyDungeonEditorCreateCorridorUseCase applyCreateCorridorUseCase,
            ApplyDungeonEditorDeleteCorridorUseCase applyDeleteCorridorUseCase,
            SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase
    ) {
        this.selectMapUseCase = Objects.requireNonNull(selectMapUseCase, "selectMapUseCase");
        this.createMapUseCase = Objects.requireNonNull(createMapUseCase, "createMapUseCase");
        this.renameMapUseCase = Objects.requireNonNull(renameMapUseCase, "renameMapUseCase");
        this.deleteMapUseCase = Objects.requireNonNull(deleteMapUseCase, "deleteMapUseCase");
        this.setViewModeUseCase = Objects.requireNonNull(setViewModeUseCase, "setViewModeUseCase");
        this.setToolUseCase = Objects.requireNonNull(setToolUseCase, "setToolUseCase");
        this.shiftProjectionLevelUseCase =
                Objects.requireNonNull(shiftProjectionLevelUseCase, "shiftProjectionLevelUseCase");
        this.setOverlayUseCase = Objects.requireNonNull(setOverlayUseCase, "setOverlayUseCase");
        this.applySelectionUseCase = Objects.requireNonNull(applySelectionUseCase, "applySelectionUseCase");
        this.applyPaintRoomUseCase = Objects.requireNonNull(applyPaintRoomUseCase, "applyPaintRoomUseCase");
        this.applyDeleteRoomUseCase = Objects.requireNonNull(applyDeleteRoomUseCase, "applyDeleteRoomUseCase");
        this.applyCreateWallUseCase = Objects.requireNonNull(applyCreateWallUseCase, "applyCreateWallUseCase");
        this.applyDeleteWallUseCase = Objects.requireNonNull(applyDeleteWallUseCase, "applyDeleteWallUseCase");
        this.applyCreateDoorUseCase = Objects.requireNonNull(applyCreateDoorUseCase, "applyCreateDoorUseCase");
        this.applyDeleteDoorUseCase = Objects.requireNonNull(applyDeleteDoorUseCase, "applyDeleteDoorUseCase");
        this.applyCreateCorridorUseCase =
                Objects.requireNonNull(applyCreateCorridorUseCase, "applyCreateCorridorUseCase");
        this.applyDeleteCorridorUseCase =
                Objects.requireNonNull(applyDeleteCorridorUseCase, "applyDeleteCorridorUseCase");
        this.saveRoomNarrationUseCase = Objects.requireNonNull(saveRoomNarrationUseCase, "saveRoomNarrationUseCase");
    }

    public void selectMap(DungeonAuthoredReadCommand command) {
        Objects.requireNonNull(command, "command");
        selectMapUseCase.execute(command.mapIdValue());
    }

    public void createMap(DungeonMapCatalogCommand.CreateMapCommand command) {
        Objects.requireNonNull(command, "command");
        createMapUseCase.execute(command.mapName());
    }

    public void renameMap(DungeonMapCatalogCommand.RenameMapCommand command) {
        Objects.requireNonNull(command, "command");
        renameMapUseCase.execute(command.mapId().value(), command.mapName());
    }

    public void deleteMap(DeleteDungeonMapCommand command) {
        deleteMapUseCase.execute(command.mapId().value());
    }

    public void setViewMode(SetDungeonEditorViewModeCommand command) {
        setViewModeUseCase.execute(command.viewMode().name());
    }

    public void setTool(SetDungeonEditorToolCommand command) {
        setToolUseCase.execute(command.tool().name());
    }

    public void shiftProjectionLevel(ShiftDungeonEditorProjectionLevelCommand command) {
        shiftProjectionLevelUseCase.execute(command.projectionLevelDelta());
    }

    public void setOverlay(SetDungeonEditorOverlayCommand command) {
        setOverlayUseCase.execute(
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels());
    }

    public void pressSelection(DungeonEditorSelectionCommand command) {
        applySelectionUseCase.press(toMainViewInput(command.pointer()));
    }

    public void dragSelection(DungeonEditorSelectionCommand command) {
        applySelectionUseCase.drag(toMainViewInput(command.pointer()));
    }

    public void releaseSelection(DungeonEditorSelectionCommand command) {
        applySelectionUseCase.release(toMainViewInput(command.pointer()));
    }

    public void hoverSelection(DungeonEditorSelectionCommand command) {
        applySelectionUseCase.hover(toMainViewInput(command.pointer()));
    }

    public void scrollSelection(ShiftDungeonEditorProjectionLevelCommand command) {
        applySelectionUseCase.scroll(command.projectionLevelDelta());
    }

    public void pressPaintRoom(PaintDungeonEditorRoomCommand command) {
        applyPaintRoomUseCase.press(toMainViewInput(command.pointer()));
    }

    public void dragPaintRoom(PaintDungeonEditorRoomCommand command) {
        applyPaintRoomUseCase.drag(toMainViewInput(command.pointer()));
    }

    public void releasePaintRoom(PaintDungeonEditorRoomCommand command) {
        applyPaintRoomUseCase.release(toMainViewInput(command.pointer()));
    }

    public void pressDeleteRoom(DeleteDungeonEditorRoomCommand command) {
        applyDeleteRoomUseCase.press(toMainViewInput(command.pointer()));
    }

    public void dragDeleteRoom(DeleteDungeonEditorRoomCommand command) {
        applyDeleteRoomUseCase.drag(toMainViewInput(command.pointer()));
    }

    public void releaseDeleteRoom(DeleteDungeonEditorRoomCommand command) {
        applyDeleteRoomUseCase.release(toMainViewInput(command.pointer()));
    }

    public void pressCreateWall(CreateDungeonEditorWallCommand command) {
        applyCreateWallUseCase.press(toMainViewInput(command.pointer()));
    }

    public void dragCreateWall(CreateDungeonEditorWallCommand command) {
        applyCreateWallUseCase.drag(toMainViewInput(command.pointer()));
    }

    public void hoverCreateWall(CreateDungeonEditorWallCommand command) {
        applyCreateWallUseCase.hover(toMainViewInput(command.pointer()));
    }

    public void pressDeleteWall(DeleteDungeonEditorWallCommand command) {
        applyDeleteWallUseCase.press(toMainViewInput(command.pointer()));
    }

    public void dragDeleteWall(DeleteDungeonEditorWallCommand command) {
        applyDeleteWallUseCase.drag(toMainViewInput(command.pointer()));
    }

    public void hoverDeleteWall(DeleteDungeonEditorWallCommand command) {
        applyDeleteWallUseCase.hover(toMainViewInput(command.pointer()));
    }

    public void pressCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.press(toMainViewInput(command.pointer()));
    }

    public void dragCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.drag(toMainViewInput(command.pointer()));
    }

    public void releaseCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.release(toMainViewInput(command.pointer()));
    }

    public void hoverCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.hover(toMainViewInput(command.pointer()));
    }

    public void pressDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.press(toMainViewInput(command.pointer()));
    }

    public void dragDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.drag(toMainViewInput(command.pointer()));
    }

    public void releaseDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.release(toMainViewInput(command.pointer()));
    }

    public void hoverDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.hover(toMainViewInput(command.pointer()));
    }

    public void pressCreateCorridor(CreateDungeonEditorCorridorCommand command) {
        applyCreateCorridorUseCase.press(toMainViewInput(command.pointer()));
    }

    public void hoverCreateCorridor(CreateDungeonEditorCorridorCommand command) {
        applyCreateCorridorUseCase.hover(toMainViewInput(command.pointer()));
    }

    public void pressDeleteCorridor(DeleteDungeonEditorCorridorCommand command) {
        applyDeleteCorridorUseCase.press(toMainViewInput(command.pointer()));
    }

    public void hoverDeleteCorridor(DeleteDungeonEditorCorridorCommand command) {
        applyDeleteCorridorUseCase.hover(toMainViewInput(command.pointer()));
    }

    public void saveRoomNarration(SaveDungeonEditorRoomNarrationCommand command) {
        saveRoomNarrationUseCase.execute(toRoomNarrationInput(command));
    }

    private static DungeonEditorRoomNarrationInput toRoomNarrationInput(SaveDungeonEditorRoomNarrationCommand command) {
        return new DungeonEditorRoomNarrationInput(
                command.roomId(),
                command.visualDescription(),
                command.exits().stream()
                        .map(exit -> new DungeonEditorWorkspaceValues.RoomExitNarration(
                                exit.label(),
                                new DungeonEditorWorkspaceValues.Cell(exit.q(), exit.r(), exit.level()),
                                exit.direction(),
                                exit.description()))
                        .toList());
    }

    private static DungeonEditorMainViewInput toMainViewInput(DungeonEditorPointerSample pointer) {
        DungeonEditorPointerSample safePointer = pointer == null
                ? DungeonEditorPointerSample.empty()
                : pointer;
        return new DungeonEditorMainViewInput(
                safePointer.canvasX(),
                safePointer.canvasY(),
                safePointer.primaryButtonDown(),
                safePointer.secondaryButtonDown(),
                toInternalPointerTarget(safePointer.target()));
    }

    private static DungeonEditorMainViewPointerTarget toInternalPointerTarget(
            DungeonEditorPointerTarget target
    ) {
        DungeonEditorPointerTarget safeTarget = target == null ? DungeonEditorPointerTarget.empty() : target;
        return switch (safeTarget.targetKind()) {
            case EMPTY -> DungeonEditorMainViewPointerTarget.empty();
            case CELL -> DungeonEditorMainViewPointerTarget.cell(
                    toInternalTopologyKind(safeTarget.elementKind().name()),
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    toInternalTopologyRef(safeTarget.topologyRef()));
            case LABEL -> DungeonEditorMainViewPointerTarget.label(
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    toInternalTopologyRef(safeTarget.topologyRef()));
            case GRAPH_NODE -> DungeonEditorMainViewPointerTarget.graphNode(
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    toInternalTopologyRef(safeTarget.topologyRef()));
            case HANDLE -> DungeonEditorMainViewPointerTarget.handle(toInternalHandleRef(safeTarget.handleRef()));
            case BOUNDARY -> DungeonEditorMainViewPointerTarget.boundary(
                    toInternalBoundaryKind(safeTarget.boundaryRef().kind().name()),
                    safeTarget.boundaryRef().key(),
                    safeTarget.boundaryRef().ownerId(),
                    toInternalTopologyRef(safeTarget.boundaryRef().topologyRef()),
                    toInternalCellRef(safeTarget.boundaryRef().start()),
                    toInternalCellRef(safeTarget.boundaryRef().end()));
        };
    }

    private static DungeonTopologyRef toInternalTopologyRef(
            DungeonTopologyElementRef topologyRef
    ) {
        DungeonTopologyElementRef safeRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        return new DungeonTopologyRef(
                toInternalTopologyKind(safeRef.kind().name()),
                safeRef.id());
    }

    private static DungeonEditorWorkspaceValues.Cell toInternalCellRef(DungeonCellRef cell) {
        DungeonCellRef safeCell = cell == null ? new DungeonCellRef(0, 0, 0) : cell;
        return new DungeonEditorWorkspaceValues.Cell(
                safeCell.q(),
                safeCell.r(),
                safeCell.level());
    }

    private static DungeonEditorWorkspaceValues.HandleRef toInternalHandleRef(DungeonEditorHandleRef handleRef) {
        DungeonEditorHandleRef safeHandle = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorHandleType.valueOf(DungeonEditorHandleKind.fromName(safeHandle.kind().name()).name()),
                toWorkspaceTopologyRef(safeHandle.topologyRef()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                toInternalCellRef(safeHandle.cell()),
                safeHandle.direction());
    }

    private static DungeonTopologyElementKind toInternalTopologyKind(String name) {
        return DungeonTopologyElementKind.valueOf(name);
    }

    private static DungeonTopologyRef toWorkspaceTopologyRef(DungeonTopologyElementRef topologyRef) {
        DungeonTopologyElementRef safeRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        return new DungeonTopologyRef(
                src.domain.dungeon.model.map.model.DungeonTopologyElementKind.valueOf(safeRef.kind().name()),
                safeRef.id());
    }

    private static DungeonEditorWorkspaceValues.BoundaryKind toInternalBoundaryKind(String name) {
        return DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(name);
    }

}
