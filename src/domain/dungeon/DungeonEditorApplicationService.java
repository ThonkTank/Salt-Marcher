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
import src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.BoundaryInput;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.CellInput;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.HandleInput;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.PointerTargetInput;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.TopologyRefInput;
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
import src.domain.dungeon.published.DungeonEditorSelectionCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
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
        applySelectionUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void dragSelection(DungeonEditorSelectionCommand command) {
        applySelectionUseCase.drag(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void releaseSelection(DungeonEditorSelectionCommand command) {
        applySelectionUseCase.release(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void hoverSelection(DungeonEditorSelectionCommand command) {
        applySelectionUseCase.hover(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void scrollSelection(ShiftDungeonEditorProjectionLevelCommand command) {
        applySelectionUseCase.scroll(command.projectionLevelDelta());
    }

    public void pressPaintRoom(PaintDungeonEditorRoomCommand command) {
        applyPaintRoomUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void dragPaintRoom(PaintDungeonEditorRoomCommand command) {
        applyPaintRoomUseCase.drag(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void releasePaintRoom(PaintDungeonEditorRoomCommand command) {
        applyPaintRoomUseCase.release(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void pressDeleteRoom(DeleteDungeonEditorRoomCommand command) {
        applyDeleteRoomUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void dragDeleteRoom(DeleteDungeonEditorRoomCommand command) {
        applyDeleteRoomUseCase.drag(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void releaseDeleteRoom(DeleteDungeonEditorRoomCommand command) {
        applyDeleteRoomUseCase.release(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void pressCreateWall(CreateDungeonEditorWallCommand command) {
        applyCreateWallUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void dragCreateWall(CreateDungeonEditorWallCommand command) {
        applyCreateWallUseCase.drag(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void hoverCreateWall(CreateDungeonEditorWallCommand command) {
        applyCreateWallUseCase.hover(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void pressDeleteWall(DeleteDungeonEditorWallCommand command) {
        applyDeleteWallUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void dragDeleteWall(DeleteDungeonEditorWallCommand command) {
        applyDeleteWallUseCase.drag(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void hoverDeleteWall(DeleteDungeonEditorWallCommand command) {
        applyDeleteWallUseCase.hover(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void pressCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void dragCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.drag(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void releaseCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.release(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void hoverCreateDoor(CreateDungeonEditorDoorCommand command) {
        applyCreateDoorUseCase.hover(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void pressDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void dragDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.drag(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void releaseDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.release(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void hoverDeleteDoor(DeleteDungeonEditorDoorCommand command) {
        applyDeleteDoorUseCase.hover(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void pressCreateCorridor(CreateDungeonEditorCorridorCommand command) {
        applyCreateCorridorUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void hoverCreateCorridor(CreateDungeonEditorCorridorCommand command) {
        applyCreateCorridorUseCase.hover(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void pressDeleteCorridor(DeleteDungeonEditorCorridorCommand command) {
        applyDeleteCorridorUseCase.press(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
    }

    public void hoverDeleteCorridor(DeleteDungeonEditorCorridorCommand command) {
        applyDeleteCorridorUseCase.hover(toMainViewInput(
                command.pointer().canvasX(),
                command.pointer().canvasY(),
                command.pointer().primaryButtonDown(),
                command.pointer().secondaryButtonDown(),
                command.pointer().target().targetKind().name(),
                command.pointer().target().elementKind().name(),
                command.pointer().target().ownerId(),
                command.pointer().target().clusterId(),
                command.pointer().target().topologyRef().kind().name(),
                command.pointer().target().topologyRef().id(),
                command.pointer().target().handleRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().kind().name(),
                command.pointer().target().handleRef().topologyRef().id(),
                command.pointer().target().handleRef().ownerId(),
                command.pointer().target().handleRef().clusterId(),
                command.pointer().target().handleRef().corridorId(),
                command.pointer().target().handleRef().roomId(),
                command.pointer().target().handleRef().index(),
                command.pointer().target().handleRef().cell().q(),
                command.pointer().target().handleRef().cell().r(),
                command.pointer().target().handleRef().cell().level(),
                command.pointer().target().handleRef().direction(),
                command.pointer().target().boundaryRef().kind().name(),
                command.pointer().target().boundaryRef().key(),
                command.pointer().target().boundaryRef().ownerId(),
                command.pointer().target().boundaryRef().topologyRef().kind().name(),
                command.pointer().target().boundaryRef().topologyRef().id(),
                command.pointer().target().boundaryRef().start().q(),
                command.pointer().target().boundaryRef().start().r(),
                command.pointer().target().boundaryRef().start().level(),
                command.pointer().target().boundaryRef().end().q(),
                command.pointer().target().boundaryRef().end().r(),
                command.pointer().target().boundaryRef().end().level()));
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

    private static MainViewInput toMainViewInput(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String targetKind,
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            String handleKind,
            String handleTopologyKind,
            long handleTopologyId,
            long handleOwnerId,
            long handleClusterId,
            long handleCorridorId,
            long handleRoomId,
            int handleIndex,
            int handleCellQ,
            int handleCellR,
            int handleCellLevel,
            String handleDirection,
            String boundaryKind,
            String boundaryKey,
            long boundaryOwnerId,
            String boundaryTopologyKind,
            long boundaryTopologyId,
            int boundaryStartQ,
            int boundaryStartR,
            int boundaryStartLevel,
            int boundaryEndQ,
            int boundaryEndR,
            int boundaryEndLevel
    ) {
        return new MainViewInput(
                canvasX,
                canvasY,
                primaryButtonDown,
                secondaryButtonDown,
                new PointerTargetInput(
                        targetKind,
                        elementKind,
                        ownerId,
                        clusterId,
                        new TopologyRefInput(topologyKind, topologyId),
                        new HandleInput(
                                handleKind,
                                new TopologyRefInput(handleTopologyKind, handleTopologyId),
                                handleOwnerId,
                                handleClusterId,
                                handleCorridorId,
                                handleRoomId,
                                handleIndex,
                                new CellInput(handleCellQ, handleCellR, handleCellLevel),
                                handleDirection),
                        new BoundaryInput(
                                boundaryKind,
                                boundaryKey,
                                boundaryOwnerId,
                                new TopologyRefInput(boundaryTopologyKind, boundaryTopologyId),
                                new CellInput(boundaryStartQ, boundaryStartR, boundaryStartLevel),
                                new CellInput(boundaryEndQ, boundaryEndR, boundaryEndLevel))));
    }

}
