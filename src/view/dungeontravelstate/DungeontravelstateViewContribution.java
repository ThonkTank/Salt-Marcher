package src.view.dungeontravelstate;

import javafx.scene.Node;
import shell.host.ContributionKey;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellRuntimeStateSpec;
import shell.host.ShellScreen;
import shell.host.ShellSlot;
import shell.host.ShellViewContribution;
import src.view.dungeontravelshared.assembly.DungeonTravelRuntimeSession;

import java.util.Map;

public final class DungeontravelstateViewContribution implements ShellViewContribution {

    public DungeontravelstateViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("dungeon-travel-state"), "Travel", 20);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        DungeonTravelRuntimeSession session = DungeonTravelRuntimeSession.from(runtimeContext);
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Dungeon Travel State";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.COCKPIT_STATE, session.state());
            }
        };
    }
}
