package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.EncounterTableCatalogIntent;
import features.catalog.application.EncounterTableCatalogState;
import features.catalog.application.EncounterTableCatalogState.EncounterTableRow;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

/** Passive read-only Encounter Table Catalog renderer without a primary open action. */
public final class EncounterTableCatalogSection implements CatalogSection {

    private final Consumer<EncounterTableCatalogIntent> intents;
    private final TextField query = queryField();
    private final VBox controls;
    private final CatalogTableScaffold<EncounterTableRow, Long> content;
    private boolean rendering;
    private long renderedRevision = -1L;

    public EncounterTableCatalogSection(Consumer<EncounterTableCatalogIntent> intents) {
        this.intents = Objects.requireNonNull(intents, "intents");
        query.textProperty().addListener((ignored, before, after) -> {
            if (!rendering) {
                this.intents.accept(new EncounterTableCatalogIntent.ChangeQuery(after));
            }
        });
        controls = new VBox(
                CatalogSectionControls.intro(
                        "Encounter-Tabellen",
                        "Encounter-Tabellen sind eine read-only Referenz für Monster und Encounter."),
                query);
        controls.getStyleClass().add("catalog-section-intro");
        content = new CatalogTableScaffold<>(
                "Encounter-Tabellen-Katalog", EncounterTableRow::tableId, EncounterTableRow::name,
                List.of(
                        new CatalogTableScaffold.ColumnSpec<>("Name", EncounterTableRow::name),
                        new CatalogTableScaffold.ColumnSpec<>("Details", EncounterTableRow::details)),
                Optional.empty(),
                id -> this.intents.accept(new EncounterTableCatalogIntent.SelectTable(id == null ? 0L : id)),
                List.of(new CatalogTableScaffold.ActionSpec<>(
                        "Als Quelle", "Encounter-Tabelle als Encounter-Quelle verwenden", "Als Encounter-Quelle",
                        List.of("accent", "compact"), row -> this.intents.accept(
                                new EncounterTableCatalogIntent.UseAsEncounterSource(row.tableId())))),
                ignored -> { });
        content.setPagingVisible(false);
    }

    @Override public CatalogSectionId id() { return CatalogSectionId.ENCOUNTER_TABLES; }
    @Override public Node controls() { return controls; }
    @Override public Node content() { return content; }

    public void render(EncounterTableCatalogState state) {
        Objects.requireNonNull(state, "state");
        if (state.revision() == renderedRevision) {
            return;
        }
        renderedRevision = state.revision();
        rendering = true;
        try {
            query.setText(state.query());
        } finally {
            rendering = false;
        }
        content.render(state.results(), selected(state.selectedTableId()),
                state.results().rows().size(), Math.max(1, state.results().rows().size()),
                0, "Encounter-Tabellen");
    }

    private static Long selected(long id) { return id > 0L ? id : null; }

    private static TextField queryField() {
        TextField field = new TextField();
        field.setAccessibleText("Encounter-Tabellen suchen");
        field.setPromptText("Encounter-Tabellen suchen …");
        return field;
    }
}
