package src.data.dungeoneditor;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeoneditor.DungeonEditorApplicationService;

public final class DungeonEditorServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonEditorServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        services.registerFactory(
                DungeonEditorApplicationService.class,
                registry -> new DungeonEditorApplicationService(
                        registry.require(DungeonApplicationService.class)));
    }
}
