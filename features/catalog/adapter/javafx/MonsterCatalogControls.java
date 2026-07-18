package features.catalog.adapter.javafx;

import features.catalog.application.MonsterCatalogFilterDraft;
import features.catalog.application.MonsterCatalogIntent;
import features.catalog.application.MonsterCatalogState;
import features.catalog.application.CatalogReferenceOption;
import features.creatures.api.CreatureFilterOptions;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.geometry.Side;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

/** Passive typed Monster controls; renders state and emits one filter intent per edit. */
final class MonsterCatalogControls extends VBox {

    private final TextField search = new TextField();
    private final ComboBox<String> crMinimum = new ComboBox<>();
    private final ComboBox<String> crMaximum = new ComboBox<>();
    private final MultiSelect<String> sizes = new MultiSelect<>("Größe", Function.identity());
    private final MultiSelect<String> types = new MultiSelect<>("Typ", Function.identity());
    private final MultiSelect<String> subtypes = new MultiSelect<>("Unterart", Function.identity());
    private final MultiSelect<String> biomes = new MultiSelect<>("Umgebung", Function.identity());
    private final MultiSelect<String> alignments = new MultiSelect<>("Gesinnung", Function.identity());
    private final MultiSelect<CatalogReferenceOption> encounterTables =
            new MultiSelect<>("Tabelle", CatalogReferenceOption::label);
    private final MultiSelect<CatalogReferenceOption> factions =
            new MultiSelect<>("Fraktionen", CatalogReferenceOption::label);
    private final ComboBox<CatalogReferenceOption> location = new ComboBox<>();
    private final FlowPane chips = new FlowPane(4, 2);
    private final Button clear = new Button("Leeren");
    private Consumer<MonsterCatalogIntent> intent = ignored -> { };
    private boolean rendering;

    MonsterCatalogControls() {
        setMaxHeight(Double.MAX_VALUE);
        search.setPromptText("Monster suchen...");
        search.setAccessibleText("Monster suchen");
        HBox.setHgrow(search, Priority.ALWAYS);
        search.textProperty().addListener((ignored, before, after) -> publishFilters());
        configureChallengeRatings();
        List.of(sizes, types, subtypes, biomes, alignments, encounterTables, factions)
                .forEach(picker -> picker.onChanged(this::publishFilters));
        location.setAccessibleText("Location");
        location.setConverter(new StringConverter<>() {
            @Override public String toString(CatalogReferenceOption value) {
                return value == null || value.id() <= 0L
                        ? "(Alle Locations)"
                        : "#" + value.id() + " | " + value.label();
            }
            @Override public CatalogReferenceOption fromString(String value) {
                return null;
            }
        });
        location.valueProperty().addListener((ignored, before, after) -> publishFilters());
        clear.getStyleClass().addAll("compact", "flat");
        clear.setOnAction(ignored -> clearFilters());

        VBox surface = new VBox(6,
                search,
                new FlowPane(4, 4,
                        new Label("CR"), crMinimum, new Label("-"), crMaximum,
                        sizes.button(), types.button(), subtypes.button(), biomes.button(),
                        alignments.button(), encounterTables.button(), clear),
                new FlowPane(4, 4, factions.button(), new Label("Location"), location),
                chips);
        surface.getStyleClass().add("catalog-controls-surface");
        Label title = new Label("FILTER");
        title.getStyleClass().add("catalog-controls-section-title");
        getChildren().setAll(title, surface);
    }

    void onIntent(Consumer<MonsterCatalogIntent> handler) {
        intent = Objects.requireNonNull(handler, "handler");
    }

