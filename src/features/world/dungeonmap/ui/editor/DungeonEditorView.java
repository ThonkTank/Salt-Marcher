package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonRoomSummary;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.shared.DungeonSplitWorkspace;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.MessageDropdown;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

public final class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonEditorStatePane statePane = new DungeonEditorStatePane();
    private final DungeonSplitWorkspace workspace = new DungeonSplitWorkspace(true);
    private final DungeonEditorApplicationService applicationService = new DungeonEditorApplicationService();
    private final DetailsNavigator detailsNavigator;
    private final MessageDropdown messageDropdown = new MessageDropdown();
    private final AtomicLong loadSequence = new AtomicLong();

    private Long currentMapId;
    private DungeonLayout currentLayout;
    private DungeonRoom selectedRoom;
    private boolean initialLoadDone;

    public DungeonEditorView(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        workspace.setOnRoomSelected(this::selectRoom);
        workspace.setOnRoomMoved(this::moveRoom);
        controls.setOnMapSelected(this::loadLayoutAsync);
        controls.setOnReloadRequested(this::reloadCurrentMap);
        statePane.setOnCreateMap(this::createMap);
        statePane.setOnRenameMap(this::renameMap, () -> currentMapId);
        statePane.setOnAddRoom(this::addRoom);
        statePane.setOnDeleteRoom(this::deleteRoom, () -> selectedRoom);
        statePane.setOnAddCorridor(roomIds -> connectRooms(roomIds[0], roomIds[1]));
        statePane.setOnDeleteCorridor(corridor -> deleteCorridor(corridor.corridorId()));
    }

    @Override
    public Node getMainContent() {
        return workspace;
    }

    @Override
    public String getTitle() {
        return "Dungeon-Editor";
    }

    @Override
    public String getIconText() {
        return "\u25A6";
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public Node getStateContent() {
        return statePane;
    }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            loadMaps();
            initialLoadDone = true;
        }
    }

    private void loadMaps() {
        applicationService.loadMaps(maps -> {
            if (maps.isEmpty()) {
                createMap("Dungeon");
                return;
            }
            controls.setMaps(maps);
            Long nextMapId = currentMapId != null ? currentMapId : maps.get(0).mapId();
            controls.selectMap(nextMapId);
            loadLayoutAsync(nextMapId);
        }, throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.loadMaps()", throwable));
    }

    private void loadLayoutAsync(Long mapId) {
        if (mapId == null) {
            return;
        }
        currentMapId = mapId;
        long request = loadSequence.incrementAndGet();
        applicationService.loadLayout(mapId, layout -> {
            if (request != loadSequence.get()) {
                return;
            }
            currentLayout = layout;
            selectedRoom = null;
            controls.selectMap(mapId);
            render();
        }, throwable -> {
            if (request != loadSequence.get()) {
                return;
            }
            UiErrorReporter.reportBackgroundFailure("DungeonEditorView.loadLayoutAsync()", throwable);
            messageDropdown.show(controls, "Dungeon konnte nicht geladen werden", "Bitte Datenbankstatus prüfen.");
        });
    }

    private void render() {
        controls.setSelectionText(selectedRoom == null ? "Kein Raum gewählt" : selectedRoom.name());
        Long selectedRoomId = selectedRoom == null ? null : selectedRoom.roomId();
        workspace.showLayout(currentLayout, selectedRoomId, null);
        statePane.bindLayout(currentLayout, selectedRoom);
    }

    private void selectRoom(DungeonRoom room) {
        selectedRoom = room;
        detailsNavigator.showDungeonRoom(new DungeonRoomSummary(
                room.roomId(),
                room.mapId(),
                room.name(),
                room.center().x(),
                room.center().y(),
                room.relativeVertices().size(),
                false));
        render();
    }

    private void moveRoom(DungeonRoom room, Point2i center) {
        if (room.roomId() == null) {
            return;
        }
        applicationService.moveRoom(room.roomId(), room.name(), center,
                this::reloadCurrentMap,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.moveRoom()", throwable));
    }

    private void createMap(String name) {
        applicationService.createMap(name, mapId -> {
            loadMaps();
            loadLayoutAsync(mapId);
        }, throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.createMap()", throwable));
    }

    private void renameMap(long mapId, String name) {
        applicationService.renameMap(mapId, name,
                this::reloadCurrentMap,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.renameMap()", throwable));
    }

    private void addRoom() {
        if (currentMapId == null) {
            return;
        }
        applicationService.addRoom(currentMapId,
                roomId -> reloadCurrentMap(),
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.addRoom()", throwable));
    }

    private void deleteRoom(DungeonRoom room) {
        if (room == null || room.roomId() == null) {
            return;
        }
        applicationService.deleteRoom(room.roomId(),
                this::reloadCurrentMap,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.deleteRoom()", throwable));
    }

    private void connectRooms(long fromRoomId, long toRoomId) {
        if (currentMapId == null) {
            return;
        }
        applicationService.connectRooms(currentMapId, fromRoomId, toRoomId,
                this::reloadCurrentMap,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.connectRooms()", throwable));
    }

    private void deleteCorridor(Long corridorId) {
        if (corridorId == null) {
            return;
        }
        applicationService.deleteCorridor(corridorId,
                this::reloadCurrentMap,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.deleteCorridor()", throwable));
    }

    private void reloadCurrentMap() {
        if (currentMapId != null) {
            loadLayoutAsync(currentMapId);
        } else {
            loadMaps();
        }
    }
}
