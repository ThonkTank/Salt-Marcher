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
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.TextField;

/** Passive typed Monster controls; renders state and emits one filter intent per edit. */
final class MonsterCatalogControls extends CatalogControlsScaffold {

    private final TextField search = CatalogControlKit.search("Monster suchen", "Monster suchen …");
    private final ComboBox<String> crMinimum = CatalogControlKit.select(
            "CR ab", "Minimale Challenge Rating", Function.identity());
    private final ComboBox<String> crMaximum = CatalogControlKit.select(
            "CR bis", "Maximale Challenge Rating", Function.identity());
    private final CatalogMultiSelect<String> sizes;
    private final CatalogMultiSelect<String> types;
    private final CatalogMultiSelect<String> subtypes;
    private final CatalogMultiSelect<String> biomes;
    private final CatalogMultiSelect<String> alignments;
    private final CatalogMultiSelect<CatalogReferenceOption> encounterTables;
    private final CatalogMultiSelect<CatalogReferenceOption> factions;
    private final ComboBox<CatalogReferenceOption> location = CatalogControlKit.select(
            "Ort", "Ort auswählen", MonsterCatalogControls::locationLabel);
    private final Button clear = CatalogControlKit.clear("Monster-Suche und Filter leeren");
    private final Consumer<MonsterCatalogIntent> intent;
    private boolean rendering;

    MonsterCatalogControls(Consumer<MonsterCatalogIntent> intent) {
        super();
        this.intent = Objects.requireNonNull(intent, "intent");
        sizes = new CatalogMultiSelect<>("Größe", Function.identity(), this::publishFilters);
        types = new CatalogMultiSelect<>("Typ", Function.identity(), this::publishFilters);
        subtypes = new CatalogMultiSelect<>("Unterart", Function.identity(), this::publishFilters);
        biomes = new CatalogMultiSelect<>("Umgebung", Function.identity(), this::publishFilters);
        alignments = new CatalogMultiSelect<>("Gesinnung", Function.identity(), this::publishFilters);
        encounterTables = new CatalogMultiSelect<>(
                "Tabelle", CatalogReferenceOption::label, this::publishFilters);
        factions = new CatalogMultiSelect<>(
                "Fraktionen", CatalogReferenceOption::label, this::publishFilters);
        search.textProperty().addListener((ignored, before, after) -> publishFilters());
        configureChallengeRatings();
        location.valueProperty().addListener((ignored, before, after) -> publishFilters());
        clear.setOnAction(ignored -> clearFilters());
        setSearch(search);
        setFilters(
                crMinimum, crMaximum,
                sizes.button(), types.button(), subtypes.button(), biomes.button(),
                alignments.button(), encounterTables.button(), factions.button(),
                location, clear);
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
        CatalogReferenceOption all = new CatalogReferenceOption(0L, "Alle");
        List<CatalogReferenceOption> choices = new ArrayList<>();
        choices.add(all);
        choices.addAll(values);
        CatalogReferenceOption selected = choices.stream()
                .filter(value -> value.id() == selectedId)
                .findFirst()
                .orElseGet(() -> selectedId <= 0L
                        ? all
                        : new CatalogReferenceOption(selectedId, "Ort #" + selectedId));
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
            String label = optionLabel(auxiliary.locations(), draft.worldLocationId(), "Ort");
            rendered.add(chip("Ort: " + label, () -> editFilters(() -> location.getItems().stream()
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

    private static String locationLabel(CatalogReferenceOption value) {
        if (value == null || value.id() <= 0L) {
            return "Alle";
        }
        return "#" + value.id() + " | " + value.label();
    }
}
