package features.appshell.frame;

import features.appshell.frame.input.ComposeFrameInput;
import javafx.geometry.Orientation;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Clean cockpit frame owner for the packaged app shell.
 */
@SuppressWarnings("unused")
public final class FrameObject {

    private final ComposeFrameInput.FrameInput frame;

    public FrameObject(ComposeFrameInput input) {
        ComposeFrameInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        BorderPane shell = new BorderPane();

        HBox toolbar = new HBox(8);
        toolbar.getStyleClass().add("toolbar");
        toolbar.setAlignment(Pos.CENTER_LEFT);
        if (resolvedInput.toolbarContent() != null) {
            toolbar.getChildren().add(resolvedInput.toolbarContent());
        }
        Region toolbarSpacer = new Region();
        HBox.setHgrow(toolbarSpacer, Priority.ALWAYS);
        toolbar.getChildren().add(toolbarSpacer);
        shell.setTop(toolbar);

        VBox sidebar = new VBox();
        sidebar.getStyleClass().add("nav-sidebar");
        sidebar.setAlignment(Pos.TOP_CENTER);
        if (resolvedInput.navigationContent() != null) {
            sidebar.getChildren().add(resolvedInput.navigationContent());
        }
        shell.setLeft(sidebar);

        VBox controlsPanel = new VBox();
        controlsPanel.getStyleClass().add("control-panel");
        controlsPanel.setPrefWidth(240);
        controlsPanel.setMinWidth(200);
        controlsPanel.setMaxHeight(Double.MAX_VALUE);
        Node controlsNode = resolvedInput.controlsContent();
        if (controlsNode != null) {
            controlsPanel.getChildren().add(controlsNode);
            VBox.setVgrow(controlsNode, Priority.ALWAYS);
        } else {
            VBox placeholder = new VBox(
                    8,
                    new Label("Controls"),
                    new Label("Keine lokalen Controls"));
            placeholder.setFillWidth(true);
            placeholder.setAlignment(Pos.TOP_LEFT);
            placeholder.setPadding(new javafx.geometry.Insets(12));
            controlsPanel.getChildren().add(placeholder);
        }

        Node mainNode = resolvedInput.mainContent();
        if (mainNode == null) {
            VBox placeholder = new VBox(
                    8,
                    new Label("Main"),
                    new Label("Kein lokaler Inhalt"));
            placeholder.setFillWidth(true);
            placeholder.setAlignment(Pos.TOP_LEFT);
            placeholder.setPadding(new javafx.geometry.Insets(12));
            mainNode = placeholder;
        }
        StackPane mainPanel = new StackPane(mainNode);

        Node detailsNode = resolvedInput.detailsContent();
        if (detailsNode == null) {
            VBox placeholder = new VBox(
                    8,
                    new Label("Details"),
                    new Label("Keine lokalen Details"));
            placeholder.setFillWidth(true);
            placeholder.setAlignment(Pos.TOP_LEFT);
            placeholder.setPadding(new javafx.geometry.Insets(12));
            detailsNode = placeholder;
        }
        StackPane detailsContainer = new StackPane(detailsNode);

        Node stateNode = resolvedInput.stateContent();
        if (stateNode == null) {
            VBox placeholder = new VBox(
                    8,
                    new Label("Status"),
                    new Label("Kein lokaler Zustand"));
            placeholder.setFillWidth(true);
            placeholder.setAlignment(Pos.TOP_LEFT);
            placeholder.setPadding(new javafx.geometry.Insets(12));
            stateNode = placeholder;
        }
        StackPane stateContainer = new StackPane(stateNode);

        VBox leftColumn = new VBox();
        VBox.setVgrow(controlsPanel, Priority.NEVER);
        VBox.setVgrow(mainPanel, Priority.ALWAYS);
        leftColumn.getChildren().addAll(controlsPanel, mainPanel);

        SplitPane rightSplit = new SplitPane();
        rightSplit.setOrientation(Orientation.VERTICAL);
        rightSplit.getItems().addAll(detailsContainer, stateContainer);
        rightSplit.setDividerPositions(0.45);

        SplitPane mainSplit = new SplitPane();
        mainSplit.setOrientation(Orientation.HORIZONTAL);
        mainSplit.getItems().addAll(leftColumn, rightSplit);
        mainSplit.setDividerPositions(0.62);

        shell.setCenter(mainSplit);
        this.frame = new ComposeFrameInput.FrameInput(shell);
    }

    public ComposeFrameInput.FrameInput composeFrame(ComposeFrameInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return frame;
    }
}
