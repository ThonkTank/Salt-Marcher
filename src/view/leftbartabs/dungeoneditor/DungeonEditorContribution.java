package src.view.leftbartabs.dungeoneditor;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

public final class DungeonEditorContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                null,
                ShellLeftBarTabMode.EDITOR);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new DungeonEditorBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }
}
