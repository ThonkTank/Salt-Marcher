package features.catalog.adapter.javafx;

import features.catalog.application.CatalogActionId;
import features.catalog.application.CatalogSectionDefinitions;
import features.catalog.application.CatalogSectionId;
import features.catalog.application.CatalogWorkspaceBinding;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import features.catalog.application.EncounterTableCatalogIntent;
import features.catalog.application.ItemsCatalogIntent;
import features.catalog.application.ItemsCatalogQuery;
import features.catalog.application.MonsterCatalogIntent;
import features.catalog.application.MonsterCatalogQuery;
import features.catalog.application.NoCatalogQuery;
import features.catalog.application.SavedEncounterCatalogIntent;
import features.catalog.application.TextCatalogQuery;
import features.catalog.application.WorldReferenceCatalogIntent;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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

/** Passive Catalog host with one generic renderer for all seven typed definitions. */
public final class CatalogContribution implements ShellContribution, AutoCloseable {

    private final CatalogWorkspaceController controller;
    private final CatalogWorkspaceBinding binding;
    private final CatalogSectionDefinitions definitions;
    private final AtomicBoolean closed = new AtomicBoolean();
    private CatalogWorkspaceView workspace;
    private long renderedWorkspaceRevision = -1L;

    public CatalogContribution(
            CatalogWorkspaceController controller,
            CatalogWorkspaceBinding binding,
            CatalogSectionDefinitions definitions
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.binding = Objects.requireNonNull(binding, "binding");
        this.definitions = Objects.requireNonNull(definitions, "definitions");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("catalog"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10, false,
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
        workspace = new CatalogWorkspaceView(controller);
        binding.attach(this::apply);
        return new CatalogShellBinding(workspace);
    }

    private void apply(CatalogWorkspaceState state) {
        if (workspace == null || closed.get() || state.revision() <= renderedWorkspaceRevision) {
            return;
        }
        renderedWorkspaceRevision = state.revision();
        workspace.apply(state);
        switch (state.activeSection()) {
            case MONSTERS -> renderMonsters(state);
            case ITEMS -> renderItems(state);
            case SAVED_ENCOUNTERS -> renderSavedEncounters(state);
            case NPCS -> renderNpcs(state);
            case FACTIONS -> renderFactions(state);
            case LOCATIONS -> renderLocations(state);
            case ENCOUNTER_TABLES -> renderEncounterTables(state);
        }
    }

    private void renderMonsters(CatalogWorkspaceState workspaceState) {
        var state = workspaceState.monsters();
        MonsterCatalogQuery query = new MonsterCatalogQuery(
                state.filterDraft(), state.filterOptions(), state.sort(), state.encounterTableOptions(),
                state.factionOptions(), state.locationOptions());
        workspace.render(definitions.monsters(),
                new CatalogRenderState<>(workspaceState.revision(), query, state.results(),
                        optional(state.selectedCreatureId()), state.pageSize(), state.pageOffset(),
                        state.totalCount(), "", CatalogRenderState.Confirmation.none()),
                new CatalogSectionCommands<>(
                        next -> {
                            controller.acceptMonsterIntent(new MonsterCatalogIntent.ChangeFilters(next.filters()));
                            controller.acceptMonsterIntent(new MonsterCatalogIntent.ChangeSort(next.sort()));
                        },
                        () -> controller.acceptMonsterIntent(new MonsterCatalogIntent.Submit()),
                        direction -> controller.acceptMonsterIntent(new MonsterCatalogIntent.ShiftPage(direction)),
                        key -> controller.acceptMonsterIntent(new MonsterCatalogIntent.SelectCreature(key.orElse(0L))),
                        this::monsterAction, ignored -> { }, () -> { }, () -> { }));
    }

    private void renderItems(CatalogWorkspaceState workspaceState) {
        var state = workspaceState.items();
        ItemsCatalogQuery query = new ItemsCatalogQuery(state.filterDraft(), state.filterOptions());
        workspace.render(definitions.items(),
                new CatalogRenderState<>(workspaceState.revision(), query, state.results(),
                        state.selectedSourceKey().isBlank() ? Optional.empty() : Optional.of(state.selectedSourceKey()),
                        state.pageSize(), state.pageOffset(), state.totalCount(), state.actionMessage(),
                        CatalogRenderState.Confirmation.none()),
                new CatalogSectionCommands<>(
                        next -> controller.acceptItemsIntent(new ItemsCatalogIntent.ChangeDraft(next.filters())),
                        () -> controller.acceptItemsIntent(new ItemsCatalogIntent.Search()),
                        direction -> controller.acceptItemsIntent(new ItemsCatalogIntent.ShiftPage(direction)),
                        key -> controller.acceptItemsIntent(new ItemsCatalogIntent.SelectItem(key.orElse(""))),
                        (action, key) -> {
                            if (action == CatalogActionId.OPEN) {
                                controller.acceptItemsIntent(new ItemsCatalogIntent.OpenItem(key));
                            }
                        }, ignored -> { }, () -> { }, () -> { }));
    }

    private void renderSavedEncounters(CatalogWorkspaceState workspaceState) {
        var state = workspaceState.savedEncounters();
        var pending = state.confirmation();
        workspace.render(definitions.savedEncounters(),
                new CatalogRenderState<>(workspaceState.revision(), NoCatalogQuery.INSTANCE, state.results(),
                        optional(state.selectedPlanId()), 50, 0, state.results().rows().size(),
                        state.actionMessage(),
                        new CatalogRenderState.Confirmation<>(pending.revision(), optional(pending.planId()),
                                pending.planName(), pending.required())),
                new CatalogSectionCommands<>(ignored -> { }, () -> { }, ignored -> { },
                        key -> controller.acceptSavedEncounterIntent(
                                new SavedEncounterCatalogIntent.SelectPlan(key.orElse(0L))),
                        (action, key) -> {
                            if (action == CatalogActionId.OPEN) {
                                controller.acceptSavedEncounterIntent(new SavedEncounterCatalogIntent.OpenPlan(key));
                            }
                        }, ignored -> { },
                        () -> controller.acceptSavedEncounterIntent(new SavedEncounterCatalogIntent.ConfirmOpen(
                                pending.revision(), pending.planId())),
                        () -> controller.acceptSavedEncounterIntent(new SavedEncounterCatalogIntent.CancelOpen(
                                pending.revision(), pending.planId()))));
    }

    private void renderNpcs(CatalogWorkspaceState workspaceState) {
        var state = workspaceState.worldReferences().npcs();
        workspace.render(definitions.npcs(), textState(
                        workspaceState.revision(), state.results(), state.selectedId(), state.query()),
                new CatalogSectionCommands<>(
                        query -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.ChangeNpcQuery(query.text())),
                        () -> controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.SubmitNpcQuery()),
                        ignored -> { }, key -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.SelectNpc(key.orElse(0L))),
                        this::npcAction,
                        action -> {
                            if (action == CatalogActionId.CREATE) {
                                controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.CreateNpc());
                            }
                        }, () -> { }, () -> { }));
    }

    private void renderFactions(CatalogWorkspaceState workspaceState) {
        var state = workspaceState.worldReferences().factions();
        workspace.render(definitions.factions(), textState(
                        workspaceState.revision(), state.results(), state.selectedId(), state.query()),
                new CatalogSectionCommands<>(
                        query -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.ChangeFactionQuery(query.text())),
                        () -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.SubmitFactionQuery()),
                        ignored -> { }, key -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.SelectFaction(key.orElse(0L))),
                        this::factionAction,
                        action -> {
                            if (action == CatalogActionId.CREATE) {
                                controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.CreateFaction());
                            }
                        }, () -> { }, () -> { }));
    }

    private void renderLocations(CatalogWorkspaceState workspaceState) {
        var state = workspaceState.worldReferences().locations();
        workspace.render(definitions.locations(), textState(
                        workspaceState.revision(), state.results(), state.selectedId(), state.query()),
                new CatalogSectionCommands<>(
                        query -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.ChangeLocationQuery(query.text())),
                        () -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.SubmitLocationQuery()),
                        ignored -> { }, key -> controller.acceptWorldReferenceIntent(
                                new WorldReferenceCatalogIntent.SelectLocation(key.orElse(0L))),
                        this::locationAction,
                        action -> {
                            if (action == CatalogActionId.CREATE) {
                                controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.CreateLocation());
                            }
                        }, () -> { }, () -> { }));
    }

    private void renderEncounterTables(CatalogWorkspaceState workspaceState) {
        var state = workspaceState.encounterTables();
        workspace.render(definitions.encounterTables(),
                new CatalogRenderState<>(workspaceState.revision(), new TextCatalogQuery(state.query()), state.results(),
                        optional(state.selectedTableId()), 50, 0, state.results().rows().size(), "",
                        CatalogRenderState.Confirmation.none()),
                new CatalogSectionCommands<>(
                        query -> controller.acceptEncounterTableIntent(
                                new EncounterTableCatalogIntent.ChangeQuery(query.text())),
                        () -> controller.acceptEncounterTableIntent(new EncounterTableCatalogIntent.SubmitQuery()),
                        ignored -> { }, key -> controller.acceptEncounterTableIntent(
                                new EncounterTableCatalogIntent.SelectTable(key.orElse(0L))),
                        (action, key) -> {
                            if (action == CatalogActionId.USE_AS_ENCOUNTER_SOURCE) {
                                controller.acceptEncounterTableIntent(
                                        new EncounterTableCatalogIntent.UseAsEncounterSource(key));
                            }
                        }, ignored -> { }, () -> { }, () -> { }));
    }

    private void monsterAction(CatalogActionId action, long key) {
        switch (action) {
            case OPEN -> controller.acceptMonsterIntent(new MonsterCatalogIntent.OpenCreature(key));
            case ADD_TO_ENCOUNTER ->
                    controller.acceptMonsterIntent(new MonsterCatalogIntent.AddToEncounter(key));
            case ADD_TO_SCENE -> controller.acceptMonsterIntent(new MonsterCatalogIntent.AddToScene(key));
            default -> { }
        }
    }

    private void npcAction(CatalogActionId action, long key) {
        switch (action) {
            case OPEN -> controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.OpenNpc(key));
            case ADD_TO_ENCOUNTER -> controller.acceptWorldReferenceIntent(
                    new WorldReferenceCatalogIntent.AddNpcToEncounter(key));
            case ADD_TO_SCENE -> controller.acceptWorldReferenceIntent(
                    new WorldReferenceCatalogIntent.AddNpcToScene(key));
            default -> { }
        }
    }

    private void factionAction(CatalogActionId action, long key) {
        if (action == CatalogActionId.OPEN) {
            controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.OpenFaction(key));
        } else if (action == CatalogActionId.USE_AS_ENCOUNTER_SOURCE) {
            controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.UseFactionAsEncounterSource(key));
        }
    }

    private void locationAction(CatalogActionId action, long key) {
        switch (action) {
            case OPEN -> controller.acceptWorldReferenceIntent(new WorldReferenceCatalogIntent.OpenLocation(key));
            case USE_AS_ENCOUNTER_SOURCE -> controller.acceptWorldReferenceIntent(
                    new WorldReferenceCatalogIntent.UseLocationAsEncounterSource(key));
            case SET_FOCUSED_SCENE_LOCATION -> controller.acceptWorldReferenceIntent(
                    new WorldReferenceCatalogIntent.SetFocusedSceneLocation(key));
            default -> { }
        }
    }

    private static <R> CatalogRenderState<TextCatalogQuery, R, Long> textState(
            long revision,
            features.catalog.application.CatalogResultState<R> result,
            long selected,
            String query
    ) {
        return new CatalogRenderState<>(revision, new TextCatalogQuery(query), result, optional(selected),
                50, 0, result.rows().size(), "", CatalogRenderState.Confirmation.none());
    }

    private static Optional<Long> optional(long value) {
        return value > 0L ? Optional.of(value) : Optional.empty();
    }

    @Override public void close() {
        closed.set(true);
    }

    private final class CatalogShellBinding implements ShellBinding {
        private final Map<ShellSlot, javafx.scene.Node> slots;

        private CatalogShellBinding(CatalogWorkspaceView view) {
            slots = Map.of(ShellSlot.COCKPIT_CONTROLS, view.controls(), ShellSlot.COCKPIT_MAIN, view.content());
        }

        @Override public String title() { return "Katalog"; }
        @Override public Map<ShellSlot, javafx.scene.Node> slotContent() { return slots; }
        @Override public void onActivate() { controller.activate(); }
        @Override public void onDeactivate() { controller.deactivate(); }
    }
}
