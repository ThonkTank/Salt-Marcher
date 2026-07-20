package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.catalog.application.CatalogApplicationRoutes.WorldInspectorRoutes;
import features.creatures.api.CreatureReferenceIndexModel;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.List;

/** NPC provider projection and explicit NPC actions. */
public final class NpcCatalogDefinition implements CatalogSectionDefinition<TextCatalogQuery, NpcCatalogRow, Long> {

    private final CreatureReferenceIndexModel creatures;
    private final WorldPlannerSnapshotModel world;
    private final WorldInspectorRoutes inspectors;
    private final EncounterHandoff encounter;
    private final SceneHandoff scene;
    private final AtomicLong providerRevision = new AtomicLong();

    public NpcCatalogDefinition(
            CreatureReferenceIndexModel creatures,
            WorldPlannerSnapshotModel world,
            WorldInspectorRoutes inspectors,
            EncounterHandoff encounter,
            SceneHandoff scene
    ) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.world = Objects.requireNonNull(world, "world");
        this.inspectors = Objects.requireNonNull(inspectors, "inspectors");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.scene = Objects.requireNonNull(scene, "scene");
    }

    @Override public CatalogSectionId id() { return CatalogSectionId.NPCS; }
    @Override public TextCatalogQuery initialQuery() { return TextCatalogQuery.empty(); }

    @Override
    public CompletionStage<CatalogBrowseResult<TextCatalogQuery, NpcCatalogRow>> query(
            CatalogBrowseRequest<TextCatalogQuery> request
    ) {
        return CompletableFuture.completedFuture(CatalogBrowseResult.firstPage(
                request.query(), WorldCatalogProjection.npcs(
                        world.current(), creatures.current(), request.query().text()),
                providerRevision.incrementAndGet()));
    }

    @Override public Long key(NpcCatalogRow row) { return row.npcId(); }

    @Override
    public CatalogPresentationSpec<TextCatalogQuery, NpcCatalogRow, Long> presentation() {
        return new CatalogPresentationSpec<>(
                "NPC-Katalog", "NPCs", NpcCatalogRow::displayName,
                List.of(textFilter("NPCs suchen …", "NPCs suchen")),
                List.of(
                        new CatalogColumnSpec<>("name", "Name", NpcCatalogRow::displayName, true),
                        new CatalogColumnSpec<>("details", "Details", NpcCatalogRow::details, false)),
                Optional.of(openAction()),
                List.of(
                        new CatalogActionSpec(
                                CatalogActionId.ADD_TO_ENCOUNTER, "Zum Encounter",
                                "NPC zum Encounter hinzufügen", "Zum Encounter",
                                CatalogActionSpec.Emphasis.PRIMARY),
                        new CatalogActionSpec(
                                CatalogActionId.ADD_TO_SCENE, "Zur Scene",
                                "NPC zur fokussierten Scene hinzufügen", "Zur Scene",
                                CatalogActionSpec.Emphasis.SECONDARY)),
                List.of(CatalogActionSpec.create()), false,
                new CatalogSortOrder("name", CatalogSortOrder.Direction.ASCENDING), CatalogSortMode.LOCAL);
    }

    @Override
    public Runnable observeProvider(Consumer<CatalogProviderChange<TextCatalogQuery>> listener) {
        return CatalogSubscriptions.acquire(
                () -> creatures.subscribe(ignored -> changed(listener)),
                () -> world.subscribe(ignored -> changed(listener)));
    }

    public void open(long id) { find(id).ifPresent(npc -> inspectors.openNpc(npc.npcId())); }
    public void create() { inspectors.createNpc(); }
    public void addToEncounter(long id) { find(id).ifPresent(npc ->
            encounter.addWorldNpc(npc.creatureStatblockId(), npc.npcId())); }
    public void addToScene(long id) { find(id).ifPresent(npc -> scene.addNpc(npc.npcId())); }

    private Optional<WorldNpcSummary> find(long id) {
        var snapshot = world.current();
        return snapshot.status() == WorldPlannerReadStatus.SUCCESS
                ? snapshot.npcs().stream().filter(value -> value.npcId() == id).findFirst()
                : Optional.empty();
    }

    private void changed(Consumer<CatalogProviderChange<TextCatalogQuery>> listener) {
        providerRevision.incrementAndGet();
        listener.accept(CatalogProviderChange.invalidated());
    }

    private static CatalogFilterSpec.Text<TextCatalogQuery> textFilter(String prompt, String accessible) {
        return new CatalogFilterSpec.Text<>(prompt, accessible, TextCatalogQuery::text,
                (query, value) -> new TextCatalogQuery(value),
                query -> CatalogFilterTokens.single(
                        query.text().isBlank() ? "" : "Suche: " + query.text(),
                        ignored -> TextCatalogQuery.empty()),
                ignored -> TextCatalogQuery.empty());
    }

    private static CatalogActionSpec openAction() {
        return new CatalogActionSpec(CatalogActionId.OPEN, "Details öffnen", "NPC im Inspector öffnen",
                "Öffnen", CatalogActionSpec.Emphasis.SECONDARY);
    }

}
