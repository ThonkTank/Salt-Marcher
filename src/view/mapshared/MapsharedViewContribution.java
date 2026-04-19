package src.view.mapshared;

import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellViewContribution;
import src.view.mapshared.assembly.MapsharedAssembly;

public final class MapsharedViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public MapsharedViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("map-shared-state"), "Map", 90);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return MapsharedAssembly.createScreen(runtimeContext);
    }
}
