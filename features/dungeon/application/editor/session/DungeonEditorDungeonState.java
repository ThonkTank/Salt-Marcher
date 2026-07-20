package features.dungeon.application.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Inspector;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;

public final class DungeonEditorDungeonState {

    private final DungeonEditorDungeonStateStore mutable = new DungeonEditorDungeonStateStore();

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
        mutable.replaceCatalog(catalog);
    }

    public void replaceMutationMapId(@Nullable MapId mutationMapId) {
        mutable.replaceMutationMapId(mutationMapId);
    }

    public void replaceSnapshot(@Nullable SnapshotFacts snapshot) {
        mutable.replaceSnapshot(snapshot);
    }

    public void replaceInspector(@Nullable Inspector inspector) {
        mutable.replaceInspector(inspector);
    }

    public void replaceMutation(@Nullable MutationFacts mutation) {
        mutable.replaceMutation(mutation);
    }

    public void replaceCommandOutcome(DungeonEditorCommandOutcome commandOutcome) {
        mutable.replaceCommandOutcome(commandOutcome);
    }

    public void replacePreview(@Nullable PreviewFacts preview) {
        mutable.replacePreview(preview);
    }

    private DungeonEditorDungeonFacts facts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        return mutable.facts(mapId, selection, preview);
    }

    public record SnapshotFacts(
            @Nullable MapId mapId,
            long requestGeneration,
            long acceptedRevision,
            String mapName,
            int revision,
            MapSnapshot map
    ) {
        public SnapshotFacts {
            requestGeneration = Math.max(0L, requestGeneration);
            acceptedRevision = Math.max(0L, acceptedRevision);
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0, revision);
            map = map == null ? DungeonEditorWorkspaceValues.MapSnapshot.empty() : map;
        }

        public boolean ownedBy(@Nullable MapId requestedMapId) {
            return mapId != null && mapId.equals(requestedMapId);
        }

        SnapshotFacts withRequestGeneration(long generation) {
            return new SnapshotFacts(
                    mapId,
                    generation,
                    acceptedRevision,
                    mapName,
                    revision,
                    map);
        }
    }

    public record MutationFacts(SnapshotFacts snapshot, DungeonEditorCommandOutcome commandOutcome) {
        public MutationFacts {
            snapshot = snapshot == null
                    ? emptySnapshot()
                    : snapshot;
            commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
        }
    }

    public record PreviewFacts(SnapshotFacts snapshot, String statusText) {
        public PreviewFacts {
            snapshot = snapshot == null
                    ? emptySnapshot()
                    : snapshot;
            statusText = statusText == null ? "" : statusText;
        }
    }

    private static SnapshotFacts emptySnapshot() {
        return new SnapshotFacts(
                null, 0L, 0L, "Dungeon Map", 0, DungeonEditorWorkspaceValues.MapSnapshot.empty());
    }
}
