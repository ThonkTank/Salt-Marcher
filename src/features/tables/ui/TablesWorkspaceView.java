package features.tables.ui;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import ui.shell.AppView;

import java.util.List;
import java.util.Objects;

/**
 * Composite editor that hosts encounter-table and loot-table editors behind one nav entry.
 */
public final class TablesWorkspaceView implements AppView {

    private enum Mode {
        ENCOUNTER,
        LOOT
    }

    private final AppView encounterView;
    private final AppView lootView;
    private final StackPane controlsHost = new StackPane();
    private final StackPane mainHost = new StackPane();
    private final StackPane stateHost = new StackPane();
    private final HBox modeToggle = new HBox(4);
    private final ToggleButton encounterButton = new ToggleButton("Encounter");
    private final ToggleButton lootButton = new ToggleButton("Loot");

    private Mode activeMode = Mode.ENCOUNTER;
    private boolean showing = false;

    public TablesWorkspaceView(AppView encounterView, AppView lootView) {
        this.encounterView = Objects.requireNonNull(encounterView, "encounterView");
        this.lootView = Objects.requireNonNull(lootView, "lootView");

        ToggleGroup modeGroup = new ToggleGroup();
        encounterButton.setToggleGroup(modeGroup);
        lootButton.setToggleGroup(modeGroup);
        encounterButton.getStyleClass().add("tool-btn");
        lootButton.getStyleClass().add("tool-btn");
        encounterButton.setSelected(true);
        encounterButton.setOnAction(event -> switchMode(Mode.ENCOUNTER));
        lootButton.setOnAction(event -> switchMode(Mode.LOOT));

        modeToggle.setAlignment(Pos.CENTER_LEFT);
        modeToggle.getChildren().addAll(encounterButton, lootButton);

        refreshHosts();
    }

    @Override
    public Node getMainContent() {
        return mainHost;
    }

    @Override
    public String getTitle() {
        return "Tabellen";
    }

    @Override
    public String getIconText() {
        return "\uD83D\uDCCB";
    }

    @Override
    public List<Node> getToolbarItems() {
        return List.of(modeToggle);
    }

    @Override
    public Node getControlsContent() {
        return controlsHost;
    }

    @Override
    public Node getStateContent() {
        return stateHost;
    }

    @Override
    public void onShow() {
        showing = true;
        activeView().onShow();
    }

    @Override
    public void onHide() {
        showing = false;
        activeView().onHide();
    }

    private void switchMode(Mode nextMode) {
        if (nextMode == activeMode) {
            syncToggleSelection();
            return;
        }
        if (showing) {
            activeView().onHide();
        }
        activeMode = nextMode;
        refreshHosts();
        syncToggleSelection();
        if (showing) {
            activeView().onShow();
        }
    }

    private void refreshHosts() {
        AppView activeView = activeView();
        setHostContent(controlsHost, activeView.getControlsContent());
        setHostContent(mainHost, activeView.getMainContent());
        setHostContent(stateHost, activeView.getStateContent());
    }

    private void setHostContent(StackPane host, Node content) {
        if (content == null) {
            host.getChildren().clear();
            return;
        }
        if (!host.getChildren().contains(content)) {
            host.getChildren().setAll(content);
        }
    }

    private void syncToggleSelection() {
        encounterButton.setSelected(activeMode == Mode.ENCOUNTER);
        lootButton.setSelected(activeMode == Mode.LOOT);
    }

    private AppView activeView() {
        return activeMode == Mode.ENCOUNTER ? encounterView : lootView;
    }
}
