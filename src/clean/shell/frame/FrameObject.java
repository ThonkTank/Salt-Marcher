package clean.shell.frame;

import clean.shell.frame.input.ComposeFrameInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.layout.Border;
import javafx.scene.layout.BorderStroke;
import javafx.scene.layout.BorderStrokeStyle;
import javafx.scene.layout.BorderWidths;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;

/**
 * Clean shell frame owner for the cockpit layout structure.
 */
public final class FrameObject {

    private final ComposeFrameInput.FrameInput frame;

    public FrameObject(ComposeFrameInput input) {
        ComposeFrameInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.frame = new FrameAssembly(resolvedInput).composeFrame();
    }

    public ComposeFrameInput.FrameInput composeFrame(ComposeFrameInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return frame;
    }

    private static final class FrameAssembly {

        private final ComposeFrameInput input;

        private FrameAssembly(ComposeFrameInput input) {
            this.input = input;
        }

        private ComposeFrameInput.FrameInput composeFrame() {
            BorderPane root = new BorderPane();
            root.getStyleClass().add("clean-root");

            HBox toolbarShell = new HBox(8);
            toolbarShell.getStyleClass().add("shell-chrome");
            toolbarShell.setAlignment(javafx.geometry.Pos.CENTER_LEFT);
            toolbarShell.setPadding(new Insets(6, 12, 6, 12));
            toolbarShell.setBorder(createBorder(0, 0, 1, 0));
            if (input.toolbarContent() != null) {
                HBox.setHgrow(input.toolbarContent(), Priority.ALWAYS);
                toolbarShell.getChildren().add(input.toolbarContent());
            }
            root.setTop(toolbarShell);

            VBox navigationShell = new VBox();
            navigationShell.getStyleClass().add("shell-chrome");
            navigationShell.setAlignment(javafx.geometry.Pos.TOP_CENTER);
            navigationShell.setPadding(new Insets(8, 4, 8, 4));
            navigationShell.setPrefWidth(48);
            navigationShell.setMinWidth(48);
            navigationShell.setMaxWidth(48);
            navigationShell.setBorder(createBorder(0, 1, 0, 0));
            if (input.navigationContent() != null) {
                VBox.setVgrow(input.navigationContent(), Priority.ALWAYS);
                navigationShell.getChildren().add(input.navigationContent());
            }
            root.setLeft(navigationShell);

            VBox controlsPanel = new VBox();
            controlsPanel.getStyleClass().add("shell-chrome");
            controlsPanel.setPrefWidth(240);
            controlsPanel.setMinWidth(200);
            controlsPanel.setMaxHeight(Double.MAX_VALUE);
            Node controlsNode = input.controlsContent() == null
                    ? createPlaceholderPane("Controls", "Keine lokalen Controls")
                    : input.controlsContent();
            controlsPanel.getChildren().setAll(controlsNode);
            VBox.setVgrow(controlsNode, Priority.ALWAYS);

            Node mainNode = input.mainContent() == null
                    ? createPlaceholderPane("Main", "Kein lokaler Inhalt")
                    : input.mainContent();
            StackPane mainPanel = new StackPane(mainNode);

            Node detailsNode = input.detailsContent() == null
                    ? createPlaceholderPane("Details", "Keine globalen Details aktiv")
                    : input.detailsContent();
            StackPane detailsContainer = new StackPane(detailsNode);

            Node stateNode = input.stateContent() == null
                    ? createPlaceholderPane("Status", "Keine globale Szene aktiv")
                    : input.stateContent();
            StackPane stateContainer = new StackPane(stateNode);

            VBox leftColumn = new VBox();
            VBox.setVgrow(controlsPanel, Priority.NEVER);
            VBox.setVgrow(mainPanel, Priority.ALWAYS);
            leftColumn.getChildren().addAll(controlsPanel, mainPanel);

            SplitPane rightSplit = new SplitPane();
            rightSplit.setOrientation(javafx.geometry.Orientation.VERTICAL);
            rightSplit.getItems().addAll(detailsContainer, stateContainer);
            rightSplit.setDividerPositions(0.45);

            SplitPane mainSplit = new SplitPane();
            mainSplit.setOrientation(javafx.geometry.Orientation.HORIZONTAL);
            mainSplit.getItems().addAll(leftColumn, rightSplit);
            mainSplit.setDividerPositions(0.62);

            root.setCenter(mainSplit);

            return new ComposeFrameInput.FrameInput(root);
        }

        private static VBox createPlaceholderPane(String titleText, String bodyText) {
            Label title = new Label(titleText);
            title.getStyleClass().add("subheading");
            Label body = new Label(bodyText);
            body.getStyleClass().add("text-muted");
            body.setWrapText(true);
            VBox box = new VBox(8, title, body);
            box.setFillWidth(true);
            box.setPadding(new Insets(12));
            return box;
        }

        private static Border createBorder(double top, double right, double bottom, double left) {
            return new Border(new BorderStroke(
                    Color.web("#333a3f"),
                    BorderStrokeStyle.SOLID,
                    null,
                    new BorderWidths(top, right, bottom, left)
            ));
        }
    }
}
