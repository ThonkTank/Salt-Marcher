package shell.host;

import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Orientation;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import shell.api.ContributionKey;
import shell.api.ShellLeftBarTabMode;

/**
 * Passive shell workspace for controls, main content, inspector, and state surfaces.
 */
final class ShellWorkspacePane extends SplitPane {

    private static final double DEFAULT_MAIN_DIVIDER = 0.62;
    private static final double DEFAULT_RIGHT_DIVIDER = 0.45;

    private final VBox controlsPanel = new VBox();
    private final StackPane mainPanel = new StackPane();
    private final StackPane detailsContainer = new StackPane();
    private final StackPane stateContainer = new StackPane();
    private final InspectorPane inspectorPane = new InspectorPane();
    private final StateTabPane stateTabPane = new StateTabPane();
    private final Node editorStatePlaceholder = createPlaceholderPane("Status", "Kein lokaler Zustand");
    private final Node emptyStateTabPlaceholder = createPlaceholderPane("Status", "Keine State-Tabs registriert");
    private final SplitPane rightSplit = new SplitPane();
    private final Map<ContributionKey, double[]> savedMainDividers = new LinkedHashMap<>();
    private final Map<ContributionKey, double[]> savedRightDividers = new LinkedHashMap<>();

    private @Nullable ShellLeftBarTabMode activeTabMode;
    private @Nullable ShellSlotContent activeSlotContent;

    ShellWorkspacePane() {
        controlsPanel.getStyleClass().add("control-panel");
        controlsPanel.setPrefWidth(240);
        controlsPanel.setMinWidth(200);
        controlsPanel.setMaxWidth(Double.MAX_VALUE);
        controlsPanel.setFillWidth(true);
        ShellContentLayout.clipToBounds(controlsPanel);

        VBox.setVgrow(controlsPanel, Priority.ALWAYS);
        VBox.setVgrow(mainPanel, Priority.ALWAYS);
        VBox leftColumn = new VBox(controlsPanel, mainPanel);
        leftColumn.setFillWidth(true);
        ShellContentLayout.makeShrinkable(leftColumn);
        ShellContentLayout.makeShrinkable(mainPanel);
        ShellContentLayout.clipToBounds(mainPanel);

        ShellContentLayout.makeShrinkable(detailsContainer);
        ShellContentLayout.makeShrinkable(stateContainer);
        ShellContentLayout.clipToBounds(detailsContainer);
        ShellContentLayout.clipToBounds(stateContainer);
        detailsContainer.getChildren().add(inspectorPane);
        stateContainer.getChildren().add(ShellContentLayout.stateScrollable(emptyStateTabPlaceholder));

        rightSplit.setOrientation(Orientation.VERTICAL);
        ShellContentLayout.makeShrinkable(rightSplit);
        rightSplit.getItems().setAll(detailsContainer, stateContainer);

        setOrientation(Orientation.HORIZONTAL);
        getItems().addAll(leftColumn, rightSplit);
    }

    InspectorPane inspectorPane() {
        return inspectorPane;
    }

    void registerStateTab(ContributionKey key, String label, int itemOrder, Node content) {
        stateTabPane.registerTab(key, label, itemOrder, content);
        refreshStatePanel();
    }

    void showTab(ShellSlotContent slotContent, ShellLeftBarTabMode mode) {
        this.activeSlotContent = Objects.requireNonNull(slotContent, "slotContent");
        this.activeTabMode = Objects.requireNonNull(mode, "mode");
        applyControls(slotContent.controls());
        mainPanel.getChildren().clear();
        mainPanel.getChildren().add(ShellContentLayout.shellOwned(Objects.requireNonNull(slotContent.main(), "main")));
        detailsContainer.getChildren().setAll(inspectorPane);
        refreshStatePanel();
    }

    void saveDividerPositions(ContributionKey key) {
        double[] mainDividers = getDividerPositions();
        if (mainDividers.length > 0) {
            savedMainDividers.put(key, mainDividers.clone());
        }
        double[] rightDividers = rightSplit.getDividerPositions();
        if (rightDividers.length > 0) {
            savedRightDividers.put(key, rightDividers.clone());
        }
    }

    void restoreDividerPositionsLater(ContributionKey key, BooleanSupplier shouldApply) {
        Platform.runLater(() -> {
            if (!shouldApply.getAsBoolean()) {
                return;
            }
            double[] mainPositions = savedMainDividers.get(key);
            setDividerPositions(mainPositions != null ? mainPositions[0] : DEFAULT_MAIN_DIVIDER);
            double[] rightPositions = savedRightDividers.get(key);
            rightSplit.setDividerPositions(rightPositions != null ? rightPositions[0] : DEFAULT_RIGHT_DIVIDER);
        });
    }

    private void applyControls(@Nullable Node controls) {
        controlsPanel.getChildren().clear();
        if (controls != null) {
            if (controls instanceof Region region) {
                region.setMinWidth(0.0);
                region.setMaxWidth(Double.MAX_VALUE);
            }
            controlsPanel.getChildren().add(controls);
            VBox.setVgrow(controls, Priority.ALWAYS);
        }
        controlsPanel.setVisible(controls != null);
        controlsPanel.setManaged(controls != null);
    }

    private void refreshStatePanel() {
        if (activeTabMode == null) {
            stateContainer.getChildren().clear();
            stateContainer.getChildren().add(ShellContentLayout.stateScrollable(emptyStateTabPlaceholder));
            return;
        }
        Node editorState = activeSlotContent == null ? null : activeSlotContent.stateContent();
        stateContainer.getChildren().clear();
        if (editorState != null) {
            stateContainer.getChildren().add(ShellContentLayout.stateScrollable(editorState));
            return;
        }
        if (stateTabPane.hasTabs()) {
            stateContainer.getChildren().add(ShellContentLayout.stateScrollable(stateTabPane));
            return;
        }
        stateContainer.getChildren().add(ShellContentLayout.stateScrollable(
                activeTabMode == ShellLeftBarTabMode.EDITOR ? editorStatePlaceholder : emptyStateTabPlaceholder));
    }

    private static Node createPlaceholderPane(String titleText, String bodyText) {
        Label title = new Label(titleText);
        title.getStyleClass().addAll("section-header", "text-muted");

        Label body = new Label(bodyText);
        body.getStyleClass().add("text-muted");
        body.setWrapText(true);

        VBox box = new VBox(8, title, body);
        box.setFillWidth(true);
        box.setPadding(new Insets(12));
        return box;
    }
}
