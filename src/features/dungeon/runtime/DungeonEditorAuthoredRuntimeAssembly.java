package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;

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
        InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
                new InterpretDungeonEditorMainViewInputUseCase(safeInteractionState);
        return safeDependencies.editorRuntimeApplicationService().openSession(
                dungeonState,
                (authored, authoredCommands, authoredService, runtimeDungeonState, workflow, snapshotBuilder,
                        snapshotPublicationUseCase, effectUseCase) -> assemblyResult(
                        authored,
                        authoredCommands,
                        authoredService,
                        runtimeDungeonState,
                        workflow,
                        mainViewInterpreter,
                        snapshotBuilder,
                        snapshotPublicationUseCase,
                        effectUseCase));
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
            DungeonAuthoredApplicationService.RuntimeCommands authoredCommands,
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
                authoredCommands,
                authoredService,
                dungeonState,
                workflow,
                mainViewInterpreter,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase);
    }

    private static AssemblyResult assemblyResult(
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
        DungeonEditorRuntimeOperationResult initialResult =
                DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        return new AssemblyResult(operations(runtimeUseCases(
                authored,
                authoredCommands,
                authoredService,
                dungeonState,
                workflow,
                mainViewInterpreter,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase)), initialResult);
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

}
