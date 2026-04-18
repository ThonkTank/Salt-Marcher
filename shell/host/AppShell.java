package shell.host;

import javafx.scene.layout.BorderPane;
import org.jspecify.annotations.Nullable;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ServiceRegistry;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellTabSpec;
import shell.api.ShellTopBarSpec;

/**
 * Main application shell: global top bar, navigable tabs, shared inspector, and shared runtime-state tabs.
 */
public final class AppShell extends BorderPane {

    private final Map<ContributionKey, RegisteredTab> tabs = new LinkedHashMap<>();
    private final Map<ContributionKey, ShellTopBarSpec> topBarItems = new LinkedHashMap<>();
    private final Map<ContributionKey, ShellRuntimeStateSpec> runtimeStateItems = new LinkedHashMap<>();
    private final ShellNavigationSidebar navigationSidebar = new ShellNavigationSidebar();
    private final ShellToolbarStrip toolbar = new ShellToolbarStrip();
    private final ShellWorkspacePane workspace = new ShellWorkspacePane();
    private final ShellRuntimeContext runtimeContext;

    private @Nullable ContributionKey activeTabKey;

    public AppShell() {
        this(ServiceRegistry.empty());
    }

    public AppShell(ServiceRegistry serviceRegistry) {
        this.runtimeContext = new ShellRuntimeContext(workspace.inspectorPane(), serviceRegistry);
        setTop(toolbar);
        setLeft(navigationSidebar);
        setCenter(workspace);
    }

    public ShellRuntimeContext runtimeContext() {
        return runtimeContext;
    }

    public void registerTab(ShellTabSpec registrationSpec, ShellScreen screen) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(screen, "screen");
        assertUniqueKey(registrationSpec.key());
        ShellSlotContent slotContent = ShellSlotValidator.validate(registrationSpec, screen);
        tabs.put(registrationSpec.key(), new RegisteredTab(registrationSpec, screen, slotContent));
        navigationSidebar.registerTab(registrationSpec, screen, this::navigateTo);
    }

    public void registerTopBar(ShellTopBarSpec registrationSpec, ShellScreen screen) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(screen, "screen");
        assertUniqueKey(registrationSpec.key());
        ShellSlotContent slotContent = ShellSlotValidator.validate(registrationSpec, screen);
        topBarItems.put(registrationSpec.key(), registrationSpec);
        toolbar.registerItem(registrationSpec, Objects.requireNonNull(slotContent.topBar(), "top bar content"));
        refreshToolbar();
    }

    public void registerRuntimeState(ShellRuntimeStateSpec registrationSpec, ShellScreen screen) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(screen, "screen");
        assertUniqueKey(registrationSpec.key());
        ShellSlotContent slotContent = ShellSlotValidator.validate(registrationSpec, screen);
        runtimeStateItems.put(registrationSpec.key(), registrationSpec);
        workspace.registerRuntimeStateTab(
                registrationSpec.key(),
                registrationSpec.tabLabel(),
                registrationSpec.itemOrder(),
                Objects.requireNonNull(slotContent.runtimeState(), "runtime state content"));
    }

    public void navigateTo(ContributionKey key) {
        RegisteredTab target = tabs.get(key);
        if (target == null || key.equals(activeTabKey)) {
            return;
        }
        hideActiveTab();
        activeTabKey = key;
        showTargetTab(target);
        target.screen().onShow();
    }

    private void hideActiveTab() {
        if (activeTabKey == null) {
            return;
        }
        workspace.saveDividerPositions(activeTabKey);
        RegisteredTab current = tabs.get(activeTabKey);
        if (current != null) {
            current.screen().onHide();
        }
    }

    private void showTargetTab(RegisteredTab target) {
        workspace.showTab(target.slotContent(), target.registrationSpec().mode());
        navigationSidebar.select(target.registrationSpec().key());
        refreshToolbar();
        restoreWorkspaceDividers(Objects.requireNonNull(activeTabKey, "activeTabKey"));
    }

    private void refreshToolbar() {
        RegisteredTab activeTab = activeTabKey == null ? null : tabs.get(activeTabKey);
        toolbar.showTitle(activeTab != null ? activeTab.screen().getTitle() : "");
    }

    private void restoreWorkspaceDividers(ContributionKey key) {
        ContributionKey targetKey = key;
        workspace.restoreDividerPositionsLater(targetKey, () -> targetKey.equals(activeTabKey));
    }

    private void assertUniqueKey(ContributionKey key) {
        if (tabs.containsKey(key) || topBarItems.containsKey(key) || runtimeStateItems.containsKey(key)) {
            throw new IllegalArgumentException("Duplicate contribution key: " + key.value());
        }
    }

    private record RegisteredTab(
            ShellTabSpec registrationSpec,
            ShellScreen screen,
            ShellSlotContent slotContent
    ) {
    }
}
