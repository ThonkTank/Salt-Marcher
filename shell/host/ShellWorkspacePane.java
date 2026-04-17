package shell.host;

import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Orientation;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.BooleanSupplier;

/**
 * Passive shell workspace for controls, main content, inspector, and state surfaces.
 */
public final class ShellWorkspacePane extends SplitPane {

    private static final double DEFAULT_MAIN_DIVIDER = 0.62;
    private static final double DEFAULT_RIGHT_DIVIDER = 0.45;

    private final VBox controlsPanel = new VBox();
    private final StackPane mainPanel = new StackPane();
    private final StackPane detailsContainer = new StackPane();
    private final StackPane stateContainer = new StackPane();
    private final InspectorPane inspectorPane = new InspectorPane();
    private final RuntimeStatePane runtimeStatePane = new RuntimeStatePane();
    private final Node editorStatePlaceholder = createPlaceholderPane("Status", "Kein lokaler Zustand");
    private final Node emptyRuntimeStatePlaceholder = createPlaceholderPane("Runtime State", "Keine Runtime-State-Tabs registriert");
    private final SplitPane rightSplit = new SplitPane();
    private final Map<ContributionKey, double[]> savedMainDividers = new LinkedHashMap<>();
    private final Map<ContributionKey, double[]> savedRightDividers = new LinkedHashMap<>();

    private @Nullable ShellTabMode activeTabMode;
    private @Nullable ShellSlotContent activeSlotContent;

    public ShellWorkspacePane() {
        controlsPanel.getStyleClass().add("control-panel");
        controlsPanel.setPrefWidth(240);
        controlsPanel.setMinWidth(200);
        controlsPanel.setMaxHeight(Double.MAX_VALUE);

        VBox.setVgrow(controlsPanel, Priority.NEVER);
        VBox.setVgrow(mainPanel, Priority.ALWAYS);
        VBox leftColumn = new VBox(controlsPanel, mainPanel);

        detailsContainer.getChildren().add(inspectorPane);
        stateContainer.getChildren().add(emptyRuntimeStatePlaceholder);

        rightSplit.setOrientation(Orientation.VERTICAL);
        rightSplit.getItems().addAll(detailsContainer, stateContainer);

        setOrientation(Orientation.HORIZONTAL);
        getItems().addAll(leftColumn, rightSplit);
    }

    public InspectorPane inspectorPane() {
        return inspectorPane;
    }

    public void registerRuntimeStateTab(ContributionKey key, String label, int itemOrder, Node content) {
        runtimeStatePane.registerTab(key, label, itemOrder, content);
        refreshStatePanel();
    }

    public void showTab(ShellSlotContent slotContent, ShellTabMode mode) {
        this.activeSlotContent = Objects.requireNonNull(slotContent, "slotContent");
        this.activeTabMode = Objects.requireNonNull(mode, "mode");
        applyControls(slotContent.controls());
        mainPanel.getChildren().setAll(slotContent.main());
        detailsContainer.getChildren().setAll(inspectorPane);
        refreshStatePanel();
    }

    public void saveDividerPositions(ContributionKey key) {
        double[] mainDividers = getDividerPositions();
        if (mainDividers.length > 0) {
            savedMainDividers.put(key, mainDividers.clone());
        }
        double[] rightDividers = rightSplit.getDividerPositions();
        if (rightDividers.length > 0) {
            savedRightDividers.put(key, rightDividers.clone());
        }
    }

    public void restoreDividerPositionsLater(ContributionKey key, BooleanSupplier shouldApply) {
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
            controlsPanel.getChildren().add(controls);
            VBox.setVgrow(controls, Priority.ALWAYS);
        }
        controlsPanel.setVisible(controls != null);
        controlsPanel.setManaged(controls != null);
    }

    private void refreshStatePanel() {
        if (activeTabMode == null) {
            stateContainer.getChildren().setAll(emptyRuntimeStatePlaceholder);
            return;
        }
        if (activeTabMode == ShellTabMode.RUNTIME) {
            stateContainer.getChildren().setAll(runtimeStatePane.hasTabs() ? runtimeStatePane : emptyRuntimeStatePlaceholder);
            return;
        }
        Node editorState = activeSlotContent == null ? null : activeSlotContent.editorState();
        stateContainer.getChildren().setAll(editorState != null ? editorState : editorStatePlaceholder);
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
