package src.view.encounter;

import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import shell.api.ShellViewContribution;
import src.view.encounter.assembly.EncounterAssembly;

public final class EncounterViewContribution implements ShellViewContribution {

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("encounter"),
                new NavigationGroupSpec("world", "World", 20),
                30,
                false,
                EncounterAssembly.navigationGraphicSupplier(),
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return EncounterAssembly.createScreen(runtimeContext);
    }
}
