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
        ShellFx.addStyleClass(controlsPanel, "control-panel");
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
        ShellFx.addChild(detailsContainer, inspectorPane);
        ShellFx.addChild(stateContainer, ShellContentLayout.stateScrollable(emptyStateTabPlaceholder));

        rightSplit.setOrientation(Orientation.VERTICAL);
        ShellContentLayout.makeShrinkable(rightSplit);
        ShellFx.setSplitPaneItems(rightSplit, detailsContainer, stateContainer);

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
        ShellFx.clearChildren(mainPanel);
        ShellFx.addChild(mainPanel, ShellContentLayout.shellOwned(Objects.requireNonNull(slotContent.main(), "main")));
        ShellFx.setChildren(detailsContainer, inspectorPane);
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
        ShellFx.clearChildren(controlsPanel);
        if (controls != null) {
            if (controls instanceof Region region) {
                region.setMinWidth(0.0);
                region.setMaxWidth(Double.MAX_VALUE);
            }
            ShellFx.addChild(controlsPanel, controls);
            VBox.setVgrow(controls, Priority.ALWAYS);
        }
        controlsPanel.setVisible(controls != null);
        controlsPanel.setManaged(controls != null);
    }

    private void refreshStatePanel() {
        if (activeTabMode == null) {
            ShellFx.clearChildren(stateContainer);
            ShellFx.addChild(stateContainer, ShellContentLayout.stateScrollable(emptyStateTabPlaceholder));
            return;
        }
        Node editorState = activeSlotContent == null ? null : activeSlotContent.editorState();
        ShellFx.clearChildren(stateContainer);
        if (editorState != null) {
            ShellFx.addChild(stateContainer, ShellContentLayout.stateScrollable(editorState));
            return;
        }
        if (stateTabPane.hasTabs()) {
            ShellFx.addChild(stateContainer, ShellContentLayout.stateScrollable(stateTabPane));
            return;
        }
        ShellFx.addChild(stateContainer, ShellContentLayout.stateScrollable(
                activeTabMode == ShellLeftBarTabMode.EDITOR ? editorStatePlaceholder : emptyStateTabPlaceholder));
    }

    private static Node createPlaceholderPane(String titleText, String bodyText) {
        Label title = new Label(titleText);
        ShellFx.addStyleClasses(title, "section-header", "text-muted");

        Label body = new Label(bodyText);
        ShellFx.addStyleClass(body, "text-muted");
        body.setWrapText(true);

        VBox box = new VBox(8, title, body);
        box.setFillWidth(true);
        box.setPadding(new Insets(12));
        return box;
    }
}
