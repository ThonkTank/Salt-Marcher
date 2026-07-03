package src.view.leftbartabs.worldplanner;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellRuntimeContext;

public final class WorldPlannerContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("world-planner"),
                new NavigationGroupSpec("planning", "Planning", 10),
                25,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/worldplanner/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new WorldPlannerBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
