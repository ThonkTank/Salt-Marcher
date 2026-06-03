package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonEditorRuntimeFoundationServiceAssembly {

    private DungeonEditorRuntimeFoundationServiceAssembly() {
    }

    static RuntimeFoundation create(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState,
            DungeonEditorPublishedStateServiceAssembly editorPublishedState
    ) {
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState dungeonState =
                new src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState();
        DungeonEditorAuthoredUseCasesServiceAssembly.AuthoredUseCases authoredUseCases =
                DungeonEditorAuthoredUseCasesServiceAssembly.create(registry, publishedState, dungeonState);
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow workflow =
                new src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow();
        src.domain.dungeon.model.worldspace.usecase.InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
                new src.domain.dungeon.model.worldspace.usecase.InterpretDungeonEditorMainViewInputUseCase();
        src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorSnapshotUseCase snapshotBuilder =
                new src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorSnapshotUseCase(
                        authoredUseCases.searchMapsUseCase(),
                        authoredUseCases.loadMapUseCase(),
                        authoredUseCases.previewOperationUseCase(),
                        dungeonState);
        src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase =
                new src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorSnapshotUseCase(editorPublishedState);
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSessionEffectUseCase effectUseCase =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSessionEffectUseCase(
                        workflow,
                        authoredUseCases.applyOperationUseCase(),
                        dungeonState,
                        snapshotBuilder,
                        snapshotPublicationUseCase);
        effectUseCase.publishCurrent();
        return new RuntimeFoundation(
                authoredUseCases,
                dungeonState,
                workflow,
                mainViewInterpreter,
                snapshotBuilder,
                snapshotPublicationUseCase,
                effectUseCase);
    }

    record RuntimeFoundation(
            DungeonEditorAuthoredUseCasesServiceAssembly.AuthoredUseCases authoredUseCases,
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState dungeonState,
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow workflow,
            src.domain.dungeon.model.worldspace.usecase.InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase,
            src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
    }
}
