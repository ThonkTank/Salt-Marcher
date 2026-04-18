package src.view.dungeontravelstate;

import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellViewContribution;
import src.view.dungeontravelstate.assembly.DungeonTravelStateAssembly;

public final class DungeontravelstateViewContribution implements ShellViewContribution {

    public DungeontravelstateViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("dungeon-travel-state"), "Travel", 20);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return DungeonTravelStateAssembly.createScreen(runtimeContext);
    }
}
