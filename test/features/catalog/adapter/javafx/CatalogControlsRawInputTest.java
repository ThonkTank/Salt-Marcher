package features.catalog.adapter.javafx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.catalog.application.CatalogResultState;
import features.catalog.application.CatalogSectionId;
import features.catalog.application.MonsterCatalogFilterDraft;
import features.catalog.application.MonsterCatalogIntent;
import features.catalog.application.MonsterCatalogSort;
import features.catalog.application.MonsterCatalogState;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.EncounterTuningSettings;
import features.encountertable.domain.catalog.EncounterTableCandidateData;
import features.encountertable.domain.catalog.EncounterTableSummaryData;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Slider;
import javafx.scene.control.Button;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.layout.Pane;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

@org.junit.jupiter.api.Tag("ui")
public final class CatalogControlsRawInputTest {

    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterEach
    void hideWindows() throws Exception {
        runOnFx(CatalogControlsRawInputTest::hideOpenWindows);
    }

    @AfterAll
    static void shutdownFx() throws Exception {
        if (FX_STARTED.get()) {
            runOnFx(testsupport.JavaFxRuntime::shutdown);
        }
    }

    @Test
    void passiveRenderPublishesNoIntentAndOneEditPublishesOneTypedIntent() throws Exception {
        runOnFx(() -> {
            List<MonsterCatalogIntent> intents = new ArrayList<>();
            MonsterCatalogControls controls = new MonsterCatalogControls(intents::add);
            controls.render(state("aboleth"), MonsterCatalogAuxiliaryOptions.empty());
            assertTrue(intents.isEmpty(), "render must not publish an input intent");

            textField(controls).setText("lich");
            assertEquals(1, intents.size(), "one text edit must publish one intent");
            MonsterCatalogIntent.ChangeFilters change =
                    assertInstanceOf(MonsterCatalogIntent.ChangeFilters.class, intents.getFirst());
            assertEquals("lich", change.filters().nameQuery());
            assertTrue(descendants(controls).stream().noneMatch(Slider.class::isInstance),
                    "Encounter tuning must stay outside Catalog controls");
        });
    }

    @Test
    void oneSharedFilterChipRemovalPublishesOneTypedIntent() throws Exception {
        runOnFx(() -> {
            List<MonsterCatalogIntent> intents = new ArrayList<>();
            MonsterCatalogControls controls = new MonsterCatalogControls(intents::add);
            controls.render(state("aboleth"), MonsterCatalogAuxiliaryOptions.empty());

            buttonAccessible(controls, "Entfernen: Suche: aboleth").fire();

            assertEquals(1, intents.size());
            MonsterCatalogIntent.ChangeFilters change =
                    assertInstanceOf(MonsterCatalogIntent.ChangeFilters.class, intents.getFirst());
            assertEquals("", change.filters().nameQuery());
        });
    }

    @Test
    void workspaceRenderPublishesNoSelectionAndOneUserTogglePublishesOneSelection() throws Exception {
        runOnFx(() -> {
            List<CatalogSectionId> selections = new ArrayList<>();
            CatalogSection monsters = section(CatalogSectionId.MONSTERS);
            CatalogSection items = section(CatalogSectionId.ITEMS);
            CatalogControlsHost controls = new CatalogControlsHost(List.of(monsters, items), selections::add);

            controls.show(monsters);
            assertTrue(selections.isEmpty(), "application render must not publish a section selection");

            descendants(controls).stream()
                    .filter(javafx.scene.control.ToggleButton.class::isInstance)
                    .map(javafx.scene.control.ToggleButton.class::cast)
                    .filter(button -> "Katalogbereich Items".equals(button.getAccessibleText()))
                    .findFirst()
                    .orElseThrow()
                    .fire();

            assertEquals(List.of(CatalogSectionId.ITEMS), selections,
                    "one user toggle must publish exactly one semantic section selection");
        });
    }

    @Test
    void productionFilterEditRunsOneSearchAndOnePoolWriteWithoutTuningMutationOrEcho() throws Exception {
        runOnFx(() -> {
            CapturingCreatureCatalogPort creatures = new CapturingCreatureCatalogPort();
            CatalogTestRuntime runtime = runtime(creatures);
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
            Stage stage = show(controls);
            int searchesBefore = creatures.searches.get();
            EncounterTuningSettings tuningBefore = runtime.builderInputs().current().tuning();

            textField(controls).setText("lich");

            assertEquals(searchesBefore + 1, creatures.searches.get());
            assertEquals("lich", runtime.builderInputs().current().poolFilters().nameQuery());
            assertEquals(tuningBefore, runtime.builderInputs().current().tuning());
            assertEquals(searchesBefore + 1, creatures.searches.get(), "readback echo must not search again");
            stage.close();
        });
    }

