package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.EncounterTableCatalogState.EncounterTableRow;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableSummary;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import platform.ui.UiDispatcher;

/** Owns Encounter Table projection, stable selection, lifecycle, and its sole explicit handoff. */
public final class EncounterTableCatalogController implements CatalogLifecycle {

    private final EncounterTableApi commands;
    private final EncounterTableCatalogModel catalog;
    private final EncounterHandoff encounter;
    private final WorldReferenceCatalogController worldReferences;
    private final UiDispatcher dispatcher;
    private final Runnable changed;
    private EncounterTableCatalogState state = EncounterTableCatalogState.initial();
    private List<EncounterTableSummary> tableSnapshot = List.of();
    private Runnable unsubscribe = () -> { };

    EncounterTableCatalogController(
            EncounterTableApi commands,
            EncounterTableCatalogModel catalog,
            EncounterHandoff encounter,
            WorldReferenceCatalogController worldReferences,
            UiDispatcher dispatcher,
            Runnable changed
    ) {
        this.commands = Objects.requireNonNull(commands, "commands");
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.worldReferences = Objects.requireNonNull(worldReferences, "worldReferences");
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public EncounterTableCatalogState state() {
        return state;
    }

    public void accept(EncounterTableCatalogIntent intent) {
        if (intent == null || state.lifecycle() == EncounterTableCatalogState.Lifecycle.CLOSED) {
            return;
        }
        switch (intent) {
            case EncounterTableCatalogIntent.ChangeQuery change -> changeQuery(change.query());
            case EncounterTableCatalogIntent.SelectTable select -> select(select.tableId());
            case EncounterTableCatalogIntent.UseAsEncounterSource use -> find(use.tableId())
                    .ifPresent(table -> encounter.useEncounterTableSource(table.tableId()));
        }
    }

    @Override
    public void activate() {
        if (state.lifecycle() != EncounterTableCatalogState.Lifecycle.INACTIVE) {
            return;
        }
        replace(state.lifecycleRevision() + 1L, EncounterTableCatalogState.Lifecycle.ACTIVE,
                state.results(), state.selectedTableId(), state.query(), state.options());
        long lifecycleRevision = state.lifecycleRevision();
        unsubscribe = CurrentFirstSubscription.open(
                catalog::current, catalog::subscribe,
                result -> dispatcher.dispatch(() -> apply(lifecycleRevision, result)));
        commands.refreshCatalog(new RefreshEncounterTableCatalogCommand());
    }

    @Override
    public void deactivate() {
        if (state.lifecycle() != EncounterTableCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        unsubscribe.run();
        unsubscribe = () -> { };
        replace(state.lifecycleRevision() + 1L, EncounterTableCatalogState.Lifecycle.INACTIVE,
                state.results(), state.selectedTableId(), state.query(), state.options());
    }

    @Override
    public void close() {
        if (state.lifecycle() == EncounterTableCatalogState.Lifecycle.CLOSED) {
            return;
        }
        deactivate();
        replace(state.lifecycleRevision() + 1L, EncounterTableCatalogState.Lifecycle.CLOSED,
                state.results(), state.selectedTableId(), state.query(), state.options());
    }

    private void apply(long lifecycleRevision, EncounterTableCatalogResult result) {
        if (!accepts(lifecycleRevision)) {
            return;
        }
        boolean success = result != null && result.status() == EncounterTableReadStatus.SUCCESS;
        tableSnapshot = success ? result.tables() : List.of();
        List<EncounterTableRow> allRows = tableSnapshot.stream()
                .map(table -> new EncounterTableRow(table.tableId(), table.name(), "#" + table.tableId())).toList();
        List<CatalogReferenceOption> options = tableSnapshot.stream()
                .map(table -> new CatalogReferenceOption(table.tableId(), table.name())).toList();
        long selected = success && tableSnapshot.stream()
                .anyMatch(table -> table.tableId() == state.selectedTableId()) ? state.selectedTableId() : 0L;
        CatalogResultState<EncounterTableRow> results;
        if (!success) {
            results = CatalogResultState.failed("Encounter-Tabellen konnten nicht geladen werden.");
        } else {
            List<EncounterTableRow> visible = filter(allRows, state.query());
            results = CatalogResultState.ready(visible);
        }
        replaceKeepingLifecycle(results, selected, state.query(), options);
        worldReferences.acceptEncounterTableLabels(result);
        changed.run();
    }

    private void changeQuery(String query) {
        String next = Objects.requireNonNullElse(query, "");
        if (next.equals(state.query())) {
            return;
        }
        CatalogResultState<EncounterTableRow> results;
        if (state.results().status() == CatalogResultState.Status.FAILED) {
            results = state.results();
        } else {
            List<EncounterTableRow> rows = tableSnapshot.stream()
                    .map(table -> new EncounterTableRow(table.tableId(), table.name(), "#" + table.tableId())).toList();
            results = CatalogResultState.ready(filter(rows, next));
        }
        replaceKeepingLifecycle(results, state.selectedTableId(), next, state.options());
        changed.run();
    }

    private void select(long id) {
        if (id < 0L || id > 0L && find(id).isEmpty() || id == state.selectedTableId()) {
            return;
        }
        replaceKeepingLifecycle(state.results(), id, state.query(), state.options());
        changed.run();
    }

    private java.util.Optional<EncounterTableSummary> find(long id) {
        return tableSnapshot.stream().filter(table -> table.tableId() == id).findFirst();
    }

    private boolean accepts(long lifecycleRevision) {
        return state.lifecycle() == EncounterTableCatalogState.Lifecycle.ACTIVE
                && state.lifecycleRevision() == lifecycleRevision;
    }

    private void replaceKeepingLifecycle(
            CatalogResultState<EncounterTableRow> results,
            long selectedTableId,
            String query,
            List<CatalogReferenceOption> options
    ) {
        replace(state.lifecycleRevision(), state.lifecycle(), results, selectedTableId, query, options);
    }

    private void replace(
            long lifecycleRevision,
            EncounterTableCatalogState.Lifecycle lifecycle,
            CatalogResultState<EncounterTableRow> results,
            long selectedTableId,
            String query,
            List<CatalogReferenceOption> options
    ) {
        state = new EncounterTableCatalogState(
                state.revision() + 1L, lifecycleRevision, lifecycle, results,
                selectedTableId, query, options);
    }

    private static List<EncounterTableRow> filter(List<EncounterTableRow> rows, String query) {
        String normalized = Objects.requireNonNullElse(query, "").trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? rows : rows.stream()
                .filter(row -> (row.name() + " " + row.details()).toLowerCase(Locale.ROOT).contains(normalized))
                .toList();
    }
}
