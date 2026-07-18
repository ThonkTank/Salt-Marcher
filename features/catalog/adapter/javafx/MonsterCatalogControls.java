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
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

/** Passive typed Monster controls; renders state and emits one filter intent per edit. */
final class MonsterCatalogControls extends CatalogControlsScaffold {

    private final TextField search = new TextField();
    private final ComboBox<String> crMinimum = new ComboBox<>();
    private final ComboBox<String> crMaximum = new ComboBox<>();
    private final MultiSelect<String> sizes;
    private final MultiSelect<String> types;
    private final MultiSelect<String> subtypes;
    private final MultiSelect<String> biomes;
    private final MultiSelect<String> alignments;
    private final MultiSelect<CatalogReferenceOption> encounterTables;
    private final MultiSelect<CatalogReferenceOption> factions;
    private final ComboBox<CatalogReferenceOption> location = new ComboBox<>();
    private final Button clear = new Button("Leeren");
    private final Consumer<MonsterCatalogIntent> intent;
    private boolean rendering;

    MonsterCatalogControls(Consumer<MonsterCatalogIntent> intent) {
        super("FILTER");
        this.intent = Objects.requireNonNull(intent, "intent");
        sizes = new MultiSelect<>("Größe", Function.identity(), this::publishFilters);
        types = new MultiSelect<>("Typ", Function.identity(), this::publishFilters);
        subtypes = new MultiSelect<>("Unterart", Function.identity(), this::publishFilters);
        biomes = new MultiSelect<>("Umgebung", Function.identity(), this::publishFilters);
        alignments = new MultiSelect<>("Gesinnung", Function.identity(), this::publishFilters);
        encounterTables = new MultiSelect<>("Tabelle", CatalogReferenceOption::label, this::publishFilters);
        factions = new MultiSelect<>("Fraktionen", CatalogReferenceOption::label, this::publishFilters);
        search.setPromptText("Monster suchen...");
        search.setAccessibleText("Monster suchen");
        search.textProperty().addListener((ignored, before, after) -> publishFilters());
        configureChallengeRatings();
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
        setSearch(search);
        setFilters(
                rangeField("CR", crMinimum, crMaximum),
                sizes.button(), types.button(), subtypes.button(), biomes.button(),
                alignments.button(), encounterTables.button(), factions.button(),
                field("Location", location), clear);
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
            renderChips(draft, auxiliary);
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

    private void renderChips(MonsterCatalogFilterDraft draft, MonsterCatalogAuxiliaryOptions auxiliary) {
        List<Node> rendered = new ArrayList<>();
        addChip(rendered, "Suche: " + draft.nameQuery(), !draft.nameQuery().isBlank(),
                () -> editFilters(() -> search.setText("")));
        addChip(rendered, rangeLabel("CR", draft.challengeRatingMin(), draft.challengeRatingMax()),
                !draft.challengeRatingMin().isBlank() || !draft.challengeRatingMax().isBlank(),
                () -> editFilters(() -> {
                    crMinimum.setValue("");
                    crMaximum.setValue("");
                }));
        addValues(rendered, "Größe", draft.sizes(),
                value -> editFilters(() -> sizes.deselectValue(value)));
        addValues(rendered, "Typ", draft.creatureTypes(),
                value -> editFilters(() -> types.deselectValue(value)));
        addValues(rendered, "Unterart", draft.creatureSubtypes(),
                value -> editFilters(() -> subtypes.deselectValue(value)));
        addValues(rendered, "Umgebung", draft.biomes(),
                value -> editFilters(() -> biomes.deselectValue(value)));
        addValues(rendered, "Gesinnung", draft.alignments(),
                value -> editFilters(() -> alignments.deselectValue(value)));
        for (Long tableId : draft.encounterTableIds()) {
            String label = optionLabel(auxiliary.encounterTables(), tableId, "Tabelle");
            rendered.add(chip("Tabelle: " + label,
                    () -> editFilters(() -> encounterTables.deselectKey(tableId, CatalogReferenceOption::id))));
        }
        for (Long factionId : draft.worldFactionIds()) {
            String label = optionLabel(auxiliary.factions(), factionId, "Fraktion");
            rendered.add(chip("Fraktion: " + label,
                    () -> editFilters(() -> factions.deselectKey(factionId, CatalogReferenceOption::id))));
        }
        if (draft.worldLocationId() > 0L) {
            String label = optionLabel(auxiliary.locations(), draft.worldLocationId(), "Location");
            rendered.add(chip("Location: " + label, () -> editFilters(() -> location.getItems().stream()
                    .filter(option -> option.id() == 0L).findFirst().ifPresent(location::setValue))));
        }
        setChips(rendered);
    }

    private void editFilters(Runnable edit) {
        rendering = true;
        try {
            edit.run();
        } finally {
            rendering = false;
        }
        publishFilters();
    }

    private static void addChip(List<Node> target, String label, boolean visible, Runnable removeAction) {
        if (visible) {
            target.add(chip(label, removeAction));
        }
    }

    private static void addValues(
            List<Node> target,
            String prefix,
            List<String> values,
            Consumer<String> remove
    ) {
        values.forEach(value -> target.add(chip(prefix + ": " + value, () -> remove.accept(value))));
    }

    private static String rangeLabel(String prefix, String minimum, String maximum) {
        return prefix + ": " + (minimum.isBlank() ? "…" : minimum) + "–" + (maximum.isBlank() ? "…" : maximum);
    }

    private static String optionLabel(List<CatalogReferenceOption> options, long id, String fallback) {
        return options.stream().filter(option -> option.id() == id).map(CatalogReferenceOption::label)
                .findFirst().orElse(fallback + " " + id);
    }

    private static String value(ComboBox<String> comboBox) {
        return comboBox.getValue() == null ? "" : comboBox.getValue();
    }

    private static final class MultiSelect<T> {
        private final String label;
        private final Function<T, String> labeler;
        private final Button button;
        private final ContextMenu menu = new ContextMenu();
        private final VBox options = new VBox();
        private final Runnable changed;

        MultiSelect(String label, Function<T, String> labeler, Runnable changed) {
            this.label = label;
            this.labeler = labeler;
            this.changed = Objects.requireNonNull(changed, "changed");
            options.getStyleClass().add("catalog-filter-dropdown-options");
            button = new Button(label + " ▾");
            button.getStyleClass().addAll("compact", "filter-trigger");
            ScrollPane scroll = new ScrollPane(options);
            scroll.setFitToWidth(true);
            VBox dropdown = new VBox(scroll);
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

        void deselectValue(T value) {
            deselectKey(value, Function.identity());
        }

        <K> void deselectKey(K value, Function<T, K> key) {
            options.getChildren().stream().map(CheckBox.class::cast)
                    .filter(checkBox -> Objects.equals(value, key.apply((T) checkBox.getUserData())))
                    .findFirst().ifPresent(checkBox -> checkBox.setSelected(false));
            updateButton();
        }

        private void updateButton() {
            long selected = options.getChildren().stream().map(CheckBox.class::cast)
                    .filter(CheckBox::isSelected).count();
            button.setText(selected == 0L ? label + " ▾" : label + " (" + selected + ") ▾");
        }
    }

}
