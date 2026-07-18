package features.catalog.adapter.javafx;

import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellSlot;

/** Target Catalog host: Monster, Items, and saved Encounters are native. */
public final class CatalogContribution implements ShellContribution, AutoCloseable {

    private final CatalogWorkspaceController controller;
    private final List<CatalogSection> legacySections;
    private final AtomicBoolean closed = new AtomicBoolean();
    private Runnable unsubscribe = () -> { };
    private CatalogWorkspaceView workspace;
    private MonsterCatalogSection monsters;
    private ItemsCatalogSection items;
    private SavedEncounterCatalogSection savedEncounters;
    private long renderedWorkspaceRevision = -1L;

    public CatalogContribution(
            CatalogWorkspaceController controller,
            List<CatalogSection> legacySections
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.legacySections = List.copyOf(Objects.requireNonNull(legacySections, "legacySections"));
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("catalog"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/catalog/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        if (closed.get()) {
            throw new IllegalStateException("Catalog contribution is closed.");
        }
        if (workspace != null) {
            throw new IllegalStateException("Catalog contribution may only be bound once.");
        }
        monsters = new MonsterCatalogSection(controller::acceptMonsterIntent);
        items = new ItemsCatalogSection(controller::acceptItemsIntent);
        savedEncounters = new SavedEncounterCatalogSection(controller::acceptSavedEncounterIntent);
        List<CatalogSection> sections = new ArrayList<>();
        sections.add(monsters);
        sections.add(items);
        sections.add(savedEncounters);
        sections.addAll(legacySections);
        workspace = new CatalogWorkspaceView(controller, sections);
        unsubscribe = controller.publication().subscribe(this::apply);
        apply(controller.publication().current());
        return new CatalogShellBinding(workspace);
    }

    private void apply(CatalogWorkspaceState state) {
        if (workspace == null || closed.get() || state.revision() <= renderedWorkspaceRevision) {
            return;
        }
        renderedWorkspaceRevision = state.revision();
        workspace.apply(state);
        if (state.revision() != renderedWorkspaceRevision) {
            return;
        }
        monsters.render(state.monsters());
        monsters.renderAuxiliary(monsterAuxiliary(state));
        items.render(state.items());
        savedEncounters.render(state.savedEncounters());
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }
        unsubscribe.run();
        unsubscribe = () -> { };
        if (workspace != null) {
            workspace.deactivate();
        }
    }

    private static MonsterCatalogAuxiliaryOptions monsterAuxiliary(CatalogWorkspaceState state) {
        return new MonsterCatalogAuxiliaryOptions(
                state.encounterTables().results().rows(),
                state.worldReferences().factions().results().rows(),
                state.worldReferences().locations().results().rows());
    }

    private final class CatalogShellBinding implements ShellBinding {
        private final Map<ShellSlot, javafx.scene.Node> slots;

        private CatalogShellBinding(CatalogWorkspaceView view) {
            slots = Map.of(ShellSlot.COCKPIT_CONTROLS, view.controls(), ShellSlot.COCKPIT_MAIN, view.content());
        }

        @Override public String title() {
            return "Katalog";
        }

        @Override public Map<ShellSlot, javafx.scene.Node> slotContent() {
            return slots;
        }

        @Override public void onActivate() {
            controller.activate();
            workspace.activate();
        }

        @Override public void onDeactivate() {
            workspace.deactivate();
            controller.deactivate();
        }
    }
}
