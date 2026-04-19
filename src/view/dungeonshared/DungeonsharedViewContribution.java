package src.view.dungeonshared;

import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellViewContribution;
import src.view.dungeonshared.assembly.DungeonsharedAssembly;

public final class DungeonsharedViewContribution implements ShellViewContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public DungeonsharedViewContribution() {
        // Required by shell discovery.
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("dungeon-travel-state"), "Travel", 20);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return DungeonsharedAssembly.createScreen(runtimeContext);
    }
}
