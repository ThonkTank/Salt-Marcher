package shell.host;

import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Orientation;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.ContentDisplay;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import shell.panel.InspectorPane;
import shell.panel.RuntimeStatePane;
import shell.panel.ShellSlot;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Main application shell: global top bar, navigable tabs, shared inspector, and shared runtime-state tabs.
 */
public final class AppShell extends BorderPane {

    private final Map<ContributionKey, RegisteredTab> tabs = new LinkedHashMap<>();
    private final Map<ContributionKey, RegisteredTopBar> topBarItems = new LinkedHashMap<>();
    private final Map<ContributionKey, RegisteredRuntimeState> runtimeStateItems = new LinkedHashMap<>();
    private final ToggleGroup navGroup = new ToggleGroup();

    private final VBox controlsPanel = new VBox();
    private final StackPane mainPanel = new StackPane();
    private final StackPane detailsContainer = new StackPane();
    private final StackPane stateContainer = new StackPane();

    private final InspectorPane inspectorPane = new InspectorPane();
    private final RuntimeStatePane runtimeStatePane = new RuntimeStatePane();
    private final ShellRuntimeContext runtimeContext;
    private final Node editorStatePlaceholder = createPlaceholderPane("Status", "Kein lokaler Zustand");
    private final Node emptyRuntimeStatePlaceholder = createPlaceholderPane("Runtime State", "Keine Runtime-State-Tabs registriert");

    private final HBox toolbar = new HBox(8);
    private final VBox sidebar = new VBox(4);
    private final VBox leftColumn = new VBox();
    private final SplitPane mainSplit = new SplitPane();
    private final SplitPane rightSplit = new SplitPane();

    private final Map<ContributionKey, double[]> savedMainDividers = new LinkedHashMap<>();
    private final Map<ContributionKey, double[]> savedRightDividers = new LinkedHashMap<>();

    private ContributionKey activeTabKey;

    public AppShell() {
        this(PersistenceRegistry.empty());
    }

    public AppShell(PersistenceRegistry persistenceRegistry) {
        this.runtimeContext = new ShellRuntimeContext(inspectorPane, persistenceRegistry);
        sidebar.getStyleClass().add("nav-sidebar");
        sidebar.setAlignment(Pos.TOP_CENTER);

        controlsPanel.getStyleClass().add("control-panel");
        controlsPanel.setPrefWidth(240);
        controlsPanel.setMinWidth(200);
        controlsPanel.setMaxHeight(Double.MAX_VALUE);

        toolbar.getStyleClass().add("toolbar");
        toolbar.setAlignment(Pos.CENTER_LEFT);
        setTop(toolbar);

        VBox.setVgrow(controlsPanel, Priority.NEVER);
        VBox.setVgrow(mainPanel, Priority.ALWAYS);
        leftColumn.getChildren().addAll(controlsPanel, mainPanel);

        detailsContainer.getChildren().add(inspectorPane);
        stateContainer.getChildren().add(emptyRuntimeStatePlaceholder);
        rightSplit.setOrientation(Orientation.VERTICAL);
        rightSplit.getItems().addAll(detailsContainer, stateContainer);

        mainSplit.setOrientation(Orientation.HORIZONTAL);
        mainSplit.getItems().addAll(leftColumn, rightSplit);

        setLeft(sidebar);
        setCenter(mainSplit);
    }

    public ShellRuntimeContext runtimeContext() {
        return runtimeContext;
    }

    public void registerTab(ShellTabSpec registrationSpec, ShellScreen screen) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(screen, "screen");
        assertUniqueKey(registrationSpec.key());
        validateSlots(registrationSpec, screen);

        ToggleButton button = new ToggleButton(screen.getNavigationLabel());
        button.getStyleClass().add("nav-btn");
        button.setToggleGroup(navGroup);
        button.setTooltip(new Tooltip(screen.getTitle()));
        button.setAccessibleText(screen.getTitle());
        Node graphic = screen.getNavigationGraphic();
        if (graphic != null) {
            button.setGraphic(graphic);
            button.setContentDisplay(ContentDisplay.GRAPHIC_ONLY);
            button.setGraphicTextGap(0);
        }
        button.setOnAction(event -> navigateTo(registrationSpec.key()));

