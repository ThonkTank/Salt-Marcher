package src.domain.dungeon;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.model.editor.application.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeon.model.editor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.model.session.repository.DungeonEditorDungeonRepository;

final class DungeonEditorServiceAssembly {

    DungeonEditorApplicationService create(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, "registry");
        DungeonEditorDungeonRepository dungeonRepository = new DungeonEditorDungeonRepository(
                services.require(DungeonCatalogApplicationService.class),
                services.require(DungeonAuthoredApplicationService.class));
        DungeonEditorDungeonPort dungeonPort = new DungeonEditorDungeonPort(
                services.require(DungeonMapCatalogModel.class),
                services.require(DungeonAuthoredReadModel.class),
                services.require(DungeonAuthoredMutationModel.class));
        return new DungeonEditorApplicationService(new ApplyDungeonEditorSessionUseCase(dungeonRepository, dungeonPort));
    }
}
