package features.dungeon.application.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Inspector;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;

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
        snapshot = nextSnapshot == null ? null : retainedRequestGeneration(nextSnapshot);
    }

    void replaceInspector(@Nullable Inspector nextInspector) {
        inspector = nextInspector;
    }

    void replaceMutation(DungeonEditorDungeonState.@Nullable MutationFacts nextMutation) {
        if (nextMutation == null) {
            mutation = null;
            return;
        }
        DungeonEditorDungeonState.SnapshotFacts committed =
                retainedRequestGeneration(nextMutation.snapshot());
        snapshot = committed;
        mutation = new DungeonEditorDungeonState.MutationFacts(
                committed,
                nextMutation.commandOutcome());
    }

    void replaceCommandOutcome(DungeonEditorCommandOutcome commandOutcome) {
        mutation = new DungeonEditorDungeonState.MutationFacts(snapshot, commandOutcome);
    }

    void replacePreview(DungeonEditorDungeonState.@Nullable PreviewFacts nextPreview) {
        preview = nextPreview;
    }

    DungeonEditorDungeonFacts facts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonEditorDungeonState.SnapshotFacts ownedSnapshot = ownedSnapshot(mapId);
        return new DungeonEditorDungeonFacts(
                catalog,
                mutationMapId,
                ownedSnapshot == null ? null : ownedSnapshot.map(),
                currentSurface(ownedSnapshot, selection, preview),
                mutation == null ? DungeonEditorCommandOutcome.idle() : mutation.commandOutcome(),
                preview == DungeonEditorSessionValues.Preview.none() || this.preview == null
                        ? ""
                        : this.preview.statusText());
    }

    private DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
            DungeonEditorDungeonState.@Nullable SnapshotFacts ownedSnapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        if (ownedSnapshot == null) {
            return null;
        }
        return new DungeonEditorSessionSnapshot.SurfaceData(
                ownedSnapshot.mapId(),
                ownedSnapshot.requestGeneration(),
                ownedSnapshot.acceptedRevision(),
                ownedSnapshot.mapName(),
                ownedSnapshot.revision(),
                ownedSnapshot.map(),
                previewMap(preview, ownedSnapshot, this.preview),
                selectedInspector(selection, inspector));
    }

    private DungeonEditorDungeonState.@Nullable SnapshotFacts ownedSnapshot(@Nullable MapId mapId) {
        return snapshot != null && snapshot.ownedBy(mapId) ? snapshot : null;
    }

    private DungeonEditorDungeonState.SnapshotFacts retainedRequestGeneration(
            DungeonEditorDungeonState.SnapshotFacts candidate
    ) {
        if (candidate.requestGeneration() > 0L
                || snapshot == null
                || !snapshot.ownedBy(candidate.mapId())) {
            return candidate;
        }
        return candidate.withRequestGeneration(snapshot.requestGeneration());
    }

    private static @Nullable MapSnapshot previewMap(
            DungeonEditorSessionValues.Preview preview,
            DungeonEditorDungeonState.SnapshotFacts committed,
            DungeonEditorDungeonState.@Nullable PreviewFacts previewFacts
    ) {
        MapSnapshot candidate = preview == DungeonEditorSessionValues.Preview.none()
                || previewFacts == null
                || !sameOwner(committed, previewFacts.snapshot())
                ? null
                : previewFacts.snapshot().map();
        return candidate != null && candidate.equals(committed.map()) ? null : candidate;
    }

    private static boolean sameOwner(
            DungeonEditorDungeonState.SnapshotFacts committed,
            DungeonEditorDungeonState.SnapshotFacts candidate
    ) {
        return java.util.Objects.equals(committed.mapId(), candidate.mapId())
                && committed.requestGeneration() == candidate.requestGeneration()
                && committed.acceptedRevision() == candidate.acceptedRevision();
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
