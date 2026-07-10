package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.features.dungeon.runtime.DungeonEditorDoorBoundaryDraftInterpretation.DoorBoundaryCommit;
import src.features.dungeon.runtime.DungeonEditorWallBoundaryDraftInterpretation.WallBoundaryCommit;

final class DungeonEditorDraftAuthoredCommitter {
    private final DungeonAuthoredApplicationService authoredService;
    private final DungeonAuthoredApplicationService.Session authoredSession;

    private DungeonEditorDraftAuthoredCommitter(
            DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime
    ) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        authoredService = Objects.requireNonNull(safeRuntime.authoredService(), "authoredService");
        authoredSession = Objects.requireNonNull(safeRuntime.authored(), "authoredSession");
    }

    static DungeonEditorDraftAuthoredCommitter from(
            DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime
    ) {
        return new DungeonEditorDraftAuthoredCommitter(runtime);
    }

    void createCorridor(
            MapId mapId,
            DungeonEditorSessionValues.CorridorCreatePreview preview
    ) {
        authoredService.createCorridor(mapId, preview.start(), preview.end(), authoredSession);
    }

    void deleteCorridor(
            MapId mapId,
            DungeonEditorSessionValues.DeleteCorridorPreview preview
    ) {
        authoredService.deleteCorridor(mapId, preview.target(), authoredSession);
    }

    void applyDoorBoundary(MapId mapId, DoorBoundaryCommit commit) {
        authoredService.applyDoorBoundary(
                mapId,
                commit.clusterId(),
                DungeonEditorWorkspaceCoreGeometry.edges(List.of(commit.edge().toEdgeRef())),
                commit.deleteMode(),
                authoredSession);
    }

    void applyWallBoundary(MapId mapId, WallBoundaryCommit commit) {
        authoredService.applyWallBoundary(
                mapId,
                commit.clusterId(),
                DungeonEditorWorkspaceCoreGeometry.edges(DungeonEditorBoundaryDraftEffectHelper.edgeRefs(commit.edges())),
                commit.deleteMode(),
                authoredSession);
    }
}
