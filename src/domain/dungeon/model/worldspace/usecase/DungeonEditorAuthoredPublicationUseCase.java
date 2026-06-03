package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.helper.DungeonEditorWorkspaceAreaProjectionHelper;
import src.domain.dungeon.model.runtime.helper.DungeonEditorWorkspaceBoundaryProjectionHelper;
import src.domain.dungeon.model.runtime.helper.DungeonEditorWorkspaceFeatureProjectionHelper;
import src.domain.dungeon.model.runtime.helper.DungeonEditorWorkspaceHandleProjectionHelper;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonEditorHandleFacts;
import src.domain.dungeon.model.worldspace.DungeonMapFacts;
import src.domain.dungeon.model.worldspace.DungeonTopology;
import src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository;

public final class DungeonEditorAuthoredPublicationUseCase {
    private final DungeonEditorWorkspaceAreaProjectionHelper areas = new DungeonEditorWorkspaceAreaProjectionHelper();
    private final DungeonEditorWorkspaceBoundaryProjectionHelper boundaries = new DungeonEditorWorkspaceBoundaryProjectionHelper();
    private final DungeonEditorWorkspaceFeatureProjectionHelper features = new DungeonEditorWorkspaceFeatureProjectionHelper();
    private final DungeonEditorWorkspaceHandleProjectionHelper handles = new DungeonEditorWorkspaceHandleProjectionHelper();

    public Publication execute(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        List<DungeonEditorHandleFacts> safeEditorHandles = editorHandles == null
                ? List.of()
                : List.copyOf(editorHandles);
        return new Publication(
                stateFacts(mapName, derived, safeEditorHandles, revision),
                repositoryPublication(mapName, derived, safeEditorHandles, revision));
    }

    public record Publication(
            DungeonEditorDungeonState.SnapshotFacts stateFacts,
            DungeonAuthoredPublishedStateRepository.SnapshotPublication repositoryPublication
    ) {
    }

    private DungeonEditorDungeonState.SnapshotFacts stateFacts(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        return new DungeonEditorDungeonState.SnapshotFacts(
                mapName,
                stateRevision(revision),
                workspaceSnapshot(derived, editorHandles));
    }

    private MapSnapshot workspaceSnapshot(
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> sourceHandles
    ) {
        DungeonMapFacts safeFacts = safeFacts(derived);
        return new MapSnapshot(
                safeFacts.topology(),
                safeFacts.width(),
                safeFacts.height(),
                areas.project(safeFacts),
                boundaries.project(safeFacts),
                features.project(safeFacts),
                handles.project(sourceHandles));
    }

    private static DungeonAuthoredPublishedStateRepository.SnapshotPublication repositoryPublication(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        return new DungeonAuthoredPublishedStateRepository.SnapshotPublication(
                mapName,
                derived,
                editorHandles,
                revision);
    }

    private static int stateRevision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    private static DungeonMapFacts safeFacts(@Nullable DungeonDerivedState derived) {
        return derived == null || derived.map() == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : derived.map();
    }

}
