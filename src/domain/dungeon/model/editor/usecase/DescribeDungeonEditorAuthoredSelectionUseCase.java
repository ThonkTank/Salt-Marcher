package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
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
    private final DungeonEditorAuthoredOperationExchange exchange = new DungeonEditorAuthoredOperationExchange();

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
        publish(inspector);
    }

    void publish(
            LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
    ) {
        state.replaceInspector(exchange.inspectorFacts(inspector));
        DungeonAuthoredPublishedStateRepository.InspectorPublication publication =
                exchange.inspectorPublication(inspector);
        if (publication != null) {
            publishedStateRepository.publishInspector(publication);
        }
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
