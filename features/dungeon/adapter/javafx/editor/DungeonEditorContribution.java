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
import features.dungeon.application.editor.DungeonEditorApiFacade;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.dungeon.api.editor.DungeonEditorApi;
import platform.ui.UiDispatcher;

public final class DungeonEditorContribution implements ShellContribution {

    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;
    private final DungeonEditorApi editorApi;
    private final UiDispatcher uiDispatcher;

    public DungeonEditorContribution(DungeonEditorRuntimeDependencies dependencies) {
        this(assembly(dependencies));
    }

    private DungeonEditorContribution(Assembly assembly) {
        this(assembly.runtimeRoot(), assembly.editorApi(), assembly.uiDispatcher());
    }

    public DungeonEditorContribution(
            DungeonEditorFeatureRuntimeRoot runtimeRoot,
            DungeonEditorApi editorApi,
            UiDispatcher uiDispatcher
    ) {
        this.runtimeRoot = Objects.requireNonNull(runtimeRoot, "runtimeRoot");
        this.editorApi = Objects.requireNonNull(editorApi, "editorApi");
        this.uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
    }

    private static Assembly assembly(DungeonEditorRuntimeDependencies dependencies) {
        DungeonEditorRuntimeDependencies safeDependencies = Objects.requireNonNull(dependencies, "dependencies");
        DungeonEditorFeatureRuntimeRoot root = DungeonEditorFeatureRuntimeRoot.create(safeDependencies);
        return new Assembly(root, new DungeonEditorApiFacade(root, safeDependencies.uiDispatcher()),
                safeDependencies.uiDispatcher());
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
        return new DungeonEditorBinder(runtimeRoot, editorApi, uiDispatcher).bind();
    }

    private record Assembly(
            DungeonEditorFeatureRuntimeRoot runtimeRoot,
            DungeonEditorApi editorApi,
            UiDispatcher uiDispatcher
    ) {
    }
}
