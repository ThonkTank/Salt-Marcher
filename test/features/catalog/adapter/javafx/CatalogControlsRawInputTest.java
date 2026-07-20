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
import javafx.scene.control.Button;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.Labeled;
import javafx.scene.control.Slider;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.control.TextInputControl;
import javafx.scene.control.ToggleButton;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
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
            Parent controls = slot(binding, ShellSlot.COCKPIT_MAIN);
            Stage stage = show(controls);
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
            Parent controls = slot(binding, ShellSlot.COCKPIT_MAIN);
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
    void productionCatalogUsesOneCompactVisualGrammarForAllSevenSections() throws Exception {
        runOnFx(() -> {
            CatalogTestRuntime runtime = runtime(new CapturingCreatureCatalogPort());
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            Parent controls = slot(binding, ShellSlot.COCKPIT_MAIN);
            Parent content = controls;
            Stage stage = show(content);

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

    @Test
    void catalogWorkspaceFitsAcceptanceSizesWithoutControlsSlotAndKeepsFooterPolished() throws Exception {
        runOnFx(() -> {
            CatalogTestRuntime runtime = runtime(new CapturingCreatureCatalogPort());
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            assertTrue(!binding.slotContent().containsKey(ShellSlot.COCKPIT_CONTROLS),
                    "Catalog must not reserve an empty COCKPIT_CONTROLS column");
            Parent workspace = slot(binding, ShellSlot.COCKPIT_MAIN);
            Stage stage = new Stage();
            Scene scene = new Scene(workspace, 900, 650);
            scene.getStylesheets().add(CatalogControlsRawInputTest.class
                    .getResource("/salt-marcher.css").toExternalForm());
            stage.setScene(scene);
            stage.show();

            for (double[] size : List.of(new double[]{900, 650}, new double[]{1_150, 700})) {
                stage.setWidth(size[0]);
                stage.setHeight(size[1]);
                workspace.applyCss();
                workspace.layout();
                Node top = workspace.lookup(".catalog-workspace-top");
                Node table = workspace.lookup(".catalog-results-table");
                Node footer = workspace.lookup(".catalog-results-footer");
                assertTrue(top != null && table != null && footer != null, "workspace regions are incomplete");
                assertTrue(top.getBoundsInParent().getHeight() < 220,
                        "Catalog controls are not content-sized at " + size[0] + "x" + size[1]);
                assertTrue(table.getBoundsInParent().getHeight() > 250,
                        "Catalog table lost the center workspace at " + size[0] + "x" + size[1]);
                assertTrue(footer.getBoundsInParent().getMinY() >= table.getBoundsInParent().getMaxY() - 1,
                        "Catalog footer is not below the shared table");
            }

            assertTrue(button(workspace, "Filter zurücksetzen").isDisabled());
            assertTrue(button(workspace, "Erstellen").isManaged());
            assertTrue(descendants(workspace).stream().filter(Button.class::isInstance).map(Button.class::cast)
                    .noneMatch(candidate -> "Monster im Inspector öffnen".equals(candidate.getAccessibleText())),
                    "redundant selected-row Details button returned");
            assertTrue(!picker(workspace, "World-Ort").isManaged(),
                    "All-only picker must not reserve layout space");
            Node pager = workspace.lookup(".catalog-main-pagination");
            assertTrue(pager != null && !pager.isManaged(), "single-page pager must stay hidden");

            for (CatalogSectionId section : CatalogSectionId.values()) {
                sectionButton(workspace, section).fire();
                workspace.applyCss();
                workspace.layout();
                assertTrue(descendants(workspace).stream().filter(Button.class::isInstance)
                                .map(Button.class::cast).anyMatch(candidate -> "Erstellen".equals(candidate.getText())),
                        section + " must expose the unified Erstellen action");
            }
            stage.close();
        });
    }

    @Test
    void pickerKeyboardIndividualChipsAndAtomicResetFollowTheAcceptedFlow() throws Exception {
        runOnFx(() -> {
            CapturingCreatureCatalogPort creatures = new CapturingCreatureCatalogPort();
            CatalogTestRuntime runtime = runtime(creatures);
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            Parent workspace = slot(binding, ShellSlot.COCKPIT_MAIN);
            Stage stage = show(workspace);

            CatalogPicker<?> type = picker(workspace, "Monster-Typ");
            type.fireEvent(typed("u"));
            type.fireEvent(typed("n"));
            assertEquals("Undead", type.optionList().getSelectionModel().getSelectedItem().label());
            type.optionList().fireEvent(pressed(KeyCode.ENTER));
            assertEquals("Typ: Undead", type.getText());
            assertTrue(!type.isShowing());
            assertTrue(buttonByAccessible(workspace, "Undead entfernen").isManaged());

            type.fireEvent(typed("d"));
            type.fireEvent(typed("r"));
            type.optionList().fireEvent(pressed(KeyCode.BACK_SPACE));
            assertEquals("Dragon", type.optionList().getSelectionModel().getSelectedItem().label());
            type.optionList().fireEvent(pressed(KeyCode.ESCAPE));
            assertEquals("Typ: Undead", type.getText());

            type.fireEvent(typed("z"));
            type.fireEvent(typed("z"));
            assertTrue(type.optionList().getSelectionModel().getSelectedItem() == null,
                    "unmatched keyboard input must not retain a stale highlighted option");
            type.optionList().fireEvent(pressed(KeyCode.ENTER));
            assertEquals("Typ: Undead", type.getText());
            assertTrue(buttonByAccessible(workspace, "Undead entfernen").isManaged(),
                    "unmatched keyboard input must not replace the committed filter");

            CatalogPicker<?> minimumCr = picker(workspace, "Challenge Rating Minimum");
            assertEquals("CR ab", minimumCr.getText());
            selectPicker(minimumCr, "1/4");
            assertEquals("CR ab: 1/4", minimumCr.getText());

            CatalogPicker<?> size = picker(workspace, "Monster-Größe");
            selectPicker(size, "Huge");
            selectPicker(size, "Tiny");
            assertTrue(buttonByAccessible(workspace, "Huge entfernen").isManaged());
            assertTrue(buttonByAccessible(workspace, "Tiny entfernen").isManaged());
            buttonByAccessible(workspace, "Huge entfernen").fire();
            assertEquals(List.of("Tiny"), runtime.builderInputs().current().poolFilters().sizes());

            int searchesBeforeReset = creatures.searches.get();
            button(workspace, "Filter zurücksetzen").fire();
            assertEquals(searchesBeforeReset + 1, creatures.searches.get(),
                    "atomic reset must issue exactly one immediate browse request");
            assertEquals(EncounterPoolFilters.empty(), runtime.builderInputs().current().poolFilters());
            assertTrue(button(workspace, "Filter zurücksetzen").isDisabled());
            stage.close();
        });
    }

    @Test
    void subtypePickerKeepsInstalledDataSizedOptionSetsVirtualized() throws Exception {
        runOnFx(() -> {
            List<String> subtypes = java.util.stream.IntStream.range(0, 2_526)
                    .mapToObj(index -> "Subtype " + index)
                    .toList();
            CatalogTestRuntime runtime = runtime(new CapturingCreatureCatalogPort(subtypes));
            ShellBinding binding = runtime.contribution(EmptyInspector.INSTANCE).bind();
            binding.onActivate();
            Parent workspace = slot(binding, ShellSlot.COCKPIT_MAIN);
            Stage stage = show(workspace);

            CatalogPicker<?> subtype = picker(workspace, "Monster-Unterart");
            subtype.show();
            subtype.optionList().applyCss();
            subtype.optionList().layout();

            assertEquals(2_526, subtype.optionList().getItems().size());
            int materializedCells = subtype.optionList().lookupAll(".list-cell").size();
            assertTrue(materializedCells > 0 && materializedCells < 100,
                    "virtualized picker materialized " + materializedCells + " cells for 2526 options");
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

    private static Stage show(Parent content) {
        Stage stage = new Stage();
        Scene scene = new Scene(content, 900, 650);
        scene.getStylesheets().add(CatalogControlsRawInputTest.class
                .getResource("/salt-marcher.css").toExternalForm());
        stage.setScene(scene);
        stage.show();
        content.applyCss();
        content.layout();
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

    private static CatalogPicker<?> picker(Parent root, String accessibleText) {
        return descendants(root).stream().filter(CatalogPicker.class::isInstance).map(CatalogPicker.class::cast)
                .filter(candidate -> accessibleText.equals(candidate.getAccessibleText()))
                .findFirst().orElseThrow(() -> new AssertionError("Picker not found: " + accessibleText));
    }

    private static Button button(Parent root, String text) {
        return descendants(root).stream().filter(Button.class::isInstance).map(Button.class::cast)
                .filter(candidate -> text.equals(candidate.getText())).findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static Button buttonByAccessible(Parent root, String accessibleText) {
        return descendants(root).stream().filter(Button.class::isInstance).map(Button.class::cast)
                .filter(candidate -> accessibleText.equals(candidate.getAccessibleText())).findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + accessibleText));
    }

    private static void selectPicker(CatalogPicker<?> picker, String label) {
        picker.show();
        for (int index = 0; index < picker.optionList().getItems().size(); index++) {
            if (label.equals(picker.optionList().getItems().get(index).label())) {
                picker.optionList().getSelectionModel().select(index);
                picker.optionList().fireEvent(pressed(KeyCode.ENTER));
                return;
            }
        }
        throw new AssertionError("Picker option not found: " + label);
    }

    private static KeyEvent typed(String text) {
        return new KeyEvent(KeyEvent.KEY_TYPED, text, text, KeyCode.UNDEFINED,
                false, false, false, false);
    }

    private static KeyEvent pressed(KeyCode code) {
        return new KeyEvent(KeyEvent.KEY_PRESSED, "", "", code,
                false, false, false, false);
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
        private final List<String> subtypes;

        private CapturingCreatureCatalogPort() {
            this(List.of());
        }

        private CapturingCreatureCatalogPort(List<String> subtypes) {
            this.subtypes = List.copyOf(subtypes);
        }

        @Override public CreatureCatalogData.DistinctFilterValues loadFilterValues() {
            return new CreatureCatalogData.DistinctFilterValues(
                    List.of("Huge", "Tiny"), List.of("Dragon", "Undead"), subtypes, List.of(), List.of());
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
