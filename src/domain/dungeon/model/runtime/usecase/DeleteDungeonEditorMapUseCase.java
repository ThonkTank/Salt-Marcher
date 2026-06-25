package src.domain.dungeon.model.runtime.usecase;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSummary;

public final class DeleteDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public DeleteDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteMapUseCase = Objects.requireNonNull(deleteMapUseCase, "deleteMapUseCase");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public void execute(long mapId) {
        if (DungeonEditorWorkspaceValues.hasId(mapId)) {
            deleteMapUseCase.execute(new DungeonEditorWorkspaceValues.MapId(mapId));
        }
        snapshotBuilder.refreshCatalog();
        DungeonEditorSessionSnapshot.SnapshotData refreshedSnapshot = snapshotBuilder.execute(workflow.session());
        DungeonEditorWorkspaceValues.MapId nextMapId = firstMapId(refreshedSnapshot.maps());
        workflow.applyMapLifecycle(DungeonEditorSessionWorkflow.MAP_DELETED, nextMapId);
        snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }

    private static DungeonEditorWorkspaceValues.MapId firstMapId(List<MapSummary> maps) {
        if (maps == null || maps.isEmpty()) {
            return null;
        }
        return maps.stream()
                .min(DeleteDungeonEditorMapUseCase::compareMapSummary)
                .orElseThrow()
                .mapId();
    }

    private static int compareMapSummary(MapSummary left, MapSummary right) {
        int nameComparison = Comparator.nullsFirst(String.CASE_INSENSITIVE_ORDER)
                .compare(left.mapName(), right.mapName());
        if (nameComparison != 0) {
            return nameComparison;
        }
        return Long.compare(left.mapId().value(), right.mapId().value());
    }
}
