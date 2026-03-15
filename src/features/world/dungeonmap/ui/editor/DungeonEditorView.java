package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonRoomSummary;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.DungeonAsyncService;
import features.world.dungeonmap.ui.shared.workspace.DungeonSplitWorkspace;
import features.world.dungeonmap.ui.shared.workspace.DungeonViewMode;
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
    private final DungeonAsyncService applicationService = new DungeonAsyncService();
    private final DetailsNavigator detailsNavigator;
    private final MessageDropdown messageDropdown = new MessageDropdown();
    private final AtomicLong loadSequence = new AtomicLong();

    private Long currentMapId;
    private DungeonLayout currentLayout;
    private DungeonRoom selectedRoom;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private boolean initialLoadDone;

    public DungeonEditorView(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        workspace.setOnRoomSelected(this::selectRoom);
        workspace.setOnRoomMoved(this::moveRoom);
        controls.setOnMapSelected(this::loadLayoutAsync);
        controls.setOnReloadRequested(this::reloadCurrentMap);
        controls.setOnViewModeChanged(this::setViewMode);
        statePane.setOnCreateMap(this::createMap);
        statePane.setOnUpdateMap(this::updateMap, () -> currentMapId);
        statePane.setOnAddRoom(this::addRoom);
        statePane.setOnDeleteRoom(this::deleteRoom, () -> selectedRoom);
        statePane.setOnAddCorridor(request -> connectRooms(request.fromRoomId(), request.toRoomId()));
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
            refreshMapsAndLayout(currentMapId);
            initialLoadDone = true;
        }
    }

    private void loadLayoutAsync(Long mapId) {
        if (mapId == null) {
            return;
        }
        long request = loadSequence.incrementAndGet();
        showLayoutForMap(request, mapId);
    }

    private void render() {
        controls.setSelectionText(selectedRoom == null ? "Kein Raum gewählt" : selectedRoom.name());
        controls.selectViewMode(viewMode);
        workspace.setViewMode(viewMode);
        Long selectedRoomId = selectedRoom == null ? null : selectedRoom.roomId();
        workspace.showLayout(currentLayout, selectedRoomId, null);
        statePane.bindLayout(currentLayout, selectedRoom);
    }

    private void renderSelection() {
        controls.setSelectionText(selectedRoom == null ? "Kein Raum gewählt" : selectedRoom.name());
        workspace.updateSelection(selectedRoom == null ? null : selectedRoom.roomId(), null);
        statePane.setSelectedRoom(selectedRoom);
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
        renderSelection();
    }

    private void moveRoom(DungeonRoom room, Point2i center) {
        if (room.roomId() == null) {
            return;
        }
        applicationService.moveRoom(room.roomId(), room.name(), center,
                () -> applyMovedRoom(room.roomId(), center),
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.moveRoom()", throwable));
    }

    private void createMap(String name) {
        applicationService.createMap(name, mapId -> {
            refreshMapsAndLayout(mapId);
        }, throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.createMap()", throwable));
    }

    private void updateMap(long mapId, String name) {
        applicationService.renameMap(mapId, name,
                this::reloadCurrentMap,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.updateMap()", throwable));
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
        refreshMapsAndLayout(currentMapId);
    }

    private void setViewMode(DungeonViewMode viewMode) {
        this.viewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        workspace.setViewMode(this.viewMode);
    }

    private void applyMovedRoom(Long roomId, Point2i center) {
        if (currentLayout == null || roomId == null || center == null) {
            reloadCurrentMap();
            return;
        }
        List<DungeonRoom> updatedRooms = currentLayout.rooms().stream()
                .map(room -> room.roomId() != null && room.roomId().equals(roomId)
                        ? new DungeonRoom(room.roomId(), room.mapId(), room.name(), center, room.relativeVertices())
                        : room)
                .toList();
        currentLayout = new DungeonLayout(currentLayout.map(), updatedRooms, currentLayout.corridors());
        if (selectedRoom != null && selectedRoom.roomId() != null && selectedRoom.roomId().equals(roomId)) {
            selectedRoom = new DungeonRoom(selectedRoom.roomId(), selectedRoom.mapId(), selectedRoom.name(), center, selectedRoom.relativeVertices());
        }
        render();
    }

    private void refreshMapsAndLayout(Long preferredMapId) {
        long request = loadSequence.incrementAndGet();
        applicationService.loadMaps(maps -> {
            if (request != loadSequence.get()) {
                return;
            }
            if (maps.isEmpty()) {
                createMap("Dungeon");
                return;
            }
            controls.setMaps(maps);
            Long nextMapId = resolveMapSelection(maps, preferredMapId);
            controls.selectMap(nextMapId);
            showLayoutForMap(request, nextMapId);
        }, throwable -> {
            if (request != loadSequence.get()) {
                return;
            }
            UiErrorReporter.reportBackgroundFailure("DungeonEditorView.refreshMapsAndLayout()", throwable);
        });
    }

    private void showLayoutForMap(long request, Long mapId) {
        if (mapId == null) {
            return;
        }
        currentMapId = mapId;
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
            UiErrorReporter.reportBackgroundFailure("DungeonEditorView.showLayoutForMap()", throwable);
            messageDropdown.show(controls, "Dungeon konnte nicht geladen werden", "Bitte Datenbankstatus prüfen.");
        });
    }

    private static Long resolveMapSelection(List<DungeonMap> maps, Long preferredMapId) {
        if (preferredMapId != null) {
            for (DungeonMap map : maps) {
                if (preferredMapId.equals(map.mapId())) {
                    return preferredMapId;
                }
            }
        }
        return maps.get(0).mapId();
    }
}
