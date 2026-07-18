package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.WorldReferenceCatalogIntent;
import features.catalog.application.WorldReferenceCatalogState;
import features.catalog.application.WorldReferenceCatalogState.FactionRow;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;

/** Passive faction Catalog renderer. */
public final class FactionCatalogSection implements CatalogSection {

    private final Consumer<WorldReferenceCatalogIntent> intents;
    private final TextField query = CatalogControlKit.search("Fraktionen suchen", "Fraktionen suchen …");
    private final CatalogControlsScaffold controls;
    private final CatalogTableScaffold<FactionRow, Long> content;
    private boolean rendering;
    private long renderedRevision = -1L;

    public FactionCatalogSection(Consumer<WorldReferenceCatalogIntent> intents) {
        this.intents = Objects.requireNonNull(intents, "intents");
        query.textProperty().addListener((ignored, before, after) -> {
            if (!rendering) {
                this.intents.accept(new WorldReferenceCatalogIntent.ChangeFactionQuery(after));
            }
        });
        Button create = CatalogControlKit.action("Fraktion anlegen", "Fraktion anlegen", true);
        create.setOnAction(ignored -> this.intents.accept(new WorldReferenceCatalogIntent.CreateFaction()));
        controls = new CatalogControlsScaffold();
        controls.setSearch(query);
        controls.setActions(create);
        content = new CatalogTableScaffold<>(
                "Fraktionskatalog", FactionRow::factionId, FactionRow::displayName,
                List.of(
                        new CatalogTableScaffold.ColumnSpec<>("Name", FactionRow::displayName),
                        new CatalogTableScaffold.ColumnSpec<>("Details", FactionRow::details)),
                row -> this.intents.accept(new WorldReferenceCatalogIntent.OpenFaction(row.factionId())),
                id -> this.intents.accept(new WorldReferenceCatalogIntent.SelectFaction(id.orElse(0L))),
                List.of(new CatalogTableScaffold.ActionSpec<>(
                        "Als Quelle", "Fraktion als Encounter-Quelle verwenden", "Als Encounter-Quelle",
                        List.of("accent", "compact"), row -> this.intents.accept(
                                new WorldReferenceCatalogIntent.UseFactionAsEncounterSource(row.factionId())))));
    }

    @Override public CatalogSectionId id() { return CatalogSectionId.FACTIONS; }
    @Override public CatalogControlsScaffold controls() { return controls; }
    @Override public Node content() { return content; }

    public void render(WorldReferenceCatalogState state) {
        Objects.requireNonNull(state, "state");
        if (state.revision() == renderedRevision) {
            return;
        }
        renderedRevision = state.revision();
        rendering = true;
        try {
            query.setText(state.factions().query());
        } finally {
            rendering = false;
        }
        content.render(state.factions().results(), optionalId(state.factions().selectedId()),
                state.factions().results().rows().size(), Math.max(1, state.factions().results().rows().size()),
                0, "Fraktionen");
    }

    private static Optional<Long> optionalId(long id) {
        return id > 0L ? Optional.of(id) : Optional.empty();
    }

}