    @Test
    void externalPoolReadbackReconcilesOnceWithoutWritingBackOrChangingTuning() throws Exception {
        runOnFx(() -> {
            CapturingCreatureCatalogPort creatures = new CapturingCreatureCatalogPort();
            CatalogTestRuntime runtime = runtime(creatures);
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
            Stage stage = show(controls);
            int searchesBefore = creatures.searches.get();
            EncounterTuningSettings tuningBefore = runtime.builderInputs().current().tuning();

            runtime.updatePoolFilters(new EncounterPoolFilters(
                    "external", "", "", List.of(), List.of("Undead"), List.of(), List.of(), List.of(),
                    List.of(), List.of(), 0L));

            assertEquals(searchesBefore + 1, creatures.searches.get());
            assertEquals("external", textField(controls).getText());
            assertEquals(tuningBefore, runtime.builderInputs().current().tuning());
            stage.close();
        });
    }

    @Test
    void scaffoldRoutesEnterDoubleClickAndExplicitEncounterSceneActions() throws Exception {
        runOnFx(() -> {
            List<MonsterCatalogIntent> intents = new ArrayList<>();
            MonsterCatalogSection section = new MonsterCatalogSection(intents::add);
            CreatureCatalogRow row = new CreatureCatalogRow(
                    41L, "Owlbear", "Large", "Monstrosity", "", "3", 700, 59, 13);
            section.render(new MonsterCatalogState(
                    1L, 1L, 1L, MonsterCatalogState.Lifecycle.ACTIVE,
                    MonsterCatalogFilterDraft.empty(), CreatureFilterOptions.empty(), MonsterCatalogSort.NAME_ASC,
                    50, 0, 1, 41L, CatalogResultState.ready(List.of(row))));
            Parent content = (Parent) section.content();
            Stage stage = show(content);
            TableView<?> table = descendants(content).stream().filter(TableView.class::isInstance)
                    .map(TableView.class::cast).findFirst().orElseThrow();
            table.getSelectionModel().selectFirst();

            table.fireEvent(new KeyEvent(
                    KeyEvent.KEY_PRESSED, "", "", KeyCode.ENTER,
                    false, false, false, false));
            table.fireEvent(new MouseEvent(
                    MouseEvent.MOUSE_CLICKED, 0, 0, 0, 0, MouseButton.PRIMARY, 2,
                    false, false, false, false, true, false, false, true, false, false, null));
            button(content, "+ Encounter").fire();
            button(content, "+ Scene").fire();

            assertEquals(2L, intents.stream().filter(MonsterCatalogIntent.OpenCreature.class::isInstance).count());
            assertEquals(1L, intents.stream().filter(MonsterCatalogIntent.AddToEncounter.class::isInstance).count());
            assertEquals(1L, intents.stream().filter(MonsterCatalogIntent.AddToScene.class::isInstance).count());
            stage.close();
        });
    }

    @Test
    void scaffoldDeselectionEmitsOneSemanticClearSelectionIntent() throws Exception {
        runOnFx(() -> {
            List<MonsterCatalogIntent> intents = new ArrayList<>();
            MonsterCatalogSection section = new MonsterCatalogSection(intents::add);
            CreatureCatalogRow row = creature(41L, "Owlbear");
            section.render(monsterState(41L, List.of(row)));
            Parent content = (Parent) section.content();
            Stage stage = show(content);
            TableView<?> table = descendants(content).stream().filter(TableView.class::isInstance)
                    .map(TableView.class::cast).findFirst().orElseThrow();
            assertTrue(intents.isEmpty(), "rendered selection must not echo an intent");

            table.getSelectionModel().clearSelection();

            assertEquals(List.of(new MonsterCatalogIntent.SelectCreature(0L)), intents,
                    "one explicit deselection must emit the existing clear-selection intent exactly once");
            stage.close();
        });
    }

    @Test
    void rowButtonsEmitOnlyTheirNamedIntentAndLeaveSelectionUnchanged() throws Exception {
        runOnFx(() -> {
            List<MonsterCatalogIntent> intents = new ArrayList<>();
            MonsterCatalogSection section = new MonsterCatalogSection(intents::add);
            CreatureCatalogRow selected = creature(41L, "Owlbear");
            CreatureCatalogRow actedOn = creature(42L, "Troll");
            section.render(monsterState(41L, List.of(selected, actedOn)));
            Parent content = (Parent) section.content();
            Stage stage = show(content);
            TableView<?> table = descendants(content).stream().filter(TableView.class::isInstance)
                    .map(TableView.class::cast).findFirst().orElseThrow();

            buttonAccessible(content, "Öffnen: Troll").fire();
            assertEquals(List.of(new MonsterCatalogIntent.OpenCreature(42L)), intents);
            assertEquals(selected, table.getSelectionModel().getSelectedItem());

            intents.clear();
            buttonAccessible(content, "+ Encounter: Troll").fire();
            assertEquals(List.of(new MonsterCatalogIntent.AddToEncounter(42L)), intents);
            assertEquals(selected, table.getSelectionModel().getSelectedItem());
            stage.close();
        });
    }

