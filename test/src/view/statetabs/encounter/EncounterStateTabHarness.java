package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
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
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.CreatureCatalogData.CreatureProfile;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;
import src.domain.creatures.model.catalog.usecase.LoadCreatureDetailUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureEncounterCandidatesUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.model.catalog.usecase.SearchCreatureCatalogUseCase;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.model.plan.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.plan.usecase.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.model.plan.usecase.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.model.session.EncounterSessionPublicationData;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.model.session.usecase.PublishEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.UpdateEncounterBuilderInputsUseCase;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.SavedEncounterPlanSummary;

public final class EncounterStateTabHarness {

    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();
    private static final int AWAIT_SECONDS = 10;

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
        MutableEncounterStateFeed feed = new MutableEncounterStateFeed();
        ShellBinding binding = new EncounterStateContribution().bind(runtimeContext(feed.model()));
        EncounterStateView view = encounterStateView(binding);
        assertTextPresent(view, "Encounter", "ENCOUNTER-STATE-TAB-001 title");
        assertTextPresent(view, "Monster per +Add hinzufuegen...", "ENCOUNTER-STATE-TAB-001 empty roster");

        feed.publish(savedEncounterSnapshot());
        assertTextPresent(view, "Gate Ambush", "ENCOUNTER-STATE-TAB-002 saved plan title");
        assertTextPresent(view, "Adj. XP: 100", "ENCOUNTER-STATE-TAB-002 saved plan adjusted XP");
        assertTextPresent(view, "Goblin Ambusher", "ENCOUNTER-STATE-TAB-002 saved plan creature");
        assertTextPresent(view, "CR 1/4  |  50 XP  |  humanoid", "ENCOUNTER-STATE-TAB-002 creature facts");
        assertTextPresent(view, "2", "ENCOUNTER-STATE-TAB-002 creature count");
    }

    private static EncounterStateSnapshot savedEncounterSnapshot() {
        EncounterStateSnapshot.ThresholdMeter thresholds =
                new EncounterStateSnapshot.ThresholdMeter(25, 50, 75, 100, 100, "Deadly");
        EncounterStateSnapshot.RosterCard goblins =
                new EncounterStateSnapshot.RosterCard(
                        101L,
                        0L,
                        "Goblin Ambusher",
                        "1/4",
                        50,
                        15,
                        "humanoid",
                        "skirmisher",
                        2);
        EncounterStateSnapshot.BuilderPane builder =
                new EncounterStateSnapshot.BuilderPane(
                        "Party: 4 Helden",
                        "Gate Ambush",
                        thresholds,
                        EncounterStateSnapshot.BuilderSettings.defaultSettings(),
                        List.of(),
                        List.of(new SavedEncounterPlanSummary(42L, "Gate Ambush", "2 Kreaturen")),
                        List.of(goblins),
                        false,
                        true,
                        false,
                        false,
                        true,
                        true,
                        null);
        return new EncounterStateSnapshot(
                EncounterStateSnapshot.Mode.BUILDER,
                builder,
                EncounterStateSnapshot.InitiativePane.empty(),
                EncounterStateSnapshot.CombatPane.empty(),
                EncounterStateSnapshot.ResolutionPane.empty(),
                "Gespeichertes Encounter geladen.");
    }

    private static ShellRuntimeContext runtimeContext(EncounterStateModel model) {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(EncounterStateModel.class, model);
        builder.register(EncounterApplicationService.class, noopEncounterApplicationService());
        builder.register(CreaturesApplicationService.class, noopCreaturesApplicationService());
        builder.register(CreatureDetailModel.class, new CreatureDetailModel(
                EncounterStateTabHarness::emptyCreatureDetail,
                listener -> () -> { }));
        return new ShellRuntimeContext(new NoopInspectorSink(), builder.build());
    }

    private static EncounterApplicationService noopEncounterApplicationService() {
        NoopEncounterPublicationRepository repository = new NoopEncounterPublicationRepository();
        PublishEncounterSessionUseCase publishSession = new PublishEncounterSessionUseCase(repository, null);
        PublishEncounterSavedPlansUseCase publishSavedPlans = new PublishEncounterSavedPlansUseCase(repository, null);
        return new EncounterApplicationService(
                new ApplyEncounterStateUseCase(null, publishSession, publishSavedPlans),
                new UpdateEncounterBuilderInputsUseCase(null, publishSession),
                new PublishEncounterPlanBudgetUseCase(repository, null));
    }

    private static CreaturesApplicationService noopCreaturesApplicationService() {
        NoopCreatureCatalogPort lookup = new NoopCreatureCatalogPort();
        NoopCreaturesPublishedStateRepository published = new NoopCreaturesPublishedStateRepository();
        return new CreaturesApplicationService(
                new LoadCreatureFilterOptionsUseCase(lookup, published),
                new SearchCreatureCatalogUseCase(lookup, published),
                new LoadCreatureDetailUseCase(lookup, published),
                new LoadCreatureEncounterCandidatesUseCase(lookup, published));
    }

    private static CreatureDetailResult emptyCreatureDetail() {
        return new CreatureDetailResult(CreatureLookupStatus.NOT_FOUND, null);
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

    private static final class MutableEncounterStateFeed {

        private final List<Consumer<EncounterStateSnapshot>> listeners = new ArrayList<>();
        private EncounterStateSnapshot current = EncounterStateSnapshot.empty("");

        EncounterStateModel model() {
            return new EncounterStateModel(this::current, this::subscribe);
        }

        void publish(EncounterStateSnapshot snapshot) {
            current = snapshot == null ? EncounterStateSnapshot.empty("") : snapshot;
            for (Consumer<EncounterStateSnapshot> listener : List.copyOf(listeners)) {
                listener.accept(current);
            }
        }

        private EncounterStateSnapshot current() {
            return current;
        }

        private Runnable subscribe(Consumer<EncounterStateSnapshot> listener) {
            listeners.add(listener);
            listener.accept(current);
            return () -> listeners.remove(listener);
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

    private static final class NoopEncounterPublicationRepository
            implements EncounterSessionPublishedStateRepository, EncounterPlanPublishedStateRepository {

        @Override
        public void publishCurrentSession(EncounterSessionPublicationData publication) {
            // Harness input is driven by EncounterStateModel readback.
        }

        @Override
        public void publishSavedPlans(SavedEncounterPlansLoadResult result) {
            // Harness input is driven by EncounterStateModel readback.
        }

        @Override
        public void publishPlanBudget(EncounterPlanBudgetLoadResult result) {
            // Harness input is driven by EncounterStateModel readback.
        }
    }

    private static final class NoopCreaturesPublishedStateRepository implements CreaturesPublishedStateRepository {

        @Override
        public void publishFilterOptions(FilterOptionsPublication result) {
            // Creature commands are not exercised by this state-tab harness.
        }

        @Override
        public void publishCatalogPage(CatalogPagePublication result) {
            // Creature commands are not exercised by this state-tab harness.
        }

        @Override
        public void publishCreatureDetail(CreatureDetailPublication result) {
            // Creature commands are not exercised by this state-tab harness.
        }

        @Override
        public void publishEncounterCandidates(EncounterCandidatesPublication result) {
            // Creature commands are not exercised by this state-tab harness.
        }
    }

    private static final class NoopCreatureCatalogPort implements CreatureCatalogPort {

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
            return null;
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) {
            return List.of();
        }
    }
}
