package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorSnapshotUseCase;

public final class DungeonEditorRuntimeApplicationService {

    private final DungeonAuthoredApplicationService authoredService;
    private final DungeonEditorSnapshotPublishedStateRepository editorPublishedState;

    DungeonEditorRuntimeApplicationService(
            DungeonAuthoredApplicationService authoredService,
            DungeonEditorSnapshotPublishedStateRepository editorPublishedState
    ) {
        this.authoredService = Objects.requireNonNull(authoredService, "authoredService");
        this.editorPublishedState = Objects.requireNonNull(editorPublishedState, "editorPublishedState");
    }

    public <T> T openSession(DungeonEditorDungeonState dungeonState, RuntimeSessionFactory<T> factory) {
        DungeonEditorDungeonState safeDungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        RuntimeSessionFactory<T> safeFactory = Objects.requireNonNull(factory, "factory");
        DungeonAuthoredApplicationService.Session authored = authoredService.openSession(safeDungeonState);
        DungeonEditorSessionWorkflow workflow = new DungeonEditorSessionWorkflow();
        BuildDungeonEditorSnapshotUseCase snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(
                authored::searchMaps,
                new AuthoredSurfaceLoader(authored),
                new AuthoredPreviewRefresher(authored),
                safeDungeonState);
        PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase =
                new PublishDungeonEditorSnapshotUseCase(editorPublishedState);
        ApplyDungeonEditorSessionEffectUseCase effectUseCase = new ApplyDungeonEditorSessionEffectUseCase(
                workflow,
                (mapId, preview) -> authoredService.applyPreview(mapId, preview, authored),
                safeDungeonState,
                snapshotBuilder,
                snapshotPublicationUseCase);
        return safeFactory.create(
                authored,
                authored.runtimeCommands(
                        safeDungeonState,
                        workflow,
                        snapshotBuilder,
                        snapshotPublicationUseCase,
                        effectUseCase),
                authoredService,
                safeDungeonState,
                workflow,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase);
    }

    @FunctionalInterface
    public interface RuntimeSessionFactory<T> {
        T create(
            DungeonAuthoredApplicationService.Session authored,
            DungeonAuthoredApplicationService.RuntimeCommands authoredCommands,
            DungeonAuthoredApplicationService authoredService,
            DungeonEditorDungeonState dungeonState,
            DungeonEditorSessionWorkflow workflow,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase);
    }

    private record AuthoredSurfaceLoader(
            DungeonAuthoredApplicationService.Session authored
    ) implements BuildDungeonEditorSnapshotUseCase.AuthoredSurfaceLoader {
        private AuthoredSurfaceLoader {
            authored = Objects.requireNonNull(authored, "authored");
        }

        @Override
        public void load(MapId mapId) {
            authored.loadMap(mapId);
        }

        @Override
        public void loadWithSelection(
                MapId mapId,
                src.domain.dungeon.model.core.graph.DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection
        ) {
            authored.loadMapWithSelection(mapId, topologyRef, clusterId, clusterSelection);
        }
    }

    private record AuthoredPreviewRefresher(
            DungeonAuthoredApplicationService.Session authored
    ) implements BuildDungeonEditorSnapshotUseCase.AuthoredPreviewRefresher {
        private AuthoredPreviewRefresher {
            authored = Objects.requireNonNull(authored, "authored");
        }

        @Override
        public boolean refreshAuthoredDragPreview(
                MapId mapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            return authored.executeAuthoredDragPreview(mapId, preview);
        }

        @Override
        public void refreshInMemory(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Preview preview
        ) {
            authored.executeInMemoryPreview(surface, preview);
        }

        @Override
        public void refresh(MapId mapId, DungeonEditorSessionValues.Preview preview) {
            authored.executePreview(mapId, preview);
        }
    }
}
