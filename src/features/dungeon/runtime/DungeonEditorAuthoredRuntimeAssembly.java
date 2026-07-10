package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;

// PROJECT_HEALTH_DEBT[PH-20260709-001]: broad Dungeon Editor runtime assembly remains after feature-runtime migration; owner=feature-runtime; remove_when=runtime assembly, store state, operation dispatch, root coordination, and frame publication have narrower target feature-runtime owners.
final class DungeonEditorAuthoredRuntimeAssembly {

    private DungeonEditorAuthoredRuntimeAssembly() {
    }

    static AssemblyResult create(
            DungeonEditorRuntimeDependencies dependencies,
            DungeonEditorMainViewInteractionState interactionState
    ) {
        DungeonEditorRuntimeDependencies safeDependencies =
                Objects.requireNonNull(dependencies, "dependencies");
        DungeonEditorMainViewInteractionState safeInteractionState =
                Objects.requireNonNull(interactionState, "interactionState");
        DungeonEditorDungeonState dungeonState = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService authoredService = safeDependencies.authoredApplicationService();
        DungeonEditorSnapshotPublishedStateRepository editorPublishedState =
                safeDependencies.publishedStateRepositories().editorSnapshotPublishedStateRepository();
        DungeonAuthoredApplicationService.Session authored =
                authoredService.openSession(dungeonState);
        DungeonEditorSessionWorkflow workflow = new DungeonEditorSessionWorkflow();
        InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
                new InterpretDungeonEditorMainViewInputUseCase(safeInteractionState);
        BuildDungeonEditorSnapshotUseCase snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(
                authored::searchMaps,
                new AuthoredSurfaceLoader(authored),
                new AuthoredPreviewRefresher(authored),
                dungeonState);
        PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase =
                new PublishDungeonEditorSnapshotUseCase(editorPublishedState);
        ApplyDungeonEditorSessionEffectUseCase effectUseCase = new ApplyDungeonEditorSessionEffectUseCase(
                workflow,
                (mapId, preview) -> authoredService.applyPreview(mapId, preview, authored),
                dungeonState,
                snapshotBuilder,
                snapshotPublicationUseCase);
        DungeonEditorRuntimeOperationResult initialResult =
                DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        return new AssemblyResult(operations(runtimeUseCases(
                authored,
                authoredService,
                dungeonState,
                workflow,
                mainViewInterpreter,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase)), initialResult);
    }

    record AssemblyResult(
            DungeonEditorAuthoredRuntimeOperations operations,
            DungeonEditorRuntimeOperationResult initialResult
    ) {
        AssemblyResult {
            operations = Objects.requireNonNull(operations, "operations");
            initialResult = initialResult == null ? DungeonEditorRuntimeOperationResult.none() : initialResult;
        }
    }

    private static DungeonEditorAuthoredRuntimeOperations operations(RuntimeUseCases runtime) {
        DungeonEditorSelectedHandleRuntimeOperation selectedHandle = selectedHandle(runtime);
        return new DungeonEditorAuthoredRuntimeOperations(new DungeonEditorAuthoredRuntimeOperationUseCases(
                mapUseCases(runtime),
                projectionUseCases(runtime),
                new DungeonEditorRoomPaintRuntimeOperation(runtime),
                new DungeonEditorWallBoundaryDraftRuntimeOperation(runtime),
                new DungeonEditorDoorBoundaryDraftRuntimeOperation(runtime),
                new DungeonEditorCorridorDraftRuntimeOperation(runtime),
                new DungeonEditorStairDraftRuntimeOperation(runtime),
                new DungeonEditorStairDeleteRuntimeOperation(runtime),
                new DungeonEditorTransitionRuntimeOperation(runtime),
                new DungeonEditorFeatureMarkerRuntimeOperation(runtime),
                selectedHandle,
                detailUseCases(runtime)));
    }

    private static DungeonEditorAuthoredRuntimeOperationUseCases.MapUseCases mapUseCases(RuntimeUseCases runtime) {
        return new DungeonEditorAuthoredRuntimeOperationUseCases.MapUseCases(runtime.authoredCommands());
    }

    private static DungeonEditorAuthoredRuntimeOperationUseCases.ProjectionUseCases projectionUseCases(
            RuntimeUseCases runtime
    ) {
        return new DungeonEditorAuthoredRuntimeOperationUseCases.ProjectionUseCases(
                new SetDungeonEditorViewModeUseCase(
                        runtime.workflow(),
                        runtime.snapshotPublicationUseCase()),
                new SetDungeonEditorToolUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new ShiftDungeonEditorProjectionLevelUseCase(
                        runtime.workflow(),
                        runtime.snapshotPublicationUseCase()),
                new SetDungeonEditorOverlayUseCase(
                        runtime.workflow(),
                        runtime.snapshotPublicationUseCase()));
    }

    private static DungeonEditorAuthoredRuntimeOperationUseCases.DetailUseCases detailUseCases(RuntimeUseCases runtime) {
        return new DungeonEditorAuthoredRuntimeOperationUseCases.DetailUseCases(runtime.authoredCommands());
    }

    private static DungeonEditorSelectedHandleRuntimeOperation selectedHandle(RuntimeUseCases runtime) {
        return new DungeonEditorSelectedHandleRuntimeOperation(
            runtime.workflow(),
            runtime.mainViewInterpreter(),
            runtime.effectUseCase(),
            runtime.authoredService(),
            runtime.authored());
    }

    private static RuntimeUseCases runtimeUseCases(
            DungeonAuthoredApplicationService.Session authored,
            DungeonAuthoredApplicationService authoredService,
            DungeonEditorDungeonState dungeonState,
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        return new RuntimeUseCases(
                authored,
                authored.runtimeCommands(dungeonState, workflow, snapshotBuilder, snapshotPublicationUseCase, effectUseCase),
                authoredService,
                dungeonState,
                workflow,
                mainViewInterpreter,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase);
    }

    record RuntimeUseCases(
            DungeonAuthoredApplicationService.Session authored,
            DungeonAuthoredApplicationService.RuntimeCommands authoredCommands,
            DungeonAuthoredApplicationService authoredService,
            DungeonEditorDungeonState dungeonState,
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
    }

    private record AuthoredSurfaceLoader(
            DungeonAuthoredApplicationService.Session authored
    ) implements BuildDungeonEditorSnapshotUseCase.AuthoredSurfaceLoader {
        @Override
        public void load(src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId mapId) {
            authored.loadMap(mapId);
        }

        @Override
        public void loadWithSelection(
                src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId mapId,
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
        @Override
        public boolean refreshAuthoredDragPreview(
                src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId mapId,
                src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues.Preview preview
        ) {
            return authored.executeAuthoredDragPreview(mapId, preview);
        }

        @Override
        public void refreshInMemory(
                src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot.SurfaceData surface,
                src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues.Preview preview
        ) {
            authored.executeInMemoryPreview(surface, preview);
        }

        @Override
        public void refresh(
                src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId mapId,
                src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues.Preview preview
        ) {
            authored.executePreview(mapId, preview);
        }
    }
}
