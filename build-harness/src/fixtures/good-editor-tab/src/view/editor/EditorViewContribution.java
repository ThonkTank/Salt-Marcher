package src.view.editor;

import javafx.scene.Node;
import javafx.scene.control.Label;
import shell.host.ContributionKey;
import shell.host.NavigationGroupSpec;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellTabMode;
import shell.host.ShellTabSpec;
import shell.host.ShellViewContribution;
import shell.panel.ShellSlot;

import java.util.Map;

public final class EditorViewContribution implements ShellViewContribution {
    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("editor"),
                new NavigationGroupSpec("tools", "Tools", 10),
                20,
                false,
                ShellTabMode.EDITOR);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Editor";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_MAIN, new Label("Main"),
                        ShellSlot.COCKPIT_STATE, new Label("Editor State"));
            }
        };
    }
}
