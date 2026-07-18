package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.WorldReferenceCatalogIntent;
import features.catalog.application.WorldReferenceCatalogState;
import features.catalog.application.WorldReferenceCatalogState.LocationRow;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;

/** Passive location Catalog renderer. */
public final class LocationCatalogSection implements CatalogSection {

    private final Consumer<WorldReferenceCatalogIntent> intents;
    private final TextField query = queryField();
    private final CatalogControlsScaffold controls;
    private final CatalogTableScaffold<LocationRow, Long> content;
    private boolean rendering;
    private long renderedRevision = -1L;

    public LocationCatalogSection(Consumer<WorldReferenceCatalogIntent> intents) {
        this.intents = Objects.requireNonNull(intents, "intents");
        query.textProperty().addListener((ignored, before, after) -> {
            if (!rendering) {
                this.intents.accept(new WorldReferenceCatalogIntent.ChangeLocationQuery(after));
            }
        });
        Button create = new Button("Ort anlegen");
        create.getStyleClass().add("accent");
        create.setOnAction(ignored -> this.intents.accept(new WorldReferenceCatalogIntent.CreateLocation()));
        controls = new CatalogControlsScaffold("FILTER");
        controls.setSearch(query);
        controls.setActions(create);
        content = new CatalogTableScaffold<>(
                "Ortskatalog", LocationRow::locationId, LocationRow::displayName,
                List.of(
                        new CatalogTableScaffold.ColumnSpec<>("Name", LocationRow::displayName),
                        new CatalogTableScaffold.ColumnSpec<>("Details", LocationRow::details)),
                row -> this.intents.accept(new WorldReferenceCatalogIntent.OpenLocation(row.locationId())),
                id -> this.intents.accept(new WorldReferenceCatalogIntent.SelectLocation(id.orElse(0L))),
                List.of(
                        action("Als Quelle", "Ort als Encounter-Quelle verwenden", "Als Encounter-Quelle",
                                row -> new WorldReferenceCatalogIntent.UseLocationAsEncounterSource(row.locationId())),
                        action("Als Ort", "Ort der fokussierten Scene zuweisen", "Als Scene-Ort",
                                row -> new WorldReferenceCatalogIntent.SetFocusedSceneLocation(row.locationId()))));
    }

    @Override public CatalogSectionId id() { return CatalogSectionId.LOCATIONS; }
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
            query.setText(state.locations().query());
        } finally {
            rendering = false;
        }
        content.render(state.locations().results(), optionalId(state.locations().selectedId()),
                state.locations().results().rows().size(), Math.max(1, state.locations().results().rows().size()),
                0, "Orte");
    }

    private CatalogTableScaffold.ActionSpec<LocationRow> action(
            String label,
            String tooltip,
            String accessiblePrefix,
            java.util.function.Function<LocationRow, WorldReferenceCatalogIntent> intent
    ) {
        return new CatalogTableScaffold.ActionSpec<>(label, tooltip, accessiblePrefix,
                List.of("accent", "compact"), row -> intents.accept(intent.apply(row)));
    }

    private static Optional<Long> optionalId(long id) {
        return id > 0L ? Optional.of(id) : Optional.empty();
    }

    private static TextField queryField() {
        TextField field = new TextField();
        field.setAccessibleText("Orte suchen");
        field.setPromptText("Orte suchen …");
        return field;
    }
}
