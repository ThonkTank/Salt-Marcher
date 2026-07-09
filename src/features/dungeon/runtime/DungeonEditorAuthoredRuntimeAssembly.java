package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.usecase.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.core.usecase.CreateDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.DeleteDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.RenameDungeonMapUseCase;
import src.domain.dungeon.model.core.usecase.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCorridorMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorHandleMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorHandleOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorTransitionLinkOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonRoomWallMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredStairUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredStairUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.InspectDungeonSelectionUseCase;
import src.domain.dungeon.model.runtime.usecase.LoadDungeonEditorAuthoredMapUseCase;
import src.domain.dungeon.model.runtime.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.PreviewDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredInspectorUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredMutationUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionLinkUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionLinkUseCase;
import src.domain.dungeon.model.runtime.usecase.SearchDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.runtime.usecase.SelectDungeonEditorMapUseCase;
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
        DungeonAuthoredPublishedStateRepository authoredPublishedState =
                safeDependencies.publishedStateRepositories().authoredPublishedStateRepository();
        DungeonEditorSnapshotPublishedStateRepository editorPublishedState =
                safeDependencies.publishedStateRepositories().editorSnapshotPublishedStateRepository();
        AuthoredUseCases authored = authoredUseCases(safeDependencies, authoredPublishedState, dungeonState);
        DungeonEditorSessionWorkflow workflow = new DungeonEditorSessionWorkflow();
        InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
                new InterpretDungeonEditorMainViewInputUseCase(safeInteractionState);
        BuildDungeonEditorSnapshotUseCase snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(
                authored.searchMapsUseCase(),
                authored.loadMapUseCase(),
                authored.previewOperationUseCase(),
                dungeonState);
        PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase =
                new PublishDungeonEditorSnapshotUseCase(editorPublishedState);
        ApplyDungeonEditorSessionEffectUseCase effectUseCase = new ApplyDungeonEditorSessionEffectUseCase(
                workflow,
                authored.applyOperationUseCase(),
                dungeonState,
                snapshotBuilder,
                snapshotPublicationUseCase);
        DungeonEditorRuntimeOperationResult initialResult =
                DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        return new AssemblyResult(operations(runtimeUseCases(
                authored,
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
        return new DungeonEditorAuthoredRuntimeOperationUseCases.MapUseCases(
                new SelectDungeonEditorMapUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new CreateDungeonEditorMapUseCase(
                        runtime.workflow(),
                        runtime.authored().createMapUseCase(),
                        runtime.dungeonState(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new RenameDungeonEditorMapUseCase(
                        runtime.workflow(),
                        runtime.authored().renameMapUseCase(),
                        runtime.dungeonState(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new DeleteDungeonEditorMapUseCase(
                        runtime.workflow(),
                        runtime.authored().deleteMapUseCase(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()));
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
        return new DungeonEditorAuthoredRuntimeOperationUseCases.DetailUseCases(
                new SaveDungeonEditorRoomNarrationUseCase(
                        runtime.workflow(),
                        runtime.authored().saveRoomNarrationUseCase(),
                        runtime.effectUseCase()),
                new SaveDungeonEditorLabelNameUseCase(
                        runtime.workflow(),
                        runtime.authored().saveLabelNameUseCase(),
                        runtime.effectUseCase()),
                new SaveDungeonEditorTransitionDescriptionUseCase(
                        runtime.workflow(),
                        runtime.authored().saveTransitionDescriptionUseCase(),
                        runtime.effectUseCase()),
                new SaveDungeonEditorTransitionLinkUseCase(
                        runtime.workflow(),
                        runtime.authored().saveTransitionLinkUseCase(),
                        runtime.effectUseCase()),
                new SaveDungeonEditorStairGeometryUseCase(
                        runtime.workflow(),
                        runtime.authored().saveStairGeometryUseCase(),
                        runtime.effectUseCase()));
    }

    private static DungeonEditorSelectedHandleRuntimeOperation selectedHandle(RuntimeUseCases runtime) {
        return new DungeonEditorSelectedHandleRuntimeOperation(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase(),
                runtime.authored().applyOperationUseCase(),
                runtime.authored().handleOperationUseCase());
    }

    private static RuntimeUseCases runtimeUseCases(
            AuthoredUseCases authored,
            DungeonEditorDungeonState dungeonState,
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        return new RuntimeUseCases(
                authored,
                dungeonState,
                workflow,
                mainViewInterpreter,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase);
    }

    private static AuthoredUseCases authoredUseCases(
            DungeonEditorRuntimeDependencies dependencies,
            DungeonAuthoredPublishedStateRepository publishedState,
            DungeonEditorDungeonState dungeonState
    ) {
        DungeonMapRepository repository = dependencies.authoredMapPersistence().repositoryForRuntimeAssembly();
        ApplyDungeonMapCatalogUseCase catalogUseCase = mapCatalogUseCase(repository);
        LoadDungeonSnapshotUseCase loadSnapshotUseCase = loadDungeonSnapshotUseCase(repository);
        SnapshotParts snapshotParts = snapshotParts(repository);
        ApplyDungeonEditorOperationUseCase operationUseCase = authoredOperationUseCase(snapshotParts, repository);
        ApplyDungeonAuthoredMutationUseCase mutationUseCase =
                new ApplyDungeonAuthoredMutationUseCase(operationUseCase);
        ApplyDungeonEditorCorridorMutationUseCase corridorMutationUseCase =
                new ApplyDungeonEditorCorridorMutationUseCase(operationUseCase, repository);
        ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase =
                new ApplyDungeonRoomWallMutationUseCase(operationUseCase);
        ApplyDungeonEditorHandleMutationUseCase handleMutationUseCase =
                new ApplyDungeonEditorHandleMutationUseCase(operationUseCase);
        PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase =
                new PublishDungeonEditorAuthoredMutationUseCase(publishedState, dungeonState);
        ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase =
                new ApplyDungeonEditorHandleOperationUseCase(handleMutationUseCase, publishMutationUseCase);
        return new AuthoredUseCases(
                new SearchDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new CreateDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new RenameDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new DeleteDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new LoadDungeonEditorAuthoredMapUseCase(
                        loadSnapshotUseCase,
                        new PublishDungeonEditorAuthoredSnapshotUseCase(publishedState, dungeonState),
                        new PublishDungeonEditorAuthoredInspectorUseCase(publishedState, dungeonState)),
                new PreviewDungeonEditorAuthoredOperationUseCase(
                        operationUseCase,
                        mutationUseCase,
                        corridorMutationUseCase,
                        roomWallMutationUseCase,
                        dungeonState),
                new ApplyDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        corridorMutationUseCase,
                        roomWallMutationUseCase,
                        publishMutationUseCase),
                handleOperationUseCase,
                new SaveDungeonEditorAuthoredRoomNarrationUseCase(mutationUseCase, publishMutationUseCase),
                new SaveDungeonEditorAuthoredLabelNameUseCase(mutationUseCase, publishMutationUseCase),
                new SaveDungeonEditorAuthoredTransitionDescriptionUseCase(operationUseCase, publishMutationUseCase),
                new SaveDungeonEditorAuthoredTransitionLinkUseCase(
                        new ApplyDungeonEditorTransitionLinkOperationUseCase(
                                repository,
                                snapshotParts.derive(),
                                snapshotParts.assembleDungeonSnapshotUseCase(),
                                snapshotParts.publishDungeonEditorHandlesUseCase()),
                        publishMutationUseCase),
                new SaveDungeonEditorAuthoredStairGeometryUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase),
                new CreateDungeonEditorAuthoredStairUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase,
                        repository),
                new CreateDungeonEditorAuthoredTransitionUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase,
                        repository),
                new CreateDungeonEditorAuthoredFeatureMarkerUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase),
                new DeleteDungeonEditorAuthoredStairUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase),
                new DeleteDungeonEditorAuthoredTransitionUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase),
                new DeleteDungeonEditorAuthoredFeatureMarkerUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase));
    }

    private static ApplyDungeonMapCatalogUseCase mapCatalogUseCase(DungeonMapRepository repository) {
        return new ApplyDungeonMapCatalogUseCase(
                new SearchDungeonMapsUseCase(repository),
                new CreateDungeonMapUseCase(repository),
                new RenameDungeonMapUseCase(repository),
                new DeleteDungeonMapUseCase(repository));
    }

    private static LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase(DungeonMapRepository repository) {
        SnapshotParts parts = snapshotParts(repository);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase =
                new InspectDungeonSelectionUseCase(parts.derive());
        return new LoadDungeonSnapshotUseCase(
                parts.loadDungeonMapUseCase(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase(),
                inspectDungeonSelectionUseCase);
    }

    private static ApplyDungeonEditorOperationUseCase authoredOperationUseCase(
            SnapshotParts parts,
            DungeonMapRepository repository
    ) {
        return new ApplyDungeonEditorOperationUseCase(
                parts.loadDungeonMapUseCase(),
                repository,
                parts.derive(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase());
    }

    private static SnapshotParts snapshotParts(DungeonMapRepository repository) {
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        return new SnapshotParts(
                new LoadDungeonMapUseCase(repository),
                new PublishDungeonEditorHandlesUseCase(),
                derive,
                new AssembleDungeonSnapshotUseCase(derive));
    }

    record RuntimeUseCases(
            AuthoredUseCases authored,
            DungeonEditorDungeonState dungeonState,
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
    }

    private record SnapshotParts(
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase,
            BuildDungeonDerivedStateUseCase derive,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase
    ) {
    }

    record AuthoredUseCases(
            SearchDungeonEditorMapCatalogUseCase searchMapsUseCase,
            CreateDungeonEditorMapCatalogUseCase createMapUseCase,
            RenameDungeonEditorMapCatalogUseCase renameMapUseCase,
            DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase,
            LoadDungeonEditorAuthoredMapUseCase loadMapUseCase,
            PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase,
            ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase,
            ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase,
            SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase,
            SaveDungeonEditorAuthoredLabelNameUseCase saveLabelNameUseCase,
            SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase,
            SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase,
            SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase,
            CreateDungeonEditorAuthoredStairUseCase createStairUseCase,
            CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase,
            CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase,
            DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase,
            DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase,
            DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase
    ) {
    }
}
