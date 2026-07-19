package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.EncounterTableCatalogState.EncounterTableRow;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/** Encounter Table provider translation and explicit Encounter-source action. */
public final class EncounterTableCatalogDefinition
        implements CatalogSectionDefinition<TextCatalogQuery, EncounterTableRow, Long> {

    private final EncounterTableApi commands;
    private final EncounterTableCatalogModel catalog;
    private final EncounterHandoff encounter;
    private final AtomicLong providerRevision = new AtomicLong();

    public EncounterTableCatalogDefinition(
            EncounterTableApi commands,
            EncounterTableCatalogModel catalog,
            EncounterHandoff encounter
    ) {
        this.commands = Objects.requireNonNull(commands, "commands");
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
    }

    @Override public CatalogSectionId id() {
        return CatalogSectionId.ENCOUNTER_TABLES;
    }

    @Override public TextCatalogQuery initialQuery() {
        return TextCatalogQuery.empty();
    }

    @Override public void activated() {
        commands.refreshCatalog(new RefreshEncounterTableCatalogCommand());
    }

    @Override
    public CompletionStage<CatalogBrowseResult<TextCatalogQuery, EncounterTableRow>> query(
            CatalogBrowseRequest<TextCatalogQuery> request
    ) {
        EncounterTableCatalogResult current = catalog.current();
        CatalogResultState<EncounterTableRow> result;
        if (current.status() != EncounterTableReadStatus.SUCCESS) {
            result = CatalogResultState.failed("Encounter-Tabellen konnten nicht geladen werden.");
        } else {
            String search = normalized(request.query().text());
            List<EncounterTableRow> rows = current.tables().stream()
                    .map(table -> new EncounterTableRow(table.tableId(), table.name(), "#" + table.tableId()))
                    .filter(row -> search.isBlank()
                            || normalized(row.name() + " " + row.details()).contains(search))
                    .toList();
            result = CatalogResultState.ready(rows);
        }
        return CompletableFuture.completedFuture(CatalogBrowseResult.firstPage(
                request.query(), result, providerRevision.incrementAndGet()));
    }

    @Override public Long key(EncounterTableRow row) {
        return row.tableId();
    }

    @Override
    public Runnable observeProvider(Consumer<CatalogProviderChange<TextCatalogQuery>> listener) {
        return catalog.subscribe(ignored -> {
            providerRevision.incrementAndGet();
            listener.accept(CatalogProviderChange.invalidated());
        });
    }

    public void useAsEncounterSource(long tableId) {
        if (tableId > 0L) {
            encounter.useEncounterTableSource(tableId);
        }
    }

    public List<CatalogReferenceOption> options() {
        EncounterTableCatalogResult current = catalog.current();
        return current.status() == EncounterTableReadStatus.SUCCESS
                ? current.tables().stream()
                        .map(table -> new CatalogReferenceOption(table.tableId(), table.name())).toList()
                : List.of();
    }

    private static String normalized(String value) {
        return Objects.requireNonNullElse(value, "").trim().toLowerCase(Locale.ROOT);
    }
}
