package src.domain.dungeon.model.editor.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class DungeonEditorDungeonState {

    private final MutableState mutable = new MutableState();

    public DungeonEditorDungeonFacts currentFacts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        return facts(mapId, selection, preview);
    }

    public DungeonEditorDungeonFacts committedFacts(@Nullable MapId mapId) {
        return facts(mapId, DungeonEditorSessionValues.Selection.empty(), DungeonEditorSessionValues.Preview.none());
    }

    public void replaceCatalog(List<MapSummary> catalog) {
        mutable.catalog = catalog == null ? List.of() : List.copyOf(catalog);
    }

    public void replaceMutationMapId(@Nullable MapId mutationMapId) {
        mutable.mutationMapId = mutationMapId;
    }

    public void replaceSnapshot(@Nullable SnapshotFacts snapshot) {
        mutable.snapshot = snapshot;
    }

    public void replaceInspector(@Nullable Inspector inspector) {
        mutable.inspector = inspector;
    }

    public void replaceMutation(@Nullable MutationFacts mutation) {
        mutable.mutation = mutation;
    }

    private DungeonEditorDungeonFacts facts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        MutationFacts mutation = mutable.mutation;
        return new DungeonEditorDungeonFacts(
                mutable.catalog,
                mutable.mutationMapId,
                mutable.snapshot == null ? null : mutable.snapshot.map(),
                currentSurface(mapId, selection, preview, mutable.snapshot, mutable.inspector, mutation),
                statusText(mutation),
                preview == DungeonEditorSessionValues.Preview.none() ? "" : statusText(mutation));
    }

    private static DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            @Nullable SnapshotFacts snapshot,
            @Nullable Inspector inspector,
            @Nullable MutationFacts mutation
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
            @Nullable MutationFacts mutation
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

    private static String statusText(@Nullable MutationFacts mutation) {
        return mutation == null ? "" : mutation.statusText();
    }

    public record SnapshotFacts(String mapName, int revision, MapSnapshot map) {
        public SnapshotFacts {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0, revision);
            map = map == null ? DungeonEditorWorkspaceValues.MapSnapshot.empty() : map;
        }
    }

    public record MutationFacts(SnapshotFacts snapshot, String statusText) {
        public MutationFacts {
            snapshot = snapshot == null
                    ? new SnapshotFacts("Dungeon Map", 0, DungeonEditorWorkspaceValues.MapSnapshot.empty())
                    : snapshot;
            statusText = statusText == null ? "" : statusText;
        }
    }

    private static final class MutableState {
        private List<MapSummary> catalog = List.of();
        private @Nullable MapId mutationMapId;
        private @Nullable SnapshotFacts snapshot;
        private @Nullable Inspector inspector;
        private @Nullable MutationFacts mutation;
    }
}
