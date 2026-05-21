package src.domain.dungeon;

import java.util.ArrayList;
import java.util.Objects;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorPaintRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSelectionUseCase;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryKindInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.CellInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.HandleInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.HandleKindInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.PointerTargetInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.TargetKindInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyKindInput;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyRefInput;
import src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.editor.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.editor.usecase.ShiftDungeonEditorProjectionLevelUseCase;
import src.domain.dungeon.published.CreateDungeonEditorCorridorCommand;
import src.domain.dungeon.published.CreateDungeonEditorDoorCommand;
import src.domain.dungeon.published.CreateDungeonEditorWallCommand;
import src.domain.dungeon.published.DeleteDungeonEditorCorridorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorDoorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorRoomCommand;
import src.domain.dungeon.published.DeleteDungeonEditorWallCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorBoundaryTargetRef;
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
        Objects.requireNonNull(command, "command");
        ArrayList<SaveDungeonEditorRoomNarrationUseCase.ExitInput> exits =
                new ArrayList<>(command.exits().size());
        for (int index = 0; index < command.exits().size(); index++) {
            exits.add(new SaveDungeonEditorRoomNarrationUseCase.ExitInput(
                    command.exits().get(index).label(),
                    command.exits().get(index).q(),
                    command.exits().get(index).r(),
                    command.exits().get(index).level(),
                    command.exits().get(index).direction(),
                    command.exits().get(index).description()));
        }
        saveRoomNarrationUseCase.execute(new SaveDungeonEditorRoomNarrationUseCase.RoomNarrationInput(
                command.roomId(),
                command.visualDescription(),
                exits));
    }

    private static MainViewInput toMainViewInput(DungeonEditorPointerSample pointer) {
        if (pointer == null) {
            return MainViewInput.empty();
        }
        return new MainViewInput(
                pointer.canvasX(),
                pointer.canvasY(),
                pointer.primaryButtonDown(),
                pointer.secondaryButtonDown(),
                toPointerTargetInput(pointer.target()));
    }

    private static PointerTargetInput toPointerTargetInput(DungeonEditorPointerTarget target) {
        if (target == null) {
            return PointerTargetInput.empty();
        }
        return new PointerTargetInput(
                TargetKindInput.fromName(target.targetKind().name()),
                TopologyKindInput.fromName(target.elementKind().name()),
                target.ownerId(),
                target.clusterId(),
                toTopologyRefInput(target.topologyRef()),
                toHandleInput(target.handleRef()),
                toBoundaryInput(target.boundaryRef()));
    }

    private static TopologyRefInput toTopologyRefInput(DungeonTopologyElementRef topologyRef) {
        if (topologyRef == null) {
            return TopologyRefInput.empty();
        }
        return new TopologyRefInput(
                TopologyKindInput.fromName(topologyRef.kind().name()),
                topologyRef.id());
    }

    private static HandleInput toHandleInput(DungeonEditorHandleRef handleRef) {
        if (handleRef == null) {
            return HandleInput.empty();
        }
        return new HandleInput(
                HandleKindInput.fromName(handleRef.kind().name()),
                toTopologyRefInput(handleRef.topologyRef()),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                toCellInput(handleRef.cell()),
                handleRef.direction());
    }

    private static BoundaryInput toBoundaryInput(DungeonEditorBoundaryTargetRef boundaryRef) {
        if (boundaryRef == null) {
            return BoundaryInput.empty();
        }
        return new BoundaryInput(
                BoundaryKindInput.fromName(boundaryRef.kind().name()),
                boundaryRef.key(),
                boundaryRef.ownerId(),
                toTopologyRefInput(boundaryRef.topologyRef()),
                toCellInput(boundaryRef.start()),
                toCellInput(boundaryRef.end()));
    }

    private static CellInput toCellInput(DungeonCellRef cell) {
        if (cell == null) {
            return CellInput.empty();
        }
        return new CellInput(cell.q(), cell.r(), cell.level());
    }

}
