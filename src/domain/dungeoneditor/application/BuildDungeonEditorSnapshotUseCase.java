package src.domain.dungeoneditor.application;

import java.util.ArrayList;
import java.util.List;
import java.util.NavigableSet;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Feature;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSummary;

final class BuildDungeonEditorSnapshotUseCase {
    private final Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog;
    private final DungeonEditorSnapshotSurfaceLoader surfaceLoader;

    BuildDungeonEditorSnapshotUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.catalog = catalog;
        this.surfaceLoader = new DungeonEditorSnapshotSurfaceLoader(mutateAuthored, loadAuthored);
    }

    DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateSupport.safeState(state);
        List<MapSummary> maps = DungeonEditorSnapshotSelectionSupport.mapSummaries(
                catalog.apply(new DungeonMapCatalogCommand.Search("")));
        @Nullable MapId resolvedMapId = DungeonEditorSnapshotSelectionSupport.resolveSelectedMapId(
                safeState.selectedMapId(),
                maps);
        DungeonEditorSessionSnapshot.SurfaceData surface = surfaceLoader.loadCurrentSurface(
                resolvedMapId,
                safeState.selection(),
                safeState.preview());
        int clampedProjectionLevel = DungeonEditorSnapshotProjectionLevelSupport.clampProjectionLevel(
                surface,
                safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? ApplyDungeonEditorSessionUseCase.statusFromMessages(surfaceLoader.previewMessages(
                        resolvedMapId,
                        safeState.preview()))
                : safeState.statusText();
        return new DungeonEditorSessionSnapshot.SnapshotData(
                maps,
                resolvedMapId,
                safeState.viewMode(),
                safeState.selectedTool(),
                clampedProjectionLevel,
                safeState.overlaySettings(),
                safeState.selection(),
                surface,
                safeState.preview(),
                nextStatus);
    }

    @Nullable MapSnapshot loadCommittedSnapshot(
            @Nullable MapId mapId
    ) {
        return surfaceLoader.loadCommittedSnapshot(mapId);
    }
}

final class DungeonEditorSnapshotStateSupport {

    private DungeonEditorSnapshotStateSupport() {
    }

    static DungeonEditorSession safeState(@Nullable DungeonEditorSession state) {
        return state == null ? DungeonEditorSession.empty() : state;
    }
}

final class DungeonEditorSnapshotSelectionSupport {

    private DungeonEditorSnapshotSelectionSupport() {
    }

    static @Nullable MapId resolveSelectedMapId(@Nullable MapId requestedMapId, List<MapSummary> maps) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    static List<MapSummary> mapSummaries(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapList mapList) {
            return mapList.maps().stream()
                    .map(DungeonEditorWorkspaceMapBoundaryTranslator::toWorkspaceMapSummary)
                    .toList();
        }
        return List.of();
    }
}

final class DungeonEditorSnapshotSurfaceLoader {
    private final Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored;
    private final Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored;

    DungeonEditorSnapshotSurfaceLoader(
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.mutateAuthored = mutateAuthored;
        this.loadAuthored = loadAuthored;
    }

    @Nullable MapSnapshot loadCommittedSnapshot(@Nullable MapId mapId) {
        DungeonSnapshot snapshot = loadCommittedSnapshotRecord(mapId);
        return snapshot == null ? null : DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapSnapshot(snapshot.map());
    }

    DungeonEditorSessionSnapshot.@Nullable SurfaceData loadCurrentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonSnapshot committedSnapshot = loadCommittedSnapshotRecord(mapId);
        if (committedSnapshot == null) {
            return null;
        }
        MapSnapshot committedMap =
                DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapSnapshot(committedSnapshot.map());
        @Nullable Inspector inspector = loadInspector(mapId, selection);
        DungeonOperationResult previewResult = previewMessages(mapId, preview);
        DungeonSnapshot previewSnapshot = previewResult == null ? null : previewResult.snapshot();
        @Nullable MapSnapshot previewMap =
                DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspacePreviewMap(previewSnapshot);
        return new DungeonEditorSessionSnapshot.SurfaceData(
                committedSnapshot.mapName(),
                committedSnapshot.revision(),
                committedMap,
                previewMap != null && previewMap.equals(committedMap) ? null : previewMap,
                inspector);
    }

    @Nullable DungeonOperationResult previewMessages(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (mapId == null) {
            return null;
        }
        DungeonEditorOperation operation = DungeonEditorSessionBridge.toDungeonOperation(preview);
        if (operation == null) {
            return null;
        }
        return ApplyDungeonEditorSessionUseCase.requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.PreviewOperation(
                        Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslator.toDomainMapId(mapId)),
                        operation)));
    }

    private @Nullable Inspector loadInspector(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection
    ) {
        if (mapId == null
                || (selection.topologyRef().equals(DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                && !selection.clusterSelection())) {
            return null;
        }
        DungeonAuthoredReadResult result = loadAuthored.apply(new DungeonAuthoredReadQuery.DescribeSelection(
                Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslator.toDomainMapId(mapId)),
                DungeonEditorWorkspaceTopologyBoundaryTranslator.toDomainTopologyRef(selection.topologyRef()),
                selection.clusterId(),
                selection.clusterSelection()));
        if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
            return DungeonEditorWorkspaceInspectorBoundaryTranslator.toWorkspaceInspector(selectionInspector.inspector());
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Inspektor.");
    }

    private @Nullable DungeonSnapshot loadCommittedSnapshotRecord(@Nullable MapId mapId) {
        if (mapId == null) {
            return null;
        }
        DungeonAuthoredReadResult result = loadAuthored.apply(new DungeonAuthoredReadQuery.LoadSnapshot(
                Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslator.toDomainMapId(mapId))));
        if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
            return committedSnapshot.snapshot();
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Snapshot.");
    }
}

final class DungeonEditorSnapshotProjectionLevelSupport {

    private DungeonEditorSnapshotProjectionLevelSupport() {
    }

    static int clampProjectionLevel(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int projectionLevel
    ) {
        List<Integer> levels = levelsFrom(surface, projectionLevel);
        if (levels.isEmpty()) {
            return projectionLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel));
    }

    private static List<Integer> levelsFrom(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        NavigableSet<Integer> levels = new TreeSet<>();
        if (surface != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (Feature feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (Feature feature : surface.previewMap().features()) {
                    addCellLevels(levels, feature.cells());
                }
                surface.previewMap().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(Set<Integer> levels, List<Cell> cells) {
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            levels.add(cell.level());
        }
    }
}