    void render(MonsterCatalogState state, MonsterCatalogAuxiliaryOptions auxiliary) {
        rendering = true;
        try {
            MonsterCatalogFilterDraft draft = state.filterDraft();
            CreatureFilterOptions options = state.filterOptions();
            search.setText(draft.nameQuery());
            renderChallengeRatings(options.challengeRatings(), draft.challengeRatingMin(), draft.challengeRatingMax());
            sizes.render(options.sizes(), draft.sizes());
            types.render(options.types(), draft.creatureTypes());
            subtypes.render(options.subtypes(), draft.creatureSubtypes());
            biomes.render(options.biomes(), draft.biomes());
            alignments.render(options.alignments(), draft.alignments());
            encounterTables.render(auxiliary.encounterTables(), draft.encounterTableIds(), CatalogReferenceOption::id);
            factions.render(auxiliary.factions(), draft.worldFactionIds(), CatalogReferenceOption::id);
            renderLocations(auxiliary.locations(), draft.worldLocationId());
            renderChips(draft, auxiliary.encounterTables());
        } finally {
            rendering = false;
        }
    }

    private void configureChallengeRatings() {
        crMinimum.setAccessibleText("Minimale Challenge Rating");
        crMaximum.setAccessibleText("Maximale Challenge Rating");
        crMinimum.valueProperty().addListener((ignored, before, after) -> publishFilters());
        crMaximum.valueProperty().addListener((ignored, before, after) -> publishFilters());
    }

    private void renderChallengeRatings(List<String> values, String minimum, String maximum) {
        List<String> choices = new ArrayList<>();
        choices.add("");
        choices.addAll(values);
        crMinimum.getItems().setAll(choices);
        crMaximum.getItems().setAll(choices);
        crMinimum.setValue(choices.contains(minimum) ? minimum : "");
        crMaximum.setValue(choices.contains(maximum) ? maximum : "");
    }

    private void renderLocations(List<CatalogReferenceOption> values, long selectedId) {
        CatalogReferenceOption all = new CatalogReferenceOption(0L, "(Alle Locations)");
        List<CatalogReferenceOption> choices = new ArrayList<>();
        choices.add(all);
        choices.addAll(values);
        CatalogReferenceOption selected = choices.stream()
                .filter(value -> value.id() == selectedId)
                .findFirst()
                .orElseGet(() -> selectedId <= 0L
                        ? all
                        : new CatalogReferenceOption(selectedId, "Location #" + selectedId));
        if (!choices.contains(selected)) {
            choices.add(selected);
        }
        location.getItems().setAll(choices);
        location.setValue(selected);
    }

    private void clearFilters() {
        if (rendering) {
            return;
        }
        intent.accept(new MonsterCatalogIntent.ChangeFilters(MonsterCatalogFilterDraft.empty()));
    }

    private void publishFilters() {
        if (rendering) {
            return;
        }
        long locationId = location.getValue() == null ? 0L : location.getValue().id();
        intent.accept(new MonsterCatalogIntent.ChangeFilters(new MonsterCatalogFilterDraft(
                search.getText(), value(crMinimum), value(crMaximum),
                sizes.selectedValues(), types.selectedValues(), subtypes.selectedValues(),
                biomes.selectedValues(), alignments.selectedValues(),
                encounterTables.selectedKeys(CatalogReferenceOption::id),
                factions.selectedKeys(CatalogReferenceOption::id),
                locationId)));
    }

    private void renderChips(MonsterCatalogFilterDraft draft, List<CatalogReferenceOption> tables) {
        chips.getChildren().clear();
        addChip("Suche: " + draft.nameQuery(), !draft.nameQuery().isBlank(),
                () -> publish(draftWithName(draft, "")));
        for (String type : draft.creatureTypes()) {
            addChip(type, true, () -> publish(without(draft, type, true)));
        }
        for (Long tableId : draft.encounterTableIds()) {
            String label = tables.stream().filter(table -> table.id() == tableId)
                    .map(CatalogReferenceOption::label).findFirst().orElse("Tabelle " + tableId);
            addChip(label, true, () -> publish(withoutTable(draft, tableId)));
        }
    }

