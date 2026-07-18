package features.catalog.adapter.javafx;

import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import org.jspecify.annotations.Nullable;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellSlot;

/** Passive target Catalog host for all seven native sections. */
public final class CatalogContribution implements ShellContribution, AutoCloseable {

    private final CatalogWorkspaceController controller;
    private final AtomicBoolean closed = new AtomicBoolean();
    private @Nullable Runnable unsubscribe;
    private CatalogWorkspaceView workspace;
    private MonsterCatalogSection monsters;
    private ItemsCatalogSection items;
    private SavedEncounterCatalogSection savedEncounters;
    private NpcCatalogSection npcs;
    private FactionCatalogSection factions;
    private LocationCatalogSection locations;
    private EncounterTableCatalogSection encounterTables;
    private long renderedWorkspaceRevision = -1L;

    public CatalogContribution(CatalogWorkspaceController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
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
        npcs = new NpcCatalogSection(controller::acceptWorldReferenceIntent);
        factions = new FactionCatalogSection(controller::acceptWorldReferenceIntent);
        locations = new LocationCatalogSection(controller::acceptWorldReferenceIntent);
        encounterTables = new EncounterTableCatalogSection(controller::acceptEncounterTableIntent);
        workspace = new CatalogWorkspaceView(
                controller,
                List.of(monsters, items, savedEncounters, npcs, factions, locations, encounterTables));
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
        npcs.render(state.worldReferences());
        factions.render(state.worldReferences());
        locations.render(state.worldReferences());
        encounterTables.render(state.encounterTables());
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }
        Runnable currentSubscription = unsubscribe;
        unsubscribe = null;
        if (currentSubscription != null) {
            currentSubscription.run();
        }
    }

    private static MonsterCatalogAuxiliaryOptions monsterAuxiliary(CatalogWorkspaceState state) {
        return new MonsterCatalogAuxiliaryOptions(
                state.encounterTables().options(),
                state.worldReferences().factionOptions(),
                state.worldReferences().locationOptions());
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
        }

        @Override public void onDeactivate() {
            controller.deactivate();
        }
    }
}
