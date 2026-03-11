package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.service.adapter.DungeonEncounterTableCatalogAdapter;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorApplicationService {

    public void loadMapList(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        Task<List<DungeonMap>> task = new Task<>() {
            @Override
            protected List<DungeonMap> call() throws Exception {
                return DungeonMapQueryService.getAllMaps();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void loadEncounterTables(Consumer<List<DungeonEncounterTableSummary>> onSuccess, Consumer<Throwable> onError) {
        Task<List<DungeonEncounterTableSummary>> task = new Task<>() {
            @Override
            protected List<DungeonEncounterTableSummary> call() {
                return DungeonEncounterTableCatalogAdapter.loadSummaries();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void loadMap(long mapId, Consumer<DungeonMapState> onSuccess, Consumer<Throwable> onError) {
        Task<DungeonMapState> task = new Task<>() {
            @Override
            protected DungeonMapState call() throws Exception {
                return DungeonMapQueryService.loadMapState(mapId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void createMap(String name, int width, int height, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return DungeonMapEditorService.createMap(name, width, height);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void updateMap(long mapId, String name, int width, int height, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.updateMap(mapId, name, width, height);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void applySquarePaints(long mapId, List<DungeonSquarePaint> paints, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.applySquarePaints(mapId, paints);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void saveRoom(DungeonRoom room, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return DungeonMapEditorService.saveRoom(room);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void deleteRoom(long roomId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.deleteRoom(roomId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void assignSquareRoom(long squareId, Long roomId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.assignSquareRoom(squareId, roomId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void saveArea(DungeonArea area, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return DungeonMapEditorService.saveArea(area);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void deleteArea(long areaId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.deleteArea(areaId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void assignRoomArea(long roomId, Long areaId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.assignRoomArea(roomId, areaId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void saveEndpoint(DungeonEndpoint endpoint, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return DungeonMapEditorService.saveEndpoint(endpoint);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void deleteEndpoint(long endpointId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.deleteEndpoint(endpointId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void createLink(
            long mapId,
            long fromEndpointId,
            long toEndpointId,
            Consumer<DungeonMapEditorService.LinkCreateResult> onSuccess,
            Consumer<Throwable> onError
    ) {
        Task<DungeonMapEditorService.LinkCreateResult> task = new Task<>() {
            @Override
            protected DungeonMapEditorService.LinkCreateResult call() throws Exception {
                return DungeonMapEditorService.createLink(mapId, fromEndpointId, toEndpointId, "");
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void deleteLink(long linkId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.deleteLink(linkId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void updateLinkLabel(long linkId, String label, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapEditorService.updateLinkLabel(linkId, label);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }
}
