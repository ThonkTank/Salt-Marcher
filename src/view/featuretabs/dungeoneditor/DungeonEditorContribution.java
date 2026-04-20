package src.view.featuretabs.dungeoneditor;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;

public final class DungeonEditorContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonEditorContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                null,
                ShellTabMode.EDITOR);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new DungeonEditorBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
