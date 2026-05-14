package src.data.dungeoneditor;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.dungeoneditor.DungeonEditorApplicationService;

public final class DungeonEditorServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonEditorServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        DungeonEditorServiceAssembly assembly = new DungeonEditorServiceAssembly();
        services.registerFactory(
                DungeonEditorApplicationService.class,
                assembly::create);
    }
}
