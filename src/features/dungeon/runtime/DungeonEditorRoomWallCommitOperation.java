package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;

final class DungeonEditorRoomWallCommitOperation {
    private final ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase;

    DungeonEditorRoomWallCommitOperation(ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase) {
        this.authoredOperationUseCase = Objects.requireNonNull(
                authoredOperationUseCase,
                "authoredOperationUseCase");
    }

    ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(DungeonEditorSessionEffect effect) {
        if (effect == null) {
            return null;
        }
        DungeonEditorSessionValues.Preview preview = effect.getApplyPreview();
        if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
            return mapId -> authoredOperationUseCase.executeRoomRectangle(
                    mapId,
                    DungeonEditorWorkspaceCoreGeometry.cell(room.start()),
                    DungeonEditorWorkspaceCoreGeometry.cell(room.end()),
                    room.deleteMode());
        }
        if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries
                && !boundaries.boundaryKind().isDoor()) {
            return mapId -> authoredOperationUseCase.executeClusterBoundaries(
                    mapId,
                    boundaries.clusterId(),
                    DungeonEditorWorkspaceCoreGeometry.edges(boundaries.edges()),
                    DungeonEditorWorkspaceCoreGeometry.boundaryKind(boundaries.boundaryKind()),
                    boundaries.deleteMode());
        }
        return null;
    }
}
