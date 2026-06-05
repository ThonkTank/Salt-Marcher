package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;

/**
 * Assembles committed dungeon snapshot data from authored truth and derived state.
 */
public final class AssembleDungeonSnapshotUseCase {

    private final BuildDungeonDerivedStateUseCase derive;

    public AssembleDungeonSnapshotUseCase(BuildDungeonDerivedStateUseCase derive) {
        this.derive = Objects.requireNonNull(derive, "derive");
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData execute(
            DungeonMap dungeonMap,
            List<DungeonEditorHandleProjection> editorHandles
    ) {
        return execute(dungeonMap, derive.execute(dungeonMap), editorHandles);
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData execute(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            List<DungeonEditorHandleProjection> editorHandles
    ) {
        return new LoadDungeonSnapshotUseCase.DungeonSnapshotData(
                dungeonMap.metadata().mapName(),
                derived,
                editorHandles,
                dungeonMap.revision());
    }
}
