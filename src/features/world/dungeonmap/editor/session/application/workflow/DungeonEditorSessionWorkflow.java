package features.world.dungeonmap.editor.session.application.workflow;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.loading.application.DungeonEditorLoadState;
import features.world.dungeonmap.editor.application.DungeonEditorService;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.dungeonmap.catalog.model.DungeonMap;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonEditorSessionWorkflow {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonEditorService editorService;
    private final DungeonEditorSessionAsyncRunner asyncRunner;
    private final Object stateLock = new Object();
    private final DungeonEditorReloadLifecycle reloadLifecycle = new DungeonEditorReloadLifecycle(stateLock);
    private final DungeonEditorEditLifecycle editLifecycle;

    public DungeonEditorSessionWorkflow(
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService,
            DungeonEditorSessionAsyncRunner asyncRunner
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.editorService = Objects.requireNonNull(editorService, "editorService");
        this.asyncRunner = Objects.requireNonNull(asyncRunner, "asyncRunner");
        this.editLifecycle = new DungeonEditorEditLifecycle(editorService, asyncRunner, reloadLifecycle, stateLock);
    }

    public void refreshMapsAndLayout(
            Long preferredMapId,
            Consumer<DungeonEditorLoadState> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        DungeonEditorSessionAsyncRunner.CancellationHandle handleToCancel;
        long request;
        synchronized (stateLock) {
            handleToCancel = editLifecycle.invalidateSessionForReload();
            request = reloadLifecycle.beginReload();
        }
        handleToCancel.cancel();
        asyncRunner.submit(
                mapCatalogService::getAllMaps,
                maps -> handleMapsLoaded(request, maps, preferredMapId, onSuccess, onFailure),
                throwable -> deliverLoadFailure(request, throwable, onFailure));
    }

    public void submitEdit(
            long mapId,
            DungeonEditorEditCommand command,
            Consumer<DungeonLayoutEditResult> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        editLifecycle.submitEdit(mapId, command, onSuccess, onFailure);
    }

    public Long sessionMapId() {
        return reloadLifecycle.sessionMapId();
    }

    public Long activeEditSessionId() {
        synchronized (stateLock) {
            return reloadLifecycle.editingEnabled() ? reloadLifecycle.sessionMapId() : null;
        }
    }

    public boolean editingEnabled() {
        return reloadLifecycle.editingEnabled();
    }

    private void handleMapsLoaded(
            long request,
            List<DungeonMap> maps,
            Long preferredMapId,
            Consumer<DungeonEditorLoadState> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        if (!reloadLifecycle.isCurrentRequest(request)) {
            return;
        }
        if (maps.isEmpty()) {
            if (!reloadLifecycle.finishReload(request, null)) {
                return;
            }
            onSuccess.accept(DungeonEditorLoadState.empty(maps));
            return;
        }
        Long selectedMapId = resolveMapSelection(maps, preferredMapId);
        asyncRunner.submit(
                () -> editorService.loadLayout(selectedMapId),
                layout -> {
                    if (!reloadLifecycle.finishReload(request, selectedMapId)) {
                        return;
                    }
                    onSuccess.accept(new DungeonEditorLoadState(List.copyOf(maps), selectedMapId, layout));
                },
                throwable -> deliverLoadFailure(request, throwable, onFailure));
    }

    private void deliverLoadFailure(
            long request,
            Throwable throwable,
            Consumer<Throwable> onFailure
    ) {
        if (!reloadLifecycle.finishReload(request, null)) {
            return;
        }
        onFailure.accept(throwable);
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