    private void addChip(String label, boolean visible, Runnable removeAction) {
        if (!visible) {
            return;
        }
        Button remove = new Button("×");
        remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
        remove.setAccessibleText("Entfernen: " + label);
        remove.setOnAction(ignored -> removeAction.run());
        HBox chip = new HBox(2, new Label(label), remove);
        chip.getStyleClass().add("chip");
        chips.getChildren().add(chip);
    }

    private void publish(MonsterCatalogFilterDraft draft) {
        intent.accept(new MonsterCatalogIntent.ChangeFilters(draft));
    }

    private static MonsterCatalogFilterDraft draftWithName(MonsterCatalogFilterDraft source, String name) {
        return copy(source, name, source.creatureTypes(), source.encounterTableIds());
    }

    private static MonsterCatalogFilterDraft without(
            MonsterCatalogFilterDraft source,
            String type,
            boolean ignored
    ) {
        return copy(source, source.nameQuery(), source.creatureTypes().stream()
                .filter(value -> !value.equals(type)).toList(), source.encounterTableIds());
    }

    private static MonsterCatalogFilterDraft withoutTable(MonsterCatalogFilterDraft source, long tableId) {
        return copy(source, source.nameQuery(), source.creatureTypes(), source.encounterTableIds().stream()
                .filter(value -> value != tableId).toList());
    }

    private static MonsterCatalogFilterDraft copy(
            MonsterCatalogFilterDraft source,
            String name,
            List<String> types,
            List<Long> tables
    ) {
        return new MonsterCatalogFilterDraft(
                name, source.challengeRatingMin(), source.challengeRatingMax(), source.sizes(), types,
                source.creatureSubtypes(), source.biomes(), source.alignments(), tables,
                source.worldFactionIds(), source.worldLocationId());
    }

    private static String value(ComboBox<String> comboBox) {
        return comboBox.getValue() == null ? "" : comboBox.getValue();
    }

    private static final class MultiSelect<T> {
        private final String label;
        private final Function<T, String> labeler;
        private final Button button;
        private final ContextMenu menu = new ContextMenu();
        private final VBox options = new VBox(2);
        private Runnable changed = () -> { };

        MultiSelect(String label, Function<T, String> labeler) {
            this.label = label;
            this.labeler = labeler;
            button = new Button(label + " ▾");
            button.getStyleClass().addAll("compact", "filter-trigger");
            ScrollPane scroll = new ScrollPane(options);
            scroll.setFitToWidth(true);
            VBox dropdown = new VBox(2, scroll);
            dropdown.getStyleClass().add("filter-dropdown");
            menu.getItems().setAll(new CustomMenuItem(dropdown, false));
            button.setOnAction(ignored -> {
                if (menu.isShowing()) {
                    menu.hide();
                } else {
                    menu.show(button, Side.BOTTOM, 0.0, 2.0);
                }
            });
        }

        Button button() {
            return button;
        }

        void onChanged(Runnable handler) {
            changed = handler;
        }

        void render(List<T> values, List<T> selected) {
            render(values, selected, Function.identity());
        }

        <K> void render(List<T> values, List<K> selected, Function<T, K> key) {
            options.getChildren().clear();
            for (T value : values) {
                CheckBox checkBox = new CheckBox(labeler.apply(value));
                checkBox.setUserData(value);
                checkBox.setSelected(selected.contains(key.apply(value)));
                checkBox.setOnAction(ignored -> {
                    updateButton();
                    changed.run();
                });
                options.getChildren().add(checkBox);
            }
            updateButton();
        }

        List<T> selectedValues() {
            return options.getChildren().stream().map(CheckBox.class::cast)
                    .filter(CheckBox::isSelected).map(checkBox -> (T) checkBox.getUserData()).toList();
        }

        <K> List<K> selectedKeys(Function<T, K> key) {
            return selectedValues().stream().map(key).toList();
        }

        private void updateButton() {
            long selected = options.getChildren().stream().map(CheckBox.class::cast)
                    .filter(CheckBox::isSelected).count();
            button.setText(selected == 0L ? label + " ▾" : label + " (" + selected + ") ▾");
        }
    }
}
