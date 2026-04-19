package src.view.models;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContributionModel;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import src.domain.dungeon.DungeonApplicationService;
import src.view.views.DungeonEditorControlsView;
import src.view.views.DungeonEditorMainView;
import src.view.views.DungeonEditorStateView;

public final class DungeonEditorTabModel implements ShellContributionModel {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonEditorTabModel() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-editor"),
                new NavigationGroupSpec("world", "World", 20),
                10,
                true,
                null,
                ShellTabMode.EDITOR);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        DungeonApplicationService dungeon = new DungeonApplicationService();
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonEditorMainView main = new DungeonEditorMainView();
        DungeonEditorStateView state = new DungeonEditorStateView();
        Runnable refresh = () -> {
            String snapshotText = String.valueOf(dungeon.loadSnapshot());
            main.showStatus(snapshotText);
            state.showState("Snapshot loaded through DungeonApplicationService.");
        };
        controls.onCreateMap(refresh);
        refresh.run();
        return new Binding(controls, main, state);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Editor";
        }

        @Override
        public String navigationLabel() {
            return "Dungeon";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
