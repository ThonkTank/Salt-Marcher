package features.catalog.adapter.javafx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.catalog.application.CatalogSectionId;
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
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.Labeled;
import javafx.scene.control.Slider;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.control.TextInputControl;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.HBox;
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
    void productionFilterEditRunsOneSearchAndOnePoolWriteWithoutTuningMutationOrEcho() throws Exception {
        runOnFx(() -> {
            CapturingCreatureCatalogPort creatures = new CapturingCreatureCatalogPort();
            CatalogTestRuntime runtime = runtime(creatures);
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS);
            Stage stage = show(controls, slot(binding, ShellSlot.COCKPIT_MAIN));
            int searchesBefore = creatures.searches.get();
            EncounterTuningSettings tuningBefore = runtime.builderInputs().current().tuning();

            textField(controls).setText("lich");
            textField(controls).fireEvent(new javafx.event.ActionEvent());

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
            Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS);
            Stage stage = show(controls, slot(binding, ShellSlot.COCKPIT_MAIN));
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
    void productionCatalogUsesOneCompactVisualGrammarForAllSevenSections() throws Exception {
        runOnFx(() -> {
            CatalogTestRuntime runtime = runtime(new CapturingCreatureCatalogPort());
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS);
            Parent content = slot(binding, ShellSlot.COCKPIT_MAIN);
            Stage stage = show(controls, content);

            assertEquals(7, descendants(controls).stream().filter(ToggleButton.class::isInstance).count());
            for (CatalogSectionId section : CatalogSectionId.values()) {
                sectionButton(controls, section).fire();
                controls.applyCss();
                controls.layout();
                content.applyCss();
                content.layout();

                assertEquals(1, descendants(content).stream().filter(TableView.class::isInstance).count(),
                        section + " must use the one result renderer");
                List<Control> compact = descendants(controls).stream()
                        .filter(Control.class::isInstance)
                        .map(Control.class::cast)
                        .filter(control -> control.getStyleClass().contains("catalog-filter-control"))
                        .toList();
                assertTrue(!compact.isEmpty(), section + " exposes no shared compact controls");
                for (Control control : compact) {
                    assertEquals(28.0, control.getMinHeight(), 0.01);
                    assertEquals(28.0, control.getPrefHeight(), 0.01);
                    assertEquals(28.0, control.getMaxHeight(), 0.01);
                    if (control instanceof Labeled labeled) {
                        assertEquals(12.0, labeled.getFont().getSize(), 0.01);
                    } else if (control instanceof TextInputControl input) {
                        assertEquals(12.0, input.getFont().getSize(), 0.01);
                    }
                }
            }
            assertTrue(descendants(controls).stream().noneMatch(Slider.class::isInstance),
                    "Encounter tuning must stay outside Catalog controls");
            assertTrue(descendants(controls).stream().filter(Label.class::isInstance)
                    .map(Label.class::cast).map(Label::getText)
                    .noneMatch(text -> "FILTER".equals(text) || "AKTIONEN".equals(text)),
                    "redundant Catalog group headings must not return");
            stage.close();
        });
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

    private static Stage show(Parent controls, Parent content) {
        Stage stage = new Stage();
        HBox root = new HBox(controls, content);
        Scene scene = new Scene(root, 900, 650);
        scene.getStylesheets().add(CatalogControlsRawInputTest.class
                .getResource("/salt-marcher.css").toExternalForm());
        stage.setScene(scene);
        stage.show();
        root.applyCss();
        root.layout();
        return stage;
    }

    private static Parent slot(ShellBinding binding, ShellSlot slot) {
        return (Parent) binding.slotContent().get(slot);
    }

    private static TextField textField(Parent root) {
        return descendants(root).stream().filter(TextField.class::isInstance).map(TextField.class::cast)
                .filter(field -> "Monster suchen".equals(field.getAccessibleText())).findFirst().orElseThrow();
    }

    private static ToggleButton sectionButton(Parent root, CatalogSectionId section) {
        return descendants(root).stream().filter(ToggleButton.class::isInstance).map(ToggleButton.class::cast)
                .filter(button -> ("Katalogbereich " + section.label()).equals(button.getAccessibleText()))
                .findFirst().orElseThrow();
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
        @Override public CreatureCatalogData.CreatureProfile loadCreatureDetail(long creatureId) { return null; }
        @Override public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) { return List.of(); }
        @Override public List<CreatureCatalogData.EncounterCandidateProfile> loadCreatureFacts(
                CreatureCatalogData.CreatureFactsSpec spec
        ) { return List.of(); }
    }

    private static final class EmptyEncounterTables implements EncounterTableCatalogPort {
        @Override public List<EncounterTableSummaryData> loadSummaries() { return List.of(); }
        @Override public List<EncounterTableCandidateData> loadGenerationCandidates(
                List<Long> selectedTableIds, int maximumXp
        ) { return List.of(); }
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
