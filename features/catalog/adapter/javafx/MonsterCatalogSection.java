package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.MonsterCatalogIntent;
import features.catalog.application.MonsterCatalogSort;
import features.catalog.application.MonsterCatalogState;
import features.creatures.api.CreatureCatalogRow;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;

/** First production adopter of the passive Catalog table scaffold. */
final class MonsterCatalogSection implements CatalogSection {

    private final MonsterCatalogControls controls;
    private final CatalogTableScaffold<CreatureCatalogRow, Long> content;
    private final ComboBox<MonsterCatalogSort> sort = new ComboBox<>();
    private MonsterCatalogState state;
    private MonsterCatalogAuxiliaryOptions auxiliary = MonsterCatalogAuxiliaryOptions.empty();
    private long renderedRevision = -1L;
    private boolean rendering;

    MonsterCatalogSection(Consumer<MonsterCatalogIntent> intents) {
        Consumer<MonsterCatalogIntent> requiredIntents = Objects.requireNonNull(intents, "intents");
        controls = new MonsterCatalogControls(requiredIntents);
        content = new CatalogTableScaffold<>(
                "Monster-Ergebnisse",
                CreatureCatalogRow::id,
                CreatureCatalogRow::name,
                List.of(
                        new CatalogTableScaffold.ColumnSpec<>("Name", CreatureCatalogRow::name),
                        new CatalogTableScaffold.ColumnSpec<>("CR", CreatureCatalogRow::challengeRating),
                        new CatalogTableScaffold.ColumnSpec<>("Typ", CreatureCatalogRow::creatureType),
                        new CatalogTableScaffold.ColumnSpec<>("Größe", CreatureCatalogRow::size),
                        new CatalogTableScaffold.ColumnSpec<>("XP", row ->
                                NumberFormat.getIntegerInstance(Locale.US).format(row.xp()))),
                row -> requiredIntents.accept(new MonsterCatalogIntent.OpenCreature(row.id())),
                id -> requiredIntents.accept(new MonsterCatalogIntent.SelectCreature(id.orElse(0L))),
                List.of(
                        new CatalogTableScaffold.ActionSpec<>(
                                "+ Encounter", "Zum Encounter hinzufügen", "+ Encounter",
                                List.of("accent", "compact"),
                                row -> requiredIntents.accept(new MonsterCatalogIntent.AddToEncounter(row.id()))),
                        new CatalogTableScaffold.ActionSpec<>(
                                "+ Scene", "Zur fokussierten Scene hinzufügen", "+ Scene",
                                List.of("compact"),
                                row -> requiredIntents.accept(new MonsterCatalogIntent.AddToScene(row.id())))),
                new CatalogTableScaffold.Paging(
                        direction -> requiredIntents.accept(new MonsterCatalogIntent.ShiftPage(direction))));
        sort.setAccessibleText("Monster sortieren");
        sort.getItems().setAll(MonsterCatalogSort.values());
        sort.valueProperty().addListener((ignored, before, after) -> {
            if (!rendering && after != null) {
                requiredIntents.accept(new MonsterCatalogIntent.ChangeSort(after));
            }
        });
        content.setHeaderControl(sort);
    }

    @Override
    public CatalogSectionId id() {
        return CatalogSectionId.MONSTERS;
    }

    @Override
    public Node controls() {
        return controls;
    }

    @Override
    public Node content() {
        return content;
    }

    void render(MonsterCatalogState next) {
        state = Objects.requireNonNull(next, "next");
        if (state.revision() == renderedRevision) {
            return;
        }
        renderedRevision = state.revision();
        rendering = true;
        try {
            sort.setValue(state.sort());
            controls.render(state, auxiliary);
            content.render(
                    state.results(),
                    state.selectedCreatureId() > 0L ? state.selectedCreatureId() : null,
                    state.totalCount(), state.pageSize(), state.pageOffset(), "Monster");
        } finally {
            rendering = false;
        }
    }

    void renderAuxiliary(MonsterCatalogAuxiliaryOptions next) {
        auxiliary = Objects.requireNonNull(next, "next");
        if (state != null) {
            controls.render(state, auxiliary);
        }
    }
}
