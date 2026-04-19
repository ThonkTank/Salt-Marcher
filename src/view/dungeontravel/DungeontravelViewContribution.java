package src.view.dungeontravel;

import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import shell.api.ShellViewContribution;
import src.view.dungeontravel.assembly.DungeonTravelAssembly;

/**
 * Travel/runtime tab root for dungeon navigation.
 */
public final class DungeontravelViewContribution implements ShellViewContribution {

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-travel"),
                new NavigationGroupSpec("world", "World", 20),
                20,
                false,
                DungeonTravelAssembly.navigationGraphicSupplier(),
                ShellTabMode.RUNTIME
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return DungeonTravelAssembly.createScreen(runtimeContext);
    }
}
