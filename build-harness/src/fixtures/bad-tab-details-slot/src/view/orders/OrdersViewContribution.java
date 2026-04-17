package src.view.orders;

import javafx.scene.Node;
import javafx.scene.control.Label;
import shell.host.ContributionKey;
import shell.host.NavigationGroupSpec;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellSlot;
import shell.host.ShellTabMode;
import shell.host.ShellTabSpec;
import shell.host.ShellViewContribution;

import java.util.Map;

public final class OrdersViewContribution implements ShellViewContribution {
    public OrdersViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("orders"),
                new NavigationGroupSpec("session", "Session", 10),
                20,
                false,
                ShellTabMode.EDITOR);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_MAIN, new Label("Main"),
                        ShellSlot.COCKPIT_DETAILS, new Label("Details"));
            }
        };
    }
}
