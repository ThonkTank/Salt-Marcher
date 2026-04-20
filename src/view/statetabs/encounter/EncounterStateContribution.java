package src.view.statetabs.encounter;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellStateTabSpec;

public final class EncounterStateContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public EncounterStateContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellStateTabSpec(
                new ContributionKey("encounter"),
                "Encounter",
                30);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new EncounterStateBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
