package src.view.creatures;

import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import shell.api.ShellViewContribution;
import src.view.creatures.assembly.CreaturesAssembly;

/**
 * Read-only creatures catalog tab root.
 */
public final class CreaturesViewContribution implements ShellViewContribution {

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("creatures"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                CreaturesAssembly.navigationGraphicSupplier(),
                ShellTabMode.RUNTIME
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return CreaturesAssembly.createScreen(runtimeContext);
    }
}
