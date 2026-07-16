package src.view.leftbartabs.dungeoneditor;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import src.features.dungeon.runtime.DungeonEditorRuntimeDependencies;

public final class DungeonEditorContribution implements ShellContribution {

    private final DungeonEditorRuntimeDependencies dependencies;

    public DungeonEditorContribution(DungeonEditorRuntimeDependencies dependencies) {
        this.dependencies = Objects.requireNonNull(dependencies, "dependencies");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                NavigationGraphicResource.of("/view/leftbartabs/dungeoneditor/navigation-icon.svg"),
                ShellLeftBarTabMode.EDITOR);
    }

    @Override
    public ShellBinding bind() {
        return new DungeonEditorBinder(dependencies).bind();
    }
}