    private static CreatureCatalogRow creature(long id, String name) {
        return new CreatureCatalogRow(id, name, "Large", "Monstrosity", "", "3", 700, 59, 13);
    }

    private static MonsterCatalogState monsterState(long selectedId, List<CreatureCatalogRow> rows) {
        return new MonsterCatalogState(
                1L, 1L, 1L, MonsterCatalogState.Lifecycle.ACTIVE,
                MonsterCatalogFilterDraft.empty(), CreatureFilterOptions.empty(), MonsterCatalogSort.NAME_ASC,
                50, 0, rows.size(), selectedId, CatalogResultState.ready(rows));
    }

    private static MonsterCatalogState state(String name) {
        return new MonsterCatalogState(
                1L, 1L, 1L, MonsterCatalogState.Lifecycle.ACTIVE,
                new MonsterCatalogFilterDraft(
                        name, "", "", List.of(), List.of(), List.of(), List.of(), List.of(),
                        List.of(), List.of(), 0L),
                new CreatureFilterOptions(
                        List.of("Medium"), List.of("Undead"), List.of(), List.of(), List.of(), List.of("1")),
                MonsterCatalogSort.NAME_ASC, 50, 0, 0, 0L, CatalogResultState.ready(List.of()));
    }

    private static CatalogSection section(CatalogSectionId id) {
        CatalogControlsScaffold controls = new CatalogControlsScaffold();
        Pane content = new Pane();
        return new CatalogSection() {
            @Override public CatalogSectionId id() { return id; }
            @Override public CatalogControlsScaffold controls() { return controls; }
            @Override public Node content() { return content; }
        };
    }

    private static CatalogTestRuntime runtime(CreatureCatalogPort creatures) {
        return CatalogTestRuntime.create(
                creatures,
                new EmptyEncounterTables(),
                new WorldPlannerSnapshotModel(
                        () -> new WorldPlannerSnapshot(
                                WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), ""),
                        listener -> () -> { },
                        listener -> {
                            listener.accept(new WorldPlannerSnapshot(
                                    WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), ""));
                            return () -> { };
                        }));
    }

    private static Stage show(Parent root) {
        Stage stage = new Stage();
        stage.setScene(new Scene(root, 760, 520));
        stage.show();
        root.applyCss();
        root.layout();
        return stage;
    }

    private static TextField textField(Parent root) {
        return descendants(root).stream().filter(TextField.class::isInstance).map(TextField.class::cast)
                .filter(field -> "Monster suchen …".equals(field.getPromptText())).findFirst().orElseThrow();
    }

    private static Button button(Parent root, String text) {
        return descendants(root).stream().filter(Button.class::isInstance).map(Button.class::cast)
                .filter(button -> text.equals(button.getText())).findFirst().orElseThrow();
    }

    private static Button buttonAccessible(Parent root, String accessibleText) {
        return descendants(root).stream().filter(Button.class::isInstance).map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText())).findFirst().orElseThrow();
    }

    private static List<Node> descendants(Node root) {
        List<Node> result = new ArrayList<>();
        result.add(root);
        if (root instanceof Parent parent) {
            parent.getChildrenUnmodifiable().forEach(child -> result.addAll(descendants(child)));
        }
        return List.copyOf(result);
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrapped = () -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            testsupport.JavaFxRuntime.startup(wrapped);
        } else {
            Platform.runLater(wrapped);
        }
        assertTrue(latch.await(30, TimeUnit.SECONDS));
        if (failure[0] != null) {
            throw new AssertionError(failure[0]);
        }
    }

    private static void hideOpenWindows() {
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
    }

    private static final class CapturingCreatureCatalogPort implements CreatureCatalogPort {
        private final AtomicInteger searches = new AtomicInteger();
        @Override public CreatureCatalogData.DistinctFilterValues loadFilterValues() {
            return new CreatureCatalogData.DistinctFilterValues(
                    List.of(), List.of("Undead"), List.of(), List.of(), List.of());
        }
        @Override public CreatureCatalogData.CatalogPageData searchCatalog(
                CreatureCatalogData.CatalogSearchSpec spec
        ) {
            searches.incrementAndGet();
            return CreatureCatalogData.emptyCatalogPage(spec.pageSize(), spec.pageOffset());
        }
        @Override public CreatureCatalogData.CreatureProfile loadCreatureDetail(long creatureId) {
            return null;
        }
        @Override public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) {
            return List.of();
        }
    }

    private static final class EmptyEncounterTables implements EncounterTableCatalogPort {
        @Override public List<EncounterTableSummaryData> loadSummaries() {
            return List.of();
        }
        @Override public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> ids, int maximumXp) {
            return List.of();
        }
    }

    private enum EmptyInspector implements InspectorSink {
        INSTANCE;
        @Override public void push(InspectorEntrySpec entry) { }
        @Override public void clear() { }
        @Override public boolean isShowing(Object entryKey) { return false; }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
