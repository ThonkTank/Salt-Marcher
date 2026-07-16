package features.encounter.adapter.javafx.state;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Labeled;
import javafx.scene.control.ScrollPane;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;
import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureProfile;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.encounter.application.EncounterApplicationService;
import features.encounter.EncounterServiceAssembly;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.encounter.domain.plan.repository.EncounterPlanRepository;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encountertable.domain.catalog.EncounterTableCandidateData;
import features.encountertable.domain.catalog.EncounterTableSummaryData;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.party.api.PartyApi;
import features.party.PartyServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.party.api.CalculateAdventuringDayCommand;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

@org.junit.jupiter.api.Tag("ui")
public final class EncounterStateTabTest {

    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();
    private static final int AWAIT_SECONDS = 10;
    private static final long GOBLIN_ID = 101L;
    private static final int GOBLIN_COUNT = 2;

    @BeforeAll
    static void startJavaFx() throws InterruptedException {
        startFx();
    }

    @AfterAll
    static void stopJavaFx() throws InterruptedException {
        shutdownFx();
    }

    @Test
    void ENCOUNTER_STATE_TAB_001() throws Exception {
        runOnFxThread(EncounterStateTabTest::assertEncounterStateTabOpensThroughShellBinding);
    }

    @Test
    void ENCOUNTER_STATE_TAB_002() throws Exception {
        runOnFxThread(EncounterStateTabTest::assertSavedEncounterReadbackRendersInStateTab);
    }

    @Test
    void ENCOUNTER_STATE_TAB_003() throws Exception {
        runOnFxThread(EncounterStateTabTest::assertUnsavedRosterPublicationForCatalogConfirmation);
    }

    private static void assertEncounterStateTabOpensThroughShellBinding() {
        TestRuntime runtime = TestRuntime.create();
        ShellBinding binding = runtime.contribution().bind();
        EncounterStateView view = encounterStateView(binding);
        assertTextPresent(view, "Encounter", "ENCOUNTER-STATE-TAB-001 title");
        assertTextPresent(view, "Monster per +Add hinzufuegen...", "ENCOUNTER-STATE-TAB-001 empty roster");
        assertTextAbsent(view, "Oeffnen", "Saved-plan opening moved out of Encounter state");
    }

    private static void assertUnsavedRosterPublicationForCatalogConfirmation() {
        TestRuntime runtime = TestRuntime.create();
        runtime.openSavedEncounter();
        if (runtime.hasUnsavedRosterChanges()) {
            throw new AssertionError("Opening a saved plan must begin from a clean roster state.");
        }
        runtime.addGoblin();
        if (!runtime.hasUnsavedRosterChanges()) {
            throw new AssertionError("Roster mutation must publish unsaved state for Catalog confirmation.");
        }
    }

    private static void assertSavedEncounterReadbackRendersInStateTab() {
        TestRuntime runtime = TestRuntime.create();
        ShellBinding binding = runtime.contribution().bind();
        EncounterStateView view = encounterStateView(binding);
        runtime.openSavedEncounter();
        assertTextPresent(view, "Gate Ambush", "ENCOUNTER-STATE-TAB-002 saved plan title");
        assertTextPresent(view, "Adj. XP: 100", "ENCOUNTER-STATE-TAB-002 saved plan adjusted XP");
        assertTextPresent(view, "Goblin Ambusher", "ENCOUNTER-STATE-TAB-002 saved plan creature");
        assertTextPresent(view, "CR 1/4  |  100 XP  |  humanoid", "ENCOUNTER-STATE-TAB-002 creature facts");
        assertTextPresent(view, String.valueOf(GOBLIN_COUNT), "ENCOUNTER-STATE-TAB-002 creature count");
    }

    private static EncounterStateView encounterStateView(ShellBinding binding) {
        Node node = binding.slotContent().get(ShellSlot.COCKPIT_STATE);
        if (node instanceof EncounterStateView view) {
            return view;
        }
        throw new IllegalStateException("Expected EncounterStateView bound in COCKPIT_STATE.");
    }

    private static List<Labeled> labeledNodes(Node root) {
        List<Labeled> nodes = new ArrayList<>();
        collectLabeled(root, nodes);
        return nodes;
    }

