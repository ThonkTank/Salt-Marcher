package src.view.dungeoneditor;

import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import shell.api.ShellViewContribution;
import src.view.dungeoneditor.assembly.DungeonEditorAssembly;

/**
 * Editor tab root for dungeon map work.
 */
public final class DungeoneditorViewContribution implements ShellViewContribution {

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                DungeonEditorAssembly.navigationGraphicSupplier(),
                ShellTabMode.EDITOR
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return DungeonEditorAssembly.createScreen(runtimeContext);
    }
}
