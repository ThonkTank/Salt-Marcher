package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SelectDungeonEditorMapUseCase;

final class DungeonEditorMapCatalogRuntimeOperations {
    private final SelectDungeonEditorMapUseCase selectMapUseCase;
    private final CreateDungeonEditorMapUseCase createMapUseCase;
    private final RenameDungeonEditorMapUseCase renameMapUseCase;
    private final DeleteDungeonEditorMapUseCase deleteMapUseCase;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;

    DungeonEditorMapCatalogRuntimeOperations(
            DungeonEditorAuthoredRuntimeOperationUseCases.MapUseCases useCases,
            DungeonEditorStairDraftRuntimeOperation stairDraftOperation
    ) {
        DungeonEditorAuthoredRuntimeOperationUseCases.MapUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        this.stairDraftOperation = Objects.requireNonNull(stairDraftOperation, "stairDraftOperation");
        selectMapUseCase = Objects.requireNonNull(safeUseCases.select(), "selectMapUseCase");
        createMapUseCase = Objects.requireNonNull(safeUseCases.create(), "createMapUseCase");
        renameMapUseCase = Objects.requireNonNull(safeUseCases.rename(), "renameMapUseCase");
        deleteMapUseCase = Objects.requireNonNull(safeUseCases.delete(), "deleteMapUseCase");
    }

    DungeonEditorRuntimeOperationResult selectMap(long mapIdValue) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(selectMapUseCase.execute(mapIdValue));
    }

    DungeonEditorRuntimeOperationResult createMap(String mapName) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(createMapUseCase.execute(mapName));
    }

    DungeonEditorRuntimeOperationResult renameMap(long mapIdValue, String mapName) {
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(renameMapUseCase.execute(mapIdValue, mapName));
    }

    DungeonEditorRuntimeOperationResult deleteMap(long mapIdValue) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(deleteMapUseCase.execute(mapIdValue));
    }
}
