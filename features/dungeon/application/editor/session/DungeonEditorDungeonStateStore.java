package features.dungeon.application.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Inspector;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary;

final class DungeonEditorDungeonStateStore {
    private List<MapSummary> catalog = List.of();
    private @Nullable MapId mutationMapId;
    private DungeonEditorDungeonState.@Nullable SnapshotFacts snapshot;
    private @Nullable Inspector inspector;
    private DungeonEditorDungeonState.@Nullable MutationFacts mutation;
    private DungeonEditorDungeonState.@Nullable PreviewFacts preview;

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

    void replacePreview(DungeonEditorDungeonState.@Nullable PreviewFacts nextPreview) {
        preview = nextPreview;
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
                mutation == null ? "" : mutation.statusText(),
                preview == DungeonEditorSessionValues.Preview.none() || this.preview == null
                        ? ""
                        : this.preview.statusText());
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
                previewMap(preview, snapshot.map(), this.preview),
                selectedInspector(selection, inspector));
    }

    private static @Nullable MapSnapshot previewMap(
            DungeonEditorSessionValues.Preview preview,
            MapSnapshot committedMap,
            DungeonEditorDungeonState.@Nullable PreviewFacts previewFacts
    ) {
        MapSnapshot candidate = preview == DungeonEditorSessionValues.Preview.none() || previewFacts == null
                ? null
                : previewFacts.snapshot().map();
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
}
