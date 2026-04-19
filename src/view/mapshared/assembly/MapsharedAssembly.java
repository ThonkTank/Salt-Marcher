package src.view.mapshared.assembly;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;

public final class MapsharedAssembly {

    private MapsharedAssembly() {
    }

    public static ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
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
