package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;

public final class DescribeDungeonEditorAuthoredSelectionUseCase {

    private final RefreshDungeonAuthoredUseCase refreshUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public DescribeDungeonEditorAuthoredSelectionUseCase(
            RefreshDungeonAuthoredUseCase refreshUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.refreshUseCase = Objects.requireNonNull(refreshUseCase, "refreshUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(
            MapId mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector = refreshUseCase.describeSelection(
                domainMapId(mapId),
                topologyRef,
                clusterId,
                clusterSelection);
        state.replaceInspector(DungeonEditorAuthoredFactsUseCase.inspectorFacts(inspector));
        publishedStateRepository.publishInspector(DungeonEditorAuthoredFactsUseCase.inspectorPublication(inspector));
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

}
