package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.WorldReferenceCatalogIntent;
import features.catalog.application.WorldReferenceCatalogState;
import features.catalog.application.WorldReferenceCatalogState.NpcRow;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

/** Passive NPC Catalog renderer. */
public final class NpcCatalogSection implements CatalogSection {

    private final Consumer<WorldReferenceCatalogIntent> intents;
    private final TextField query = queryField("NPCs suchen", "NPCs suchen …");
    private final VBox controls;
    private final CatalogTableScaffold<NpcRow, Long> content;
    private boolean rendering;
    private long renderedRevision = -1L;

    public NpcCatalogSection(Consumer<WorldReferenceCatalogIntent> intents) {
        this.intents = Objects.requireNonNull(intents, "intents");
        query.textProperty().addListener((ignored, before, after) -> {
            if (!rendering) {
                this.intents.accept(new WorldReferenceCatalogIntent.ChangeNpcQuery(after));
            }
        });
        controls = new VBox(
                CatalogSectionControls.intro(
                        "NPCs", "Öffne NPCs im Inspector oder übergib sie explizit an Encounter und Scene.",
                        "NPC anlegen", () -> this.intents.accept(new WorldReferenceCatalogIntent.CreateNpc())),
                query);
        controls.getStyleClass().add("catalog-section-intro");
        content = new CatalogTableScaffold<>(
                "NPC-Katalog", NpcRow::npcId, NpcRow::displayName,
                List.of(
                        new CatalogTableScaffold.ColumnSpec<>("Name", NpcRow::displayName),
                        new CatalogTableScaffold.ColumnSpec<>("Details", NpcRow::details)),
                row -> this.intents.accept(new WorldReferenceCatalogIntent.OpenNpc(row.npcId())),
                id -> this.intents.accept(new WorldReferenceCatalogIntent.SelectNpc(id.orElse(0L))),
                List.of(
                        action("Zum Encounter", "NPC zum Encounter hinzufügen", "Zum Encounter",
                                row -> new WorldReferenceCatalogIntent.AddNpcToEncounter(row.npcId())),
                        action("Zur Scene", "NPC zur fokussierten Scene hinzufügen", "Zur Scene",
                                row -> new WorldReferenceCatalogIntent.AddNpcToScene(row.npcId()))));
    }

    @Override public CatalogSectionId id() { return CatalogSectionId.NPCS; }
    @Override public Node controls() { return controls; }
    @Override public Node content() { return content; }

    public void render(WorldReferenceCatalogState state) {
        Objects.requireNonNull(state, "state");
        if (state.revision() == renderedRevision) {
            return;
        }
        renderedRevision = state.revision();
        rendering = true;
        try {
            query.setText(state.npcs().query());
        } finally {
            rendering = false;
        }
        content.render(state.npcs().results(), selected(state.npcs().selectedId()),
                state.npcs().results().rows().size(), Math.max(1, state.npcs().results().rows().size()),
                0, "NPCs");
    }

    private CatalogTableScaffold.ActionSpec<NpcRow> action(
            String label,
            String tooltip,
            String accessiblePrefix,
            java.util.function.Function<NpcRow, WorldReferenceCatalogIntent> intent
    ) {
        return new CatalogTableScaffold.ActionSpec<>(label, tooltip, accessiblePrefix,
                List.of("accent", "compact"), row -> intents.accept(intent.apply(row)));
    }

    private static Long selected(long id) { return id > 0L ? id : null; }

    private static TextField queryField(String accessible, String prompt) {
        TextField field = new TextField();
        field.setAccessibleText(accessible);
        field.setPromptText(prompt);
        return field;
    }
}
