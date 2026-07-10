package src.view.statetabs.encounter;

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
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.data.creatures.model.CreaturesPersistenceSchema;
import src.domain.creatures.CreaturesServiceContribution;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.CreatureCatalogData.CreatureProfile;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.EncounterServiceContribution;
import src.domain.encounter.model.plan.EncounterPlan;
import src.domain.encounter.model.plan.EncounterPlanCreature;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;

public final class EncounterStateTabHarness {

    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();
    private static final int AWAIT_SECONDS = 10;
    private static final long GOBLIN_ID = 101L;
    private static final int GOBLIN_COUNT = 2;

    private EncounterStateTabHarness() {
    }

    public static void main(String[] args) {
        try {
            startFx();
            runOnFxThread(EncounterStateTabHarness::run);
            shutdownFx();
            System.out.println("Encounter state tab harness passed: 2 proof item(s).");
            System.out.println("ENCOUNTER-STATE-TAB-001 Ready: Encounter state tab opens through shell binding.");
            System.out.println("ENCOUNTER-STATE-TAB-002 Ready: Saved encounter readback renders in the state tab.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            try {
                shutdownFx();
            } catch (Exception shutdownFailure) {
                shutdownFailure.printStackTrace(System.err);
            }
            System.exit(1);
        }
    }

    private static void run() {
        HarnessRuntime runtime = HarnessRuntime.create();
        ShellBinding binding = new EncounterStateContribution().bind(runtime.runtimeContext());
        EncounterStateView view = encounterStateView(binding);
        assertTextPresent(view, "Encounter", "ENCOUNTER-STATE-TAB-001 title");
        assertTextPresent(view, "Monster per +Add hinzufuegen...", "ENCOUNTER-STATE-TAB-001 empty roster");

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

    private static void startFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(false, true)) {
            CountDownLatch started = new CountDownLatch(1);
            Platform.startup(started::countDown);
            await(started, "JavaFX startup");
        }
    }

    private static void shutdownFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(true, false)) {
            CountDownLatch stopped = new CountDownLatch(1);
            Platform.runLater(() -> {
                stopped.countDown();
                Platform.exit();
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
        await(finished, "JavaFX harness action");
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

    private static final class HarnessRuntime {

        private final ServiceRegistry registry;
        private final long planId;

        private HarnessRuntime(ServiceRegistry registry, long planId) {
            this.registry = Objects.requireNonNull(registry, "registry");
            this.planId = planId;
        }

        static HarnessRuntime create() {
            ServiceRegistry registry = registry();
            seedParty(registry.require(PartyApplicationService.class));
            seedCreatureCatalogPersistence();
            long savedPlanId = seedSavedEncounter(registry.require(EncounterPlanRepository.class));
            return new HarnessRuntime(registry, savedPlanId);
        }

        ShellRuntimeContext runtimeContext() {
            return new ShellRuntimeContext(new NoopInspectorSink(), registry);
        }

        void openSavedEncounter() {
            registry.require(EncounterApplicationService.class)
                    .applyState(ApplyEncounterStateCommand.openSavedPlan(planId));
        }

        private static ServiceRegistry registry() {
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            builder.register(CreatureCatalogPort.class, new FixtureCreatureCatalogPort());
            builder.register(EncounterTableCatalogPort.class, new EmptyEncounterTableCatalogPort());
            new src.data.party.PartyServiceContribution().register(builder);
            new src.data.encounter.EncounterServiceContribution().register(builder);
            new CreaturesServiceContribution().register(builder);
            new src.domain.encountertable.EncounterTableServiceContribution().register(builder);
            new src.domain.party.PartyServiceContribution().register(builder);
            new EncounterServiceContribution().register(builder);
            return builder.build();
        }

        private static void seedParty(PartyApplicationService party) {
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
                            INSERT OR REPLACE INTO creatures (
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
