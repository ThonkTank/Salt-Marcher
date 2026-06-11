package src.domain.dungeon.model.runtime.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSummary;

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

    public record PreviewFacts(SnapshotFacts snapshot, String statusText) {
        public PreviewFacts {
            snapshot = snapshot == null
                    ? new SnapshotFacts("Dungeon Map", 0, DungeonEditorWorkspaceValues.MapSnapshot.empty())
                    : snapshot;
            statusText = statusText == null ? "" : statusText;
        }
    }
}