        tabs.put(registrationSpec.key(), new RegisteredTab(registrationSpec, screen, button));
        rebuildSidebar();
    }

    public void registerTopBar(ShellTopBarSpec registrationSpec, ShellScreen screen) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(screen, "screen");
        assertUniqueKey(registrationSpec.key());
        Map<ShellSlot, Node> slotContent = validateSlots(registrationSpec, screen);
        topBarItems.put(registrationSpec.key(),
                new RegisteredTopBar(registrationSpec, screen, slotContent.get(ShellSlot.TOP_BAR)));
        rebuildToolbar();
    }

    public void registerRuntimeState(ShellRuntimeStateSpec registrationSpec, ShellScreen screen) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(screen, "screen");
        assertUniqueKey(registrationSpec.key());
        Map<ShellSlot, Node> slotContent = validateSlots(registrationSpec, screen);
        runtimeStateItems.put(registrationSpec.key(),
                new RegisteredRuntimeState(registrationSpec, screen, slotContent.get(ShellSlot.COCKPIT_STATE)));
        runtimeStatePane.registerTab(
                registrationSpec.key(),
                registrationSpec.tabLabel(),
                registrationSpec.itemOrder(),
                slotContent.get(ShellSlot.COCKPIT_STATE));
        refreshStatePanel();
    }

    public void navigateTo(ContributionKey key) {
        RegisteredTab target = tabs.get(key);
        if (target == null || key.equals(activeTabKey)) {
            return;
        }

        if (activeTabKey != null) {
            if (mainSplit.getDividerPositions().length > 0) {
                savedMainDividers.put(activeTabKey, mainSplit.getDividerPositions().clone());
            }
            if (rightSplit.getDividerPositions().length > 0) {
                savedRightDividers.put(activeTabKey, rightSplit.getDividerPositions().clone());
            }
            RegisteredTab current = tabs.get(activeTabKey);
            if (current != null) {
                current.screen().onHide();
            }
        }

        activeTabKey = key;
        applyTabContent(target);
        target.button().setSelected(true);
        rebuildToolbar();

        ContributionKey targetKey = activeTabKey;
        Platform.runLater(() -> {
            if (targetKey != activeTabKey) {
                return;
            }
            double[] mainPositions = savedMainDividers.get(targetKey);
            mainSplit.setDividerPositions(mainPositions != null ? mainPositions[0] : 0.62);
            double[] rightPositions = savedRightDividers.get(targetKey);
            rightSplit.setDividerPositions(rightPositions != null ? rightPositions[0] : 0.45);
        });

        target.screen().onShow();
    }

    private void applyTabContent(RegisteredTab target) {
        Map<ShellSlot, Node> slotContent = slotContentOf(target.screen());

        Node controls = slotContent.get(ShellSlot.COCKPIT_CONTROLS);
        controlsPanel.getChildren().clear();
        if (controls != null) {
            controlsPanel.getChildren().add(controls);
            VBox.setVgrow(controls, Priority.ALWAYS);
        }
        controlsPanel.setVisible(controls != null);
        controlsPanel.setManaged(controls != null);

        mainPanel.getChildren().setAll(slotContent.get(ShellSlot.COCKPIT_MAIN));
        detailsContainer.getChildren().setAll(inspectorPane);
        refreshStatePanel();
    }

    private void refreshStatePanel() {
        if (activeTabKey == null) {
            stateContainer.getChildren().setAll(emptyRuntimeStatePlaceholder);
            return;
        }
        RegisteredTab activeTab = tabs.get(activeTabKey);
        if (activeTab == null) {
            stateContainer.getChildren().setAll(emptyRuntimeStatePlaceholder);
            return;
        }
        if (activeTab.registrationSpec().mode() == ShellTabMode.RUNTIME) {
            stateContainer.getChildren().setAll(runtimeStatePane.hasTabs() ? runtimeStatePane : emptyRuntimeStatePlaceholder);
            return;
        }
        Node editorState = slotContentOf(activeTab.screen()).get(ShellSlot.COCKPIT_STATE);
        stateContainer.getChildren().setAll(editorState != null ? editorState : editorStatePlaceholder);
    }

    private void rebuildSidebar() {
        sidebar.getChildren().clear();

        String previousGroupKey = null;
        for (RegisteredTab registeredTab : getSortedTabs()) {
            NavigationGroupSpec group = registeredTab.registrationSpec().navigationGroup();
            String currentGroupKey = group.key();
            if (previousGroupKey != null && !previousGroupKey.equals(currentGroupKey)) {
                Region separator = new Region();
                separator.getStyleClass().add("nav-separator");
                separator.setMinHeight(1);
                separator.setPrefHeight(1);
                sidebar.getChildren().add(separator);
            }
            sidebar.getChildren().add(registeredTab.button());
            previousGroupKey = currentGroupKey;
        }
    }

    private void rebuildToolbar() {
        toolbar.getChildren().clear();

        RegisteredTab activeTab = activeTabKey == null ? null : tabs.get(activeTabKey);
        Label title = new Label(activeTab != null ? activeTab.screen().getTitle() : "");
        title.getStyleClass().add("large");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        toolbar.getChildren().addAll(title, spacer);

        for (RegisteredTopBar item : getSortedTopBarItems()) {
            toolbar.getChildren().add(item.content());
        }
    }

    private List<RegisteredTab> getSortedTabs() {
        List<RegisteredTab> sorted = new ArrayList<>(tabs.values());
        sorted.sort(Comparator
                .comparingInt((RegisteredTab tab) -> tab.registrationSpec().navigationGroup().order())
                .thenComparing(tab -> tab.registrationSpec().navigationGroup().label(), String.CASE_INSENSITIVE_ORDER)
                .thenComparingInt(tab -> tab.registrationSpec().viewOrder())
                .thenComparing(tab -> tab.screen().getTitle(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(tab -> tab.registrationSpec().key().value()));
        return sorted;
    }

    private List<RegisteredTopBar> getSortedTopBarItems() {
        List<RegisteredTopBar> sorted = new ArrayList<>(topBarItems.values());
        sorted.sort(Comparator
                .comparingInt((RegisteredTopBar item) -> item.registrationSpec().itemOrder())
                .thenComparing(item -> item.registrationSpec().key().value()));
        return sorted;
    }

    private void assertUniqueKey(ContributionKey key) {
        if (tabs.containsKey(key) || topBarItems.containsKey(key) || runtimeStateItems.containsKey(key)) {
            throw new IllegalArgumentException("Duplicate contribution key: " + key.value());
        }
    }

    private Map<ShellSlot, Node> validateSlots(ShellContributionSpec registrationSpec, ShellScreen screen) {
        Map<ShellSlot, Node> slotContent = slotContentOf(screen);
        if (registrationSpec instanceof ShellTabSpec tabSpec) {
            requireSlot(slotContent, registrationSpec.key(), ShellSlot.COCKPIT_MAIN);
            forbidSlots(slotContent, registrationSpec.key(), ShellSlot.TOP_BAR, ShellSlot.COCKPIT_DETAILS);
            if (tabSpec.mode() == ShellTabMode.RUNTIME) {
                forbidSlots(slotContent, registrationSpec.key(), ShellSlot.COCKPIT_STATE);
            }
            return slotContent;
        }
        if (registrationSpec instanceof ShellTopBarSpec) {
            requireSlot(slotContent, registrationSpec.key(), ShellSlot.TOP_BAR);
            forbidSlots(slotContent, registrationSpec.key(),
                    ShellSlot.COCKPIT_CONTROLS, ShellSlot.COCKPIT_MAIN, ShellSlot.COCKPIT_DETAILS, ShellSlot.COCKPIT_STATE);
            return slotContent;
        }
        if (registrationSpec instanceof ShellRuntimeStateSpec) {
            requireSlot(slotContent, registrationSpec.key(), ShellSlot.COCKPIT_STATE);
            forbidSlots(slotContent, registrationSpec.key(),
                    ShellSlot.TOP_BAR, ShellSlot.COCKPIT_CONTROLS, ShellSlot.COCKPIT_MAIN, ShellSlot.COCKPIT_DETAILS);
            return slotContent;
        }
        throw new IllegalStateException("Unsupported shell contribution type: " + registrationSpec.getClass().getName());
    }

    private static void requireSlot(Map<ShellSlot, Node> slotContent, ContributionKey key, ShellSlot requiredSlot) {
        if (!slotContent.containsKey(requiredSlot)) {
            throw new IllegalArgumentException("Contribution '" + key.value()
                    + "' must provide content for ShellSlot." + requiredSlot.name() + ".");
        }
    }

    private static void forbidSlots(Map<ShellSlot, Node> slotContent, ContributionKey key, ShellSlot... forbiddenSlots) {
        for (ShellSlot forbiddenSlot : forbiddenSlots) {
            if (slotContent.containsKey(forbiddenSlot)) {
                throw new IllegalArgumentException("Contribution '" + key.value()
                        + "' must not provide content for ShellSlot." + forbiddenSlot.name() + ".");
            }
        }
    }

    private static Map<ShellSlot, Node> slotContentOf(ShellScreen screen) {
        Map<ShellSlot, Node> provided = screen.slotContent();
        if (provided == null || provided.isEmpty()) {
            return Map.of();
        }
        EnumMap<ShellSlot, Node> sanitized = new EnumMap<>(ShellSlot.class);
        for (Map.Entry<ShellSlot, Node> entry : provided.entrySet()) {
            if (entry.getKey() == null) {
                throw new IllegalArgumentException("Shell screen must not declare a null slot key.");
            }
            if (entry.getValue() != null) {
                sanitized.put(entry.getKey(), entry.getValue());
            }
        }
        return Map.copyOf(sanitized);
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

    private record RegisteredTab(
            ShellTabSpec registrationSpec,
            ShellScreen screen,
            ToggleButton button
    ) {
    }

    private record RegisteredTopBar(
            ShellTopBarSpec registrationSpec,
            ShellScreen screen,
            Node content
    ) {
    }

    private record RegisteredRuntimeState(
            ShellRuntimeStateSpec registrationSpec,
            ShellScreen screen,
            Node content
    ) {
    }
}
