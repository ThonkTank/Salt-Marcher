package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.projection.DungeonDerivedStateProjection;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;

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
                dungeonMap.metadata().mapName(),
                derived,
                editorHandles,
                dungeonMap.revision());
    }
}
