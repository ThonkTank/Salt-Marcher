package features.dungeon.adapter.javafx.editor;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import platform.ui.UiDispatcher;

public final class DungeonEditorContribution implements ShellContribution {

    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;
    private final UiDispatcher uiDispatcher;

    public DungeonEditorContribution(DungeonEditorRuntimeDependencies dependencies) {
        DungeonEditorRuntimeDependencies safeDependencies = Objects.requireNonNull(dependencies, "dependencies");
        this.runtimeRoot = DungeonEditorFeatureRuntimeRoot.create(safeDependencies);
        this.uiDispatcher = safeDependencies.uiDispatcher();
    }

    public DungeonEditorContribution(
            DungeonEditorFeatureRuntimeRoot runtimeRoot,
            UiDispatcher uiDispatcher
    ) {
        this.runtimeRoot = Objects.requireNonNull(runtimeRoot, "runtimeRoot");
        this.uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
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
        return new DungeonEditorBinder(runtimeRoot, uiDispatcher).bind();
    }
}
