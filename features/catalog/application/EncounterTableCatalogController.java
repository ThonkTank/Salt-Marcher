package features.catalog.application;

import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;
import java.util.List;
import java.util.Objects;

public final class EncounterTableCatalogController implements CatalogLifecycle {

    private final EncounterTableApi commands;
    private final EncounterTableCatalogModel catalog;
    private final Runnable changed;
    private EncounterTableCatalogState state = EncounterTableCatalogState.initial();
    private Runnable unsubscribe = () -> { };
    private boolean active;
    private long lifecycleEpoch;

    EncounterTableCatalogController(
            EncounterTableApi commands,
            EncounterTableCatalogModel catalog,
            Runnable changed
    ) {
        this.commands = Objects.requireNonNull(commands, "commands");
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public EncounterTableCatalogState state() {
        return state;
    }

    @Override
    public void activate() {
        if (active) {
            return;
        }
        active = true;
        long epoch = ++lifecycleEpoch;
        unsubscribe = CurrentFirstSubscription.open(
                catalog::current, catalog::subscribe, result -> {
                    if (active && lifecycleEpoch == epoch) {
                        apply(result);
                    }
                });
        commands.refreshCatalog(new RefreshEncounterTableCatalogCommand());
    }

    private void apply(EncounterTableCatalogResult result) {
        CatalogResultState<features.encountertable.api.EncounterTableSummary> results =
                result.status() == EncounterTableReadStatus.SUCCESS
                        ? CatalogResultState.ready(result.tables())
                        : new CatalogResultState<>(CatalogResultState.Status.FAILED, List.of(),
                                "Encounter-Tabellen konnten nicht geladen werden.");
        state = new EncounterTableCatalogState(results, state.selectedTableId(), state.query());
        changed.run();
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
        active = false;
        lifecycleEpoch++;
        unsubscribe.run();
        unsubscribe = () -> { };
    }

    @Override
    public void close() {
        deactivate();
    }
}
