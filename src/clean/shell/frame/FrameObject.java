package clean.shell.frame;

import clean.shell.frame.input.ComposeFrameInput;
import javafx.geometry.Insets;
import javafx.geometry.Orientation;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Clean shell frame owner for the cockpit layout structure.
 */
@SuppressWarnings("unused")
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

            HBox toolbarShell = new HBox(12);
            toolbarShell.getStyleClass().add("toolbar-shell");
            if (input.toolbarContent() != null) {
                HBox.setHgrow(input.toolbarContent(), Priority.ALWAYS);
                toolbarShell.getChildren().add(input.toolbarContent());
            }
            root.setTop(toolbarShell);

            VBox navigationShell = new VBox();
            navigationShell.getStyleClass().add("navigation-shell");
            if (input.navigationContent() != null) {
                VBox.setVgrow(input.navigationContent(), Priority.ALWAYS);
                navigationShell.getChildren().add(input.navigationContent());
            }
            root.setLeft(navigationShell);

            VBox leftColumn = new VBox(16);
            leftColumn.getStyleClass().add("column-stack");

            VBox controlsPanel = createPanel("Controls", input.controlsContent(), "Keine lokalen Controls");
            VBox mainPanel = createPanel("Main", input.mainContent(), "Kein lokaler Inhalt");
            VBox.setVgrow(mainPanel, Priority.ALWAYS);
            leftColumn.getChildren().setAll(controlsPanel, mainPanel);

            VBox detailsPanel = createPanel("Details", input.detailsContent(), "Keine globalen Details aktiv");
            VBox statePanel = createPanel("State", input.stateContent(), "Keine globale Szene aktiv");
            SplitPane rightSplit = new SplitPane(detailsPanel, statePanel);
            rightSplit.setOrientation(Orientation.VERTICAL);
            rightSplit.setDividerPositions(0.52);

            SplitPane contentSplit = new SplitPane(leftColumn, rightSplit);
            contentSplit.setOrientation(Orientation.HORIZONTAL);
            contentSplit.setDividerPositions(0.62);
            root.setCenter(contentSplit);

            return new ComposeFrameInput.FrameInput(root);
        }

        private static VBox createPanel(String titleText, Node content, String fallbackText) {
            Label title = new Label(titleText);
            title.getStyleClass().add("panel-title");

            Node resolvedContent = content == null ? createFallbackContent(fallbackText) : content;
            StackPane contentHost = new StackPane(resolvedContent);
            contentHost.getStyleClass().add("panel-content");
            VBox.setVgrow(contentHost, Priority.ALWAYS);

            VBox panel = new VBox(10, title, contentHost);
            panel.getStyleClass().add("panel-shell");
            return panel;
        }

        private static VBox createFallbackContent(String fallbackText) {
            Label label = new Label(fallbackText);
            label.getStyleClass().add("hero-footer");
            label.setWrapText(true);
            VBox fallback = new VBox(label);
            fallback.getStyleClass().add("empty-panel");
            fallback.setPadding(new Insets(12));
            return fallback;
        }
    }
}