    private static void collectLabeled(Node node, List<Labeled> nodes) {
        if (node instanceof Labeled labeled) {
            nodes.add(labeled);
        }
        if (node instanceof ScrollPane scrollPane && scrollPane.getContent() != null) {
            collectLabeled(scrollPane.getContent(), nodes);
        }
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collectLabeled(child, nodes);
            }
        }
    }

    private static void assertTextPresent(Node root, String expected, String message) {
        boolean found = labeledNodes(root).stream()
                .map(Labeled::getText)
                .anyMatch(expected::equals);
        if (!found) {
            throw new IllegalStateException(message + " expected visible text <" + expected + ">.");
        }
    }

    private static void assertTextAbsent(Node root, String expected, String message) {
        boolean found = labeledNodes(root).stream().map(Labeled::getText).anyMatch(expected::equals);
        if (found) {
            throw new IllegalStateException(message + " unexpectedly found visible text <" + expected + ">.");
        }
    }

    private static void startFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(false, true)) {
            CountDownLatch started = new CountDownLatch(1);
            testsupport.JavaFxRuntime.startup(started::countDown);
            await(started, "JavaFX startup");
        }
    }

    private static void shutdownFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(true, false)) {
            CountDownLatch stopped = new CountDownLatch(1);
            Platform.runLater(() -> {
                stopped.countDown();
                testsupport.JavaFxRuntime.shutdown();
            });
            await(stopped, "JavaFX shutdown");
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch finished = new CountDownLatch(1);
        RuntimeException[] failure = new RuntimeException[1];
        Platform.runLater(() -> {
            try {
                action.run();
            } catch (RuntimeException exception) {
                failure[0] = exception;
            } catch (Exception exception) {
                failure[0] = new RuntimeException(exception);
            } finally {
                finished.countDown();
            }
        });
        await(finished, "JavaFX test action");
        if (failure[0] != null) {
            throw failure[0];
        }
    }

    private static void await(CountDownLatch latch, String description) throws InterruptedException {
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException(description + " timed out.");
        }
    }

    private interface ThrowingRunnable {

        void run() throws Exception;
    }

    private static final class TestRuntime {

        private final CreaturesServiceAssembly.Component creatures;
        private final EncounterServiceAssembly.Component encounter;
        private final long planId;

        private TestRuntime(
                CreaturesServiceAssembly.Component creatures,
                EncounterServiceAssembly.Component encounter,
                long planId
        ) {
            this.creatures = Objects.requireNonNull(creatures, "creatures");
            this.encounter = Objects.requireNonNull(encounter, "encounter");
            this.planId = planId;
        }

        static TestRuntime create() {
            PartyServiceAssembly.Component party =
                    PartyServiceAssembly.create(new SqlitePartyRosterRepository());
            seedParty(party.application());
            seedCreatureCatalogPersistence();
            CreaturesServiceAssembly.Component creatures =
                    CreaturesServiceAssembly.create(new FixtureCreatureCatalogPort());
            EncounterTableServiceAssembly.Component tables =
                    EncounterTableServiceAssembly.create(new EmptyEncounterTableCatalogPort());
            SqliteEncounterPlanRepository plans = new SqliteEncounterPlanRepository();
            EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                    creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                    tables.application(), tables.candidates(), null,
                    party.application(), party.activeParty(), party.activeComposition(),
                    party.adventuringDaySummary(), party.mutation(), plans);
            long savedPlanId = seedSavedEncounter(plans);
            return new TestRuntime(creatures, encounter, savedPlanId);
        }

        void openSavedEncounter() {
            encounter.application().applyState(ApplyEncounterStateCommand.openSavedPlan(planId));
        }

        void addGoblin() {
            encounter.application().applyState(ApplyEncounterStateCommand.addCreature(GOBLIN_ID));
        }

        boolean hasUnsavedRosterChanges() {
            return encounter.state().current().builderPane().hasUnsavedRosterChanges();
        }

        EncounterStateContribution contribution() {
            return new EncounterStateContribution(
                    creatures.detail(), creatures.application(), encounter.state(), encounter.application(),
                    null, new NoopInspectorSink());
        }

        private static void seedParty(PartyApi party) {
            List<Integer> levels = List.of(3, 3, 3, 3);
            for (int index = 0; index < levels.size(); index++) {
                party.createCharacter(new CreateCharacterCommand(
                        new CharacterDraft("Hero " + (index + 1), "Mira", levels.get(index), 12, 16),
                        MembershipState.ACTIVE));
            }
            party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, 0));
        }

        private static long seedSavedEncounter(EncounterPlanRepository repository) {
            EncounterPlan plan = repository.save(new EncounterPlan(
                    0L,
                    "Gate Ambush",
                    "",
                    List.of(new EncounterPlanCreature(GOBLIN_ID, GOBLIN_COUNT))));
            return plan.id();
        }

        private static void seedCreatureCatalogPersistence() {
            try {
                Class.forName("org.sqlite.JDBC");
                try (Connection connection = DriverManager.getConnection(creatureDatabaseUrl())) {
                    try (Statement statement = connection.createStatement()) {
                        statement.execute("PRAGMA foreign_keys = ON");
                        statement.execute(CreaturesPersistenceSchema.CREATE_CREATURES_TABLE_SQL);
                    }
                    try (PreparedStatement statement = connection.prepareStatement("""
                            INSERT OR IGNORE INTO creatures (
                                id,
                                name,
                                size,
                                creature_type,
                                alignment,
                                cr,
                                xp,
                                hp,
                                hit_dice_count,
                                hit_dice_sides,
                                hit_dice_modifier,
                                ac,
                                speed,
                                str,
                                dex,
                                con,
                                intel,
                                wis,
                                cha,
                                initiative_bonus,
                                proficiency_bonus,
                                passive_perception,
                                legendary_action_count
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """)) {
                        statement.setLong(1, GOBLIN_ID);
                        statement.setString(2, "Goblin Ambusher");
                        statement.setString(3, "Small");
                        statement.setString(4, "humanoid");
                        statement.setString(5, "neutral evil");
                        statement.setString(6, "1/4");
                        statement.setInt(7, 50);
                        statement.setInt(8, 15);
                        statement.setInt(9, 2);
                        statement.setInt(10, 8);
                        statement.setInt(11, 0);
                        statement.setInt(12, 12);
                        statement.setInt(13, 30);
                        statement.setInt(14, 8);
                        statement.setInt(15, 14);
                        statement.setInt(16, 10);
                        statement.setInt(17, 10);
                        statement.setInt(18, 8);
                        statement.setInt(19, 8);
                        statement.setInt(20, 2);
                        statement.setInt(21, 2);
                        statement.setInt(22, 10);
                        statement.setInt(23, 0);
                        statement.executeUpdate();
                    }
                }
            } catch (ClassNotFoundException | java.sql.SQLException exception) {
                throw new IllegalStateException("Failed to seed creature catalog persistence.", exception);
            }
        }

        private static String creatureDatabaseUrl() {
            String dataHome = System.getenv("XDG_DATA_HOME");
            if (dataHome == null || dataHome.isBlank()) {
                throw new IllegalStateException("XDG_DATA_HOME must isolate the Encounter state-tab DB.");
            }
            Path database = Path.of(dataHome, "salt-marcher", CreaturesPersistenceSchema.DATABASE_FILE_NAME)
                    .toAbsolutePath()
                    .normalize();
            return "jdbc:sqlite:" + database;
        }
    }

    private static final class NoopInspectorSink implements InspectorSink {

        @Override
        public void push(InspectorEntrySpec entry) {
            // No inspector interaction is expected from passive state-tab rendering.
        }

        @Override
        public void clear() {
            // No inspector interaction is expected from passive state-tab rendering.
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }

    private static final class FixtureCreatureCatalogPort implements CreatureCatalogPort {

        private static final Map<Long, CreatureProfile> PROFILES = profiles();

        @Override
        public CreatureCatalogData.DistinctFilterValues loadFilterValues() {
            return CreatureCatalogData.emptyFilterValues();
        }

        @Override
        public CreatureCatalogData.CatalogPageData searchCatalog(CreatureCatalogData.CatalogSearchSpec spec) {
            return CreatureCatalogData.emptyCatalogPage(50, 0);
        }

        @Override
        public CreatureProfile loadCreatureDetail(long creatureId) {
            return PROFILES.get(creatureId);
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) {
            return PROFILES.values().stream()
                    .filter(profile -> profile.xp() >= spec.minimumXp() && profile.xp() <= spec.maximumXp())
                    .map(FixtureCreatureCatalogPort::candidate)
                    .limit(Math.max(0, spec.limit()))
                    .toList();
        }

        private static Map<Long, CreatureProfile> profiles() {
            Map<Long, CreatureProfile> profiles = new LinkedHashMap<>();
            profiles.put(GOBLIN_ID, profile(GOBLIN_ID, "Goblin Ambusher", 50));
            return Map.copyOf(profiles);
        }

        private static CreatureProfile profile(long id, String name, int xp) {
            return new CreatureProfile(
                    new CreatureCatalogData.CreatureIdentity(
                            id,
                            name,
                            "Small",
                            "humanoid",
                            List.of(),
                            List.of(),
                            "neutral evil",
                            "1/4",
                            xp),
                    new CreatureCatalogData.CreatureVitals(15, null, 1, 8, 0, 12, null, 30, 0, 0, 0, 0),
                    new CreatureCatalogData.CreatureAbilities(8, 14, 10, 10, 8, 8, 1, 2),
                    new CreatureCatalogData.CreatureTraits(null, null, null, null, null, null, null, 10, null, 0),
                    List.of());
        }

        private static CreatureCatalogData.EncounterCandidateProfile candidate(CreatureProfile profile) {
            return new CreatureCatalogData.EncounterCandidateProfile(
                    profile.id(),
                    profile.name(),
                    profile.creatureType(),
                    profile.challengeRating(),
                    profile.xp(),
                    profile.hitPoints(),
                    profile.hitDiceCount(),
                    profile.hitDiceSides(),
                    profile.hitDiceModifier(),
                    profile.armorClass(),
                    profile.initiativeBonus(),
                    profile.legendaryActionCount());
        }
    }

    private static final class EmptyEncounterTableCatalogPort implements EncounterTableCatalogPort {

        @Override
        public List<EncounterTableSummaryData> loadSummaries() {
            return List.of();
        }

        @Override
        public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
            return List.of();
        }
    }
}
