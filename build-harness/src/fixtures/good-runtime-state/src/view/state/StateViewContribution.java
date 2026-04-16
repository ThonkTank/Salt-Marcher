package src.view.state;

import javafx.scene.Node;
import javafx.scene.control.Label;
import shell.host.ContributionKey;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellRuntimeStateSpec;
import shell.host.ShellScreen;
import shell.host.ShellViewContribution;
import shell.panel.ShellSlot;

import java.util.Map;

public final class StateViewContribution implements ShellViewContribution {
    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("party-state"), "Party", 10);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Party State";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.COCKPIT_STATE, new Label("State"));
            }
        };
    }
}
