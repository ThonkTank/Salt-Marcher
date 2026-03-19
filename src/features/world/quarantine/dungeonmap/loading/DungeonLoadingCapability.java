package features.world.quarantine.dungeonmap.loading;

import features.world.quarantine.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;
import features.world.quarantine.dungeonmap.editor.DungeonEditorService;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.foundation.async.DungeonAsyncRunner;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonLoadingCapability {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonEditorService editorService;
    private final DungeonAsyncRunner asyncRunner;

    private long generation;
    private Long sessionMapId;
    private boolean editingEnabled;

    public DungeonLoadingCapability(
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService,
            DungeonAsyncRunner asyncRunner
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.editorService = Objects.requireNonNull(editorService, "editorService");
        this.asyncRunner = Objects.requireNonNull(asyncRunner, "asyncRunner");
    }

    public void loadInitial(Consumer<DungeonLoadingState> onSuccess, Consumer<Throwable> onFailure) {
        load(sessionMapId(), onSuccess, onFailure);
    }

    public void load(Long preferredMapId, Consumer<DungeonLoadingState> onSuccess, Consumer<Throwable> onFailure) {
        Objects.requireNonNull(onSuccess, "onSuccess");
        Objects.requireNonNull(onFailure, "onFailure");
        long request = beginLoad();
        asyncRunner.submit(
                () -> prepareLoad(preferredMapId),
                result -> finishLoad(request, result, onSuccess),
                throwable -> failLoad(request, throwable, onFailure));
    }

    public void reloadCurrent(Consumer<DungeonLoadingState> onSuccess, Consumer<Throwable> onFailure) {
        load(sessionMapId(), onSuccess, onFailure);
    }

    public void submitEdit(
            DungeonEditorEditCommand command,
            Consumer<DungeonLayoutEditResult> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        Objects.requireNonNull(command, "command");
        Objects.requireNonNull(onSuccess, "onSuccess");
        Objects.requireNonNull(onFailure, "onFailure");
        long request;
        Long mapId;
        synchronized (this) {
            if (!editingEnabled || sessionMapId == null) {
                return;
            }
            request = generation;
            mapId = sessionMapId;
        }
        asyncRunner.submit(
                () -> editorService.applyEdit(mapId, command),
                result -> {
                    if (isCurrent(request, mapId)) {
                        onSuccess.accept(result);
                    }
                },
                throwable -> {
                    if (isCurrent(request, mapId)) {
                        onFailure.accept(throwable);
                    }
                });
    }

    public synchronized Long sessionMapId() {
        return sessionMapId;
    }

    public synchronized Long activeEditSessionId() {
        return editingEnabled ? sessionMapId : null;
    }

    public synchronized boolean editingEnabled() {
        return editingEnabled;
    }

    private synchronized long beginLoad() {
        generation++;
        editingEnabled = false;
        return generation;
    }

    private synchronized boolean isCurrent(long request, Long mapId) {
        return generation == request && editingEnabled && Objects.equals(sessionMapId, mapId);
    }

    private void finishLoad(
            long request,
            DungeonLoadingState result,
            Consumer<DungeonLoadingState> onSuccess
    ) {
        synchronized (this) {
            if (generation != request) {
                return;
            }
            sessionMapId = result == null ? null : result.selectedMapId();
            editingEnabled = sessionMapId != null;
        }
        onSuccess.accept(result);
    }

    private void failLoad(
            long request,
            Throwable throwable,
            Consumer<Throwable> onFailure
    ) {
        synchronized (this) {
            if (generation != request) {
                return;
            }
            sessionMapId = null;
            editingEnabled = false;
        }
        onFailure.accept(throwable);
    }

    private DungeonLoadingState prepareLoad(Long preferredMapId) throws Exception {
        List<DungeonMap> maps = mapCatalogService.getAllMaps();
        if (maps.isEmpty()) {
            return DungeonLoadingState.empty(maps);
        }
        Long selectedMapId = resolveMapSelection(maps, preferredMapId);
        DungeonLayout layout = editorService.loadLayout(selectedMapId);
        return DungeonLoadingState.prepared(maps, selectedMapId, layout);
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
