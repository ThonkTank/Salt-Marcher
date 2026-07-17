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
import features.dungeon.api.editor.DungeonEditorApi;

public final class DungeonEditorContribution implements ShellContribution {

    private final DungeonEditorApi editorApi;

    public DungeonEditorContribution(DungeonEditorApi editorApi) {
        this.editorApi = Objects.requireNonNull(editorApi, "editorApi");
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
        return new DungeonEditorBinder(editorApi).bind();
    }
}
