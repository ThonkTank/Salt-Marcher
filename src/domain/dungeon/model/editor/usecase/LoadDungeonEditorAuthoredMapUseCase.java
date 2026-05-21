package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;

public final class LoadDungeonEditorAuthoredMapUseCase {

    private final RefreshDungeonAuthoredUseCase refreshUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public LoadDungeonEditorAuthoredMapUseCase(
            RefreshDungeonAuthoredUseCase refreshUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.refreshUseCase = Objects.requireNonNull(refreshUseCase, "refreshUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(MapId mapId) {
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = refreshUseCase.refreshMap(domainMapId(mapId));
        state.replaceSnapshot(DungeonEditorAuthoredFactsUseCase.snapshotFacts(snapshot));
        publishedStateRepository.publishSnapshot(DungeonEditorAuthoredFactsUseCase.snapshotPublication(snapshot));
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
