package src.view.dungeoneditor;

import javafx.scene.Node;
import shell.host.ContributionKey;
import shell.host.NavigationGroupSpec;
import shell.host.NavigationIcons;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellTabMode;
import shell.host.ShellTabSpec;
import shell.host.ShellViewContribution;
import src.view.dungeonshared.assembly.DungeonSelectionInspectorShellAdapter;
import shell.host.ShellSlot;
import src.view.dungeoneditor.interactor.DungeonEditorInteractor;

import java.util.Map;

/**
 * Editor tab root for dungeon map work.
 */
public final class DungeoneditorViewContribution implements ShellViewContribution {

    public DungeoneditorViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                ShellTabMode.EDITOR
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        DungeonEditorInteractor interactor = new DungeonEditorInteractor(
                new DungeonSelectionInspectorShellAdapter(runtimeContext.inspector()));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Dungeon Editor";
            }

            @Override
            public String getNavigationLabel() {
                return "Dungeon";
            }

            @Override
            public Node getNavigationGraphic() {
                return NavigationIcons.dungeonEditor();
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, interactor.controls(),
                        ShellSlot.COCKPIT_MAIN, interactor.workspace(),
                        ShellSlot.COCKPIT_STATE, interactor.state()
                );
            }
        };
    }
}
