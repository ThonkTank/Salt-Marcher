package src.view.leftbartabs.dungeontravel;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

public final class DungeonTravelContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("dungeon-travel"),
                new NavigationGroupSpec("world", "World", 20),
                20,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/dungeontravel/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new DungeonTravelBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
