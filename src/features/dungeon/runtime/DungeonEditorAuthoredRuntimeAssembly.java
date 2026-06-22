package src.features.dungeon.runtime;

import java.util.Objects;
import shell.api.ServiceRegistry;
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
import src.domain.dungeon.model.runtime.usecase.MoveDungeonEditorHandleUseCase;
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

final class DungeonEditorAuthoredRuntimeAssembly {

    private DungeonEditorAuthoredRuntimeAssembly() {
    }

    static DungeonEditorAuthoredRuntimeOperations create(
            ServiceRegistry registry,
            DungeonEditorMainViewInteractionState interactionState
    ) {
        ServiceRegistry safeRegistry = Objects.requireNonNull(registry, "registry");
        DungeonEditorMainViewInteractionState safeInteractionState =
                Objects.requireNonNull(interactionState, "interactionState");
        DungeonEditorDungeonState dungeonState = new DungeonEditorDungeonState();
        DungeonAuthoredPublishedStateRepository authoredPublishedState =
                safeRegistry.require(DungeonAuthoredPublishedStateRepository.class);
        DungeonEditorSnapshotPublishedStateRepository editorPublishedState =
                safeRegistry.require(DungeonEditorSnapshotPublishedStateRepository.class);
        AuthoredUseCases authored = authoredUseCases(safeRegistry, authoredPublishedState, dungeonState);
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
        effectUseCase.publishCurrent();
        return operations(runtimeUseCases(
                authored,
                dungeonState,
                workflow,
                mainViewInterpreter,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase));
    }

    private static DungeonEditorAuthoredRuntimeOperations operations(RuntimeUseCases runtime) {
        ApplyDungeonEditorSelectionUseCase selection = selection(runtime);
        return new DungeonEditorAuthoredRuntimeOperations(new DungeonEditorAuthoredRuntimeOperationUseCases(
                mapUseCases(runtime),
                projectionUseCases(runtime),
                DungeonEditorAuthoredToolWorkflowUseCases.create(runtime),
                new DungeonEditorWallBoundaryDraftRuntimeOperation(runtime),
                new DungeonEditorDoorBoundaryDraftRuntimeOperation(runtime),
                new DungeonEditorCorridorDraftRuntimeOperation(runtime),
                new DungeonEditorSelectionHandlePreviewRuntimeOperation(selection),
                selection,
                new MoveDungeonEditorHandleUseCase(
                        runtime.workflow(),
                        runtime.effectUseCase(),
                        runtime.authored().handleOperationUseCase()),
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
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new SetDungeonEditorToolUseCase(
                        runtime.workflow(),
                        runtime.snapshotPublicationUseCase()),
                new ShiftDungeonEditorProjectionLevelUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new SetDungeonEditorOverlayUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
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

    private static ApplyDungeonEditorSelectionUseCase selection(RuntimeUseCases runtime) {
        return new ApplyDungeonEditorSelectionUseCase(
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
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateRepository publishedState,
            DungeonEditorDungeonState dungeonState
    ) {
        ApplyDungeonMapCatalogUseCase catalogUseCase = mapCatalogUseCase(registry);
        LoadDungeonSnapshotUseCase loadSnapshotUseCase = loadDungeonSnapshotUseCase(registry);
        DungeonMapRepository repository = registry.require(DungeonMapRepository.class);
        SnapshotParts snapshotParts = snapshotParts(registry);
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
                        repository,
                        snapshotParts.derive(),
                        snapshotParts.assembleDungeonSnapshotUseCase(),
                        snapshotParts.publishDungeonEditorHandlesUseCase(),
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

    private static ApplyDungeonMapCatalogUseCase mapCatalogUseCase(ServiceRegistry registry) {
        DungeonMapRepository repository = registry.require(DungeonMapRepository.class);
        return new ApplyDungeonMapCatalogUseCase(
                new SearchDungeonMapsUseCase(repository),
                new CreateDungeonMapUseCase(repository),
                new RenameDungeonMapUseCase(repository),
                new DeleteDungeonMapUseCase(repository));
    }

    private static LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase(ServiceRegistry registry) {
        SnapshotParts parts = snapshotParts(registry);
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

    private static SnapshotParts snapshotParts(ServiceRegistry registry) {
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        return new SnapshotParts(
                new LoadDungeonMapUseCase(registry.require(DungeonMapRepository.class)),
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
