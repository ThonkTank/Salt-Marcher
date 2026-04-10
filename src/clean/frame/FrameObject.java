package clean.frame;

import clean.frame.input.ComposeFrameInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Frame owner for the clean four-panel cockpit shell.
 */
@SuppressWarnings("unused")
public final class FrameObject {

    public ComposeFrameInput.FrameInput composeFrame(ComposeFrameInput input) {
        ComposeFrameInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        BorderPane root = new BorderPane();
        root.getStyleClass().add("clean-root");

        StackPane toolbarHost = new StackPane(resolvedInput.toolbarContent() == null ? new Region() : resolvedInput.toolbarContent());
        toolbarHost.getStyleClass().add("toolbar-shell");
        toolbarHost.setPadding(new Insets(16));
        root.setTop(toolbarHost);

        StackPane navigationHost = new StackPane(resolvedInput.navigationContent() == null ? new Region() : resolvedInput.navigationContent());
        navigationHost.getStyleClass().add("navigation-shell");
        navigationHost.setPadding(new Insets(16));
        navigationHost.setPrefWidth(180);
        navigationHost.setMinWidth(180);
        root.setLeft(navigationHost);

        Label controlsTitleLabel = new Label("Controls");
        controlsTitleLabel.getStyleClass().add("panel-title");
        StackPane controlsContentHost = new StackPane(resolvedInput.controlsContent() == null ? new Region() : resolvedInput.controlsContent());
        controlsContentHost.getStyleClass().add("panel-content");
        VBox controlsPanel = new VBox(10, controlsTitleLabel, controlsContentHost);
        controlsPanel.getStyleClass().add("panel-shell");
        controlsPanel.setPadding(new Insets(14));

        Label mainTitleLabel = new Label("Main");
        mainTitleLabel.getStyleClass().add("panel-title");
        StackPane mainContentHost = new StackPane(resolvedInput.mainContent() == null ? new Region() : resolvedInput.mainContent());
        mainContentHost.getStyleClass().add("panel-content");
        VBox mainPanel = new VBox(10, mainTitleLabel, mainContentHost);
        mainPanel.getStyleClass().add("panel-shell");
        mainPanel.setPadding(new Insets(14));
        VBox.setVgrow(mainPanel, Priority.ALWAYS);
        VBox.setVgrow(mainContentHost, Priority.ALWAYS);

        VBox leftColumn = new VBox(12, controlsPanel, mainPanel);
        leftColumn.getStyleClass().add("column-stack");
        leftColumn.setPadding(new Insets(16, 12, 16, 0));
        leftColumn.setPrefWidth(430);

        Label detailsTitleLabel = new Label("Details");
        detailsTitleLabel.getStyleClass().add("panel-title");
        StackPane detailsContentHost = new StackPane(resolvedInput.detailsContent() == null ? new Region() : resolvedInput.detailsContent());
        detailsContentHost.getStyleClass().add("panel-content");
        VBox detailsPanel = new VBox(10, detailsTitleLabel, detailsContentHost);
        detailsPanel.getStyleClass().add("panel-shell");
        detailsPanel.setPadding(new Insets(14));
        VBox.setVgrow(detailsPanel, Priority.ALWAYS);
        VBox.setVgrow(detailsContentHost, Priority.ALWAYS);

        Label stateTitleLabel = new Label("State");
        stateTitleLabel.getStyleClass().add("panel-title");
        StackPane stateContentHost = new StackPane(resolvedInput.stateContent() == null ? new Region() : resolvedInput.stateContent());
        stateContentHost.getStyleClass().add("panel-content");
        VBox statePanel = new VBox(10, stateTitleLabel, stateContentHost);
        statePanel.getStyleClass().add("panel-shell");
        statePanel.setPadding(new Insets(14));
        VBox.setVgrow(statePanel, Priority.ALWAYS);
        VBox.setVgrow(stateContentHost, Priority.ALWAYS);

        VBox rightColumn = new VBox(12, detailsPanel, statePanel);
        rightColumn.getStyleClass().add("column-stack");
        rightColumn.setPadding(new Insets(16, 0, 16, 0));
        rightColumn.setPrefWidth(430);

        HBox content = new HBox(12, leftColumn, rightColumn);
        content.getStyleClass().add("content-row");
        content.setPadding(new Insets(0, 16, 16, 0));
        HBox.setHgrow(leftColumn, Priority.ALWAYS);
        HBox.setHgrow(rightColumn, Priority.ALWAYS);
        root.setCenter(content);
        return new ComposeFrameInput.FrameInput(root);
    }
}
