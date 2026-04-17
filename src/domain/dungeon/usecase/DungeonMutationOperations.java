package src.domain.dungeon.usecase;

import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DeleteDungeonMapResult;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.repository.DungeonMapRepository;

/**
 * Internal mutation coordinator for the public dungeon API facade.
 */
public final class DungeonMutationOperations {

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;

    public DungeonMutationOperations(DungeonDocumentStore store, DungeonMapRepository repository) {
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        this.applyDungeonEditorOperationUseCase = new ApplyDungeonEditorOperationUseCase(store, derive);
        this.createDungeonMapUseCase = new CreateDungeonMapUseCase(repository, store);
        this.deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository, store);
    }

    public DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        return applyDungeonEditorOperationUseCase.execute(operation);
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        return createDungeonMapUseCase.execute(command);
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        return deleteDungeonMapUseCase.execute(command);
    }
}
