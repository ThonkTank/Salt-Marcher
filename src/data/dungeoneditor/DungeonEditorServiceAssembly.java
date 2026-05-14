package src.data.dungeoneditor;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeoneditor.DungeonEditorApplicationService;
import src.domain.dungeoneditor.application.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeoneditor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeoneditor.model.session.repository.DungeonEditorDungeonRepository;

final class DungeonEditorServiceAssembly {

    DungeonEditorApplicationService create(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, "registry");
        DungeonEditorDungeonRepository dungeonRepository = new ApplicationDungeonEditorDungeonRepository(
                services.require(DungeonCatalogApplicationService.class),
                services.require(DungeonAuthoredApplicationService.class));
        DungeonEditorDungeonPort dungeonPort = new ApplicationDungeonEditorDungeonPort(
                services.require(DungeonMapCatalogModel.class),
                services.require(DungeonAuthoredReadModel.class),
                services.require(DungeonAuthoredMutationModel.class));
        return new DungeonEditorApplicationService(new ApplyDungeonEditorSessionUseCase(dungeonRepository, dungeonPort));
    }
}
