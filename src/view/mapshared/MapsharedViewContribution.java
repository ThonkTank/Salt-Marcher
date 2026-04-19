package src.view.mapshared;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import shell.api.ShellViewContribution;

public final class MapsharedViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public MapsharedViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("map-shared-state"), "Map", 90);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Map Shared";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of();
            }
        };
    }
}
