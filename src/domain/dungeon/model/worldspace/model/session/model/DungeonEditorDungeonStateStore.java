package src.domain.dungeon.model.worldspace.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

final class DungeonEditorDungeonStateStore {
    private List<MapSummary> catalog = List.of();
    private @Nullable MapId mutationMapId;
    private DungeonEditorDungeonState.@Nullable SnapshotFacts snapshot;
    private @Nullable Inspector inspector;
    private DungeonEditorDungeonState.@Nullable MutationFacts mutation;

    void replaceCatalog(List<MapSummary> nextCatalog) {
        catalog = nextCatalog == null ? List.of() : List.copyOf(nextCatalog);
    }

    void replaceMutationMapId(@Nullable MapId nextMutationMapId) {
        mutationMapId = nextMutationMapId;
    }

    void replaceSnapshot(DungeonEditorDungeonState.@Nullable SnapshotFacts nextSnapshot) {
        snapshot = nextSnapshot;
    }

    void replaceInspector(@Nullable Inspector nextInspector) {
        inspector = nextInspector;
    }

    void replaceMutation(DungeonEditorDungeonState.@Nullable MutationFacts nextMutation) {
        mutation = nextMutation;
    }

    DungeonEditorDungeonFacts facts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        return new DungeonEditorDungeonFacts(
                catalog,
                mutationMapId,
                snapshot == null ? null : snapshot.map(),
                currentSurface(mapId, selection, preview),
                statusText(mutation),
                preview == DungeonEditorSessionValues.Preview.none() ? "" : statusText(mutation));
    }

    private DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        if (mapId == null || snapshot == null) {
            return null;
        }
        return new DungeonEditorSessionSnapshot.SurfaceData(
                snapshot.mapName(),
                snapshot.revision(),
                snapshot.map(),
                previewMap(preview, snapshot.map(), mutation),
                selectedInspector(selection, inspector));
    }

    private static @Nullable MapSnapshot previewMap(
            DungeonEditorSessionValues.Preview preview,
            MapSnapshot committedMap,
            DungeonEditorDungeonState.@Nullable MutationFacts mutation
    ) {
        MapSnapshot candidate = preview == DungeonEditorSessionValues.Preview.none() || mutation == null
                ? null
                : mutation.snapshot().map();
        return candidate != null && candidate.equals(committedMap) ? null : candidate;
    }

    private static @Nullable Inspector selectedInspector(
            DungeonEditorSessionValues.Selection selection,
            @Nullable Inspector inspector
    ) {
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        if (safeSelection.topologyRef().equals(DungeonTopologyRef.empty()) && !safeSelection.clusterSelection()) {
            return null;
        }
        return inspector;
    }

    private static String statusText(DungeonEditorDungeonState.@Nullable MutationFacts mutation) {
        return mutation == null ? "" : mutation.statusText();
    }
}
