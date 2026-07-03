package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Slider;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.stage.Stage;
import javafx.stage.Window;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;

public final class CatalogControlsRawInputHarness {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private final CatalogControlsContentModel model = new CatalogControlsContentModel();
    private final List<CatalogControlsViewInputEvent> events = new ArrayList<>();
    private CatalogControlsView view;

    private CatalogControlsRawInputHarness() {
    }

    public static void main(String[] args) throws Exception {
        CatalogControlsRawInputHarness harness = new CatalogControlsRawInputHarness();
        try {
            runOnFxThread(harness::start);
            runOnFxThread(harness::assertProjectionRenderDoesNotPublishInput);
            runOnFxThread(harness::editSearchField);
            runOnFxThread(harness::assertSearchEditPublishesOneInput);
            runOnFxThread(harness::clearAll);
            runOnFxThread(harness::assertClearAllPublishesOneFinalInput);
            runOnFxThread(harness::selectWorldSources);
            runOnFxThread(harness::assertWorldSourceSelectionPublishesTypedInput);
            runOnFxThread(harness::removeTypeChip);
            runOnFxThread(harness::assertTypeChipRemovePublishesOneFinalInput);
            runOnFxThread(harness::removeEncounterTableChip);
            runOnFxThread(harness::assertEncounterTableChipRemovePublishesOneFinalInput);
            runOnFxThread(harness::toggleDifficultyAutoAndSlide);
            runOnFxThread(harness::assertDifficultyTuningPublishesRawInput);
            shutdownFx();
            System.out.println("Catalog controls raw-input harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private void start() {
        view = new CatalogControlsView();
        view().onViewInputEvent(events::add);
        view().bind(model);
        Stage stage = new Stage();
        stage.setScene(new Scene(view(), 760.0, 420.0));
        stage.show();
        view().applyCss();
        view().layout();
    }

    private void assertProjectionRenderDoesNotPublishInput() {
        applySelectedProjection();
        assertEquals(0, events.size(), "projection render must not publish raw input");
    }

    private void editSearchField() {
        events.clear();
        searchField().setText("lich");
    }

    private void assertSearchEditPublishesOneInput() {
        assertEquals(1, events.size(), "search edit must publish one raw input");
        assertEquals("lich", events.getLast().nameQuery(), "search edit event must carry raw query");
    }

    private void clearAll() {
        events.clear();
        button(view(), "Leeren").fire();
    }

    private void assertClearAllPublishesOneFinalInput() {
        assertEquals(1, events.size(), "clear-all must publish one final raw input");
        CatalogControlsViewInputEvent event = events.getLast();
        assertEquals("", event.nameQuery(), "clear-all must clear search query");
        assertTrue(event.sizes().isEmpty(), "clear-all must clear size filters");
        assertTrue(event.types().isEmpty(), "clear-all must clear type filters");
        assertTrue(event.encounterTableIds().isEmpty(), "clear-all must clear encounter tables");
        assertTrue(event.worldFactionIds().isEmpty(), "clear-all must clear world faction filters");
        assertEquals(0L, event.worldLocationId(), "clear-all must reset world location filter");
    }

    private void selectWorldSources() {
        events.clear();
        button(view(), "Fraktionen ▾").fire();
        popupDescendant(CheckBox.class, "Ashen Circle").fire();
        selectComboItem(comboBoxContaining(view(), "#701 | Old Gate"), "#701 | Old Gate");
    }

    private void assertWorldSourceSelectionPublishesTypedInput() {
        assertTrue(!events.isEmpty(), "world source selection must publish raw input");
        CatalogControlsViewInputEvent event = events.getLast();
        assertEquals(List.of(501L), event.worldFactionIds(), "source selection must publish typed faction ids");
        assertEquals(701L, event.worldLocationId(), "source selection must publish typed location id");
    }

    private void removeTypeChip() {
        applySelectedProjection();
        events.clear();
        buttonByAccessibleText(view(), "Entfernen: Undead").fire();
    }

    private void assertTypeChipRemovePublishesOneFinalInput() {
        assertEquals(1, events.size(), "type chip removal must publish one final raw input");
        CatalogControlsViewInputEvent event = events.getLast();
        assertEquals("aboleth", event.nameQuery(), "type chip removal must preserve search query");
        assertEquals(List.of("Large"), event.sizes(), "type chip removal must preserve unrelated size filter");
        assertTrue(event.types().isEmpty(), "type chip removal must clear only the selected type");
        assertEquals(List.of(42L), event.encounterTableIds(), "type chip removal must preserve encounter table");
        assertEquals(List.of(501L), event.worldFactionIds(), "type chip removal must preserve world factions");
        assertEquals(701L, event.worldLocationId(), "type chip removal must preserve world location");
    }

    private void removeEncounterTableChip() {
        applySelectedProjection();
        events.clear();
        buttonByAccessibleText(view(), "Entfernen: Cavern Table").fire();
    }

    private void assertEncounterTableChipRemovePublishesOneFinalInput() {
        assertEquals(1, events.size(), "encounter-table chip removal must publish one final raw input");
        CatalogControlsViewInputEvent event = events.getLast();
        assertEquals("aboleth", event.nameQuery(), "encounter-table removal must preserve search query");
        assertEquals(List.of("Undead"), event.types(), "encounter-table removal must preserve type filter");
        assertTrue(event.encounterTableIds().isEmpty(), "encounter-table removal must clear only the table");
        assertEquals(List.of(501L), event.worldFactionIds(), "encounter-table removal must preserve world factions");
        assertEquals(701L, event.worldLocationId(), "encounter-table removal must preserve world location");
    }

    private void toggleDifficultyAutoAndSlide() {
        applySelectedProjection();
        events.clear();
        ToggleButton auto = toggleButtonByAccessibleText(view(), "Schwierigkeit automatisch bestimmen");
        Slider slider = sliderByAccessibleText(view(), "Schwierigkeit Wert");
        assertTrue(auto.isSelected(), "difficulty starts in auto mode");
        auto.fire();
        slider.setValue(4.0);
    }

    private void assertDifficultyTuningPublishesRawInput() {
        assertTrue(!events.isEmpty(), "difficulty tuning must publish raw input");
        CatalogControlsViewInputEvent event = events.getLast();
        assertTrue(!event.difficultyAuto(), "difficulty auto toggle must publish visible toggle state");
        assertEquals(4.0, event.difficultyValue(), "difficulty slider must publish visible slider value");
        assertEquals("aboleth", event.nameQuery(), "difficulty tuning must preserve search query");
    }

    private void applySelectedProjection() {
        model.applyControlsDraft(controlsDraft("", List.of(), List.of(), List.of()));
        model.applyCreatureFilterOptions(new CreatureFilterOptionsResult(
                CreatureReadStatus.SUCCESS,
                new CreatureFilterOptions(
                        List.of("Large", "Medium"),
                        List.of("Undead", "Beast"),
                        List.of(),
                        List.of("Cave"),
                        List.of("Chaotic Evil"),
                        List.of("0", "1", "2", "30"))));
        model.applyEncounterTables(new EncounterTableCatalogResult(
                EncounterTableReadStatus.SUCCESS,
                List.of(new EncounterTableSummary(42L, "Cavern Table", null))));
        model.applyWorldPlannerSnapshot(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(),
                List.of(new WorldFactionSummary(501L, "Ashen Circle", "", 0L, List.of(), List.of())),
                List.of(new WorldLocationSummary(701L, "Old Gate", "", List.of(501L), List.of())),
                ""));
        model.applyControlsDraft(controlsDraft(
                "aboleth",
                List.of("Large"),
                List.of("Undead"),
                List.of(42L),
                List.of(501L),
                701L));
        view().applyCss();
        view().layout();
    }

    private static CatalogControlsContentModel.ControlsDraft controlsDraft(
            String searchQuery,
            List<String> sizes,
            List<String> types,
            List<Long> encounterTableIds
    ) {
        return controlsDraft(searchQuery, sizes, types, encounterTableIds, List.of(), 0L);
    }

    private static CatalogControlsContentModel.ControlsDraft controlsDraft(
            String searchQuery,
            List<String> sizes,
            List<String> types,
            List<Long> encounterTableIds,
            List<Long> worldFactionIds,
            long worldLocationId
    ) {
        return new CatalogControlsContentModel.ControlsDraft(
                new CatalogControlsContentModel.LocalFilterState(
                        searchQuery,
                        "",
                        "",
                        sizes,
                        List.of()),
                new CatalogControlsContentModel.ControlsState(
                        types,
                        List.of(),
                        List.of(),
                        encounterTableIds,
                        worldFactionIds,
                        worldLocationId,
                        CatalogControlsContentModel.SliderProjection.defaultDifficulty(),
                        CatalogControlsContentModel.SliderProjection.defaultBalance(),
                        CatalogControlsContentModel.SliderProjection.defaultAmount(),
                        CatalogControlsContentModel.SliderProjection.defaultDiversity()),
                CatalogControlsContentModel.FilterDropdownState.closed(),
                CatalogControlsContentModel.FilterDropdownState.closed(),
                CatalogControlsContentModel.FilterDropdownState.closed(),
                CatalogControlsContentModel.FilterDropdownState.closed(),
                CatalogControlsContentModel.FilterDropdownState.closed(),
                CatalogControlsContentModel.FilterDropdownState.closed());
    }

    private CatalogControlsView view() {
        if (view == null) {
            throw new IllegalStateException("Catalog controls view is not started.");
        }
        return view;
    }

    private TextField searchField() {
        return descendants(view()).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> "Monster suchen...".equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog search field not found."));
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static Button buttonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + accessibleText));
    }

    private static ComboBox<?> comboBoxContaining(Parent parent, String itemText) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(comboBox -> comboBox.getItems().stream().anyMatch(item -> itemText.equals(itemText(comboBox, item))))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ComboBox item not found: " + itemText));
    }

    private static void selectComboItem(ComboBox<?> comboBox, String itemText) {
        for (Object item : comboBox.getItems()) {
            if (itemText.equals(itemText(comboBox, item))) {
                selectComboItemRaw(comboBox, item);
                return;
            }
        }
        throw new AssertionError("ComboBox item not found: " + itemText);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void selectComboItemRaw(ComboBox comboBox, Object item) {
        comboBox.getSelectionModel().select(item);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static String itemText(ComboBox comboBox, Object item) {
        return comboBox.getConverter() == null ? String.valueOf(item) : comboBox.getConverter().toString(item);
    }

    private static <T extends Node> T popupDescendant(Class<T> type, String text) {
        for (Window window : Window.getWindows()) {
            Scene scene = window.getScene();
            if (scene == null || scene.getRoot() == null) {
                continue;
            }
            for (Node node : descendants(scene.getRoot())) {
                if (type.isInstance(node) && textValue(node).contains(text)) {
                    return type.cast(node);
                }
            }
        }
        throw new AssertionError("Popup descendant not found: " + text);
    }

    private static String textValue(Node node) {
        if (node instanceof Button button) {
            return button.getText();
        }
        if (node instanceof CheckBox checkBox) {
            return checkBox.getText();
        }
        return "";
    }

    private static ToggleButton toggleButtonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Toggle button not found: " + accessibleText));
    }

    private static Slider sliderByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Slider.class::isInstance)
                .map(Slider.class::cast)
                .filter(slider -> accessibleText.equals(slider.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Slider not found: " + accessibleText));
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static List<Node> descendants(Node node) {
        ArrayList<Node> nodes = new ArrayList<>();
        collect(node, nodes);
        return List.copyOf(nodes);
    }

    private static void collect(Node node, List<Node> nodes) {
        nodes.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, nodes);
            }
        }
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            Platform.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Catalog controls harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Catalog controls raw-input harness failed.", failure[0]);
        }
    }

    private static void shutdownFx() throws Exception {
        if (!FX_STARTED.get()) {
            return;
        }
        runOnFxThread(() -> {
            for (Window window : List.copyOf(Window.getWindows())) {
                window.hide();
            }
            Platform.exit();
        });
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
