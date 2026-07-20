package features.dungeon.application.editor.usecase;

import java.util.List;
import java.util.Objects;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.application.editor.interaction.DungeonEditorHandleProjection;

/**
 * Assembles committed dungeon snapshot data from authored truth and derived state.
 */
public final class AssembleDungeonSnapshotUseCase {

    private final DungeonDerivedStateProjection projector;

    public AssembleDungeonSnapshotUseCase() {
        this(new DungeonDerivedStateProjection());
    }

    public AssembleDungeonSnapshotUseCase(DungeonDerivedStateProjection projector) {
        this.projector = Objects.requireNonNull(projector, "projector");
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData execute(
            DungeonMap dungeonMap,
            List<DungeonEditorHandleProjection> editorHandles
    ) {
        return execute(dungeonMap, projector.project(dungeonMap), editorHandles);
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData execute(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            List<DungeonEditorHandleProjection> editorHandles
    ) {
        return LoadDungeonSnapshotUseCase.snapshotData(
                dungeonMap.metadata().mapId().value(),
                dungeonMap.metadata().mapName(),
                derived,
                editorHandles,
                dungeonMap.revision());
    }
}
