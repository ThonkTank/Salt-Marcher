package src.view.topbar;

import javafx.scene.Node;
import javafx.scene.control.MenuButton;
import shell.host.ContributionKey;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellTopBarSpec;
import shell.host.ShellViewContribution;
import shell.panel.ShellSlot;

import java.util.Map;

public final class TopbarViewContribution implements ShellViewContribution {
    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("global-tools"), 10);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Global Tools";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.TOP_BAR, new MenuButton("Tools"));
            }
        };
    }
}
