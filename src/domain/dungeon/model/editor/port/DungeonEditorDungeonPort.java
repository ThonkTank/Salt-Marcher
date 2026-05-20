package src.domain.dungeon.model.editor.port;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

public final class DungeonEditorDungeonPort {

    private final DungeonFactsSource factsSource;

    public DungeonEditorDungeonPort(DungeonFactsSource factsSource) {
        this.factsSource = Objects.requireNonNull(factsSource, "factsSource");
    }

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

    private DungeonEditorDungeonFacts facts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        return new DungeonEditorDungeonFacts(
                factsSource.mapSummaries(),
                factsSource.mutationMapId(),
                factsSource.committedSnapshot(),
                factsSource.currentSurface(mapId, selection, preview),
                factsSource.mutationStatusText(),
                factsSource.previewStatusText(preview));
    }

    public interface DungeonFactsSource {
        List<MapSummary> mapSummaries();

        @Nullable MapId mutationMapId();

        @Nullable MapSnapshot committedSnapshot();

        DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview);

        String mutationStatusText();

        String previewStatusText(DungeonEditorSessionValues.Preview preview);
    }
}
