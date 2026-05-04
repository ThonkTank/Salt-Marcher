package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.animation.PauseTransition;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Slider;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class CatalogControlsView extends VBox {

    private static final int AUTO_LEVEL = -1;
    private static final double AUTO_AMOUNT = -1.0;

    private final TextField searchField = new TextField();
    private final CrRangeSelector crRange = new CrRangeSelector(this::fireFilterChanged);
    private final SearchableFilterButton sizeFilter = new SearchableFilterButton("Größe", this::fireFilterChanged);
    private final SearchableFilterButton typeFilter = new SearchableFilterButton("Typ", this::fireFilterChanged);
    private final SearchableFilterButton subtypeFilter = new SearchableFilterButton("Unterart", this::fireFilterChanged);
    private final SearchableFilterButton biomeFilter = new SearchableFilterButton("Umgebung", this::fireFilterChanged);
    private final SearchableFilterButton alignmentFilter = new SearchableFilterButton("Gesinnung", this::fireFilterChanged);
    private final FlowPane filterRow = new FlowPane(4, 4);
    private final FlowPane chipsPane = new FlowPane(4, 2);
    private final Button encounterTableButton = new Button("Tabelle ▾");
    private final Tooltip encounterTableTooltip =
            new Tooltip("Mehrere Encounter-Tabellen können kombiniert werden.");
    private final AnchoredPopupView encounterTablePopup = new AnchoredPopupView();
    private final VBox encounterTablePopupContent = new VBox(2);
    private final Map<Integer, String> difficultyPreviewLabels = new LinkedHashMap<>(defaultDifficultyPreviewLabels());
    private final Map<Integer, String> balancePreviewLabels = new LinkedHashMap<>(defaultBalancePreviewLabels());
    private final Map<Integer, String> amountPreviewLabels = new LinkedHashMap<>(defaultAmountPreviewLabels());
    private final Map<Integer, String> diversityPreviewLabels = new LinkedHashMap<>(defaultDiversityPreviewLabels());
    private final TuningControl difficultyControl = new TuningControl(
            "Schwierigkeit",
            1.0,
            4.0,
            2.0,
            true,
            "Schwierigkeitsbereich des Encounters",
            new DifficultyTickLabelFormatter(),
            value -> previewLabel(difficultyPreviewLabels, value, difficultyLabel((int) Math.round(value))),
            1.0,
            this::fireEncounterDifficultyChanged);
    private final TuningControl balanceControl = new TuningControl(
            "Balance",
            1.0,
            5.0,
            3.0,
            true,
            "1: CR-Extreme bevorzugen, 5: CR-Durchschnitt bevorzugen",
            new EndpointTickLabelFormatter("Extreme", "Durchschnitt"),
            value -> previewLabel(balancePreviewLabels, value, balanceLabel((int) Math.round(value))),
            null,
            this::fireEncounterTuningChanged);
    private final TuningControl amountControl = new TuningControl(
            "Menge",
            1.0,
            5.0,
            3.0,
            false,
            "1: Bosse bevorzugen, 5: Minions bevorzugen",
            new EndpointTickLabelFormatter("Boss", "Minions"),
            value -> previewLabel(amountPreviewLabels, value, amountLabel(value)),
            1.0,
            this::fireEncounterTuningChanged);
    private final TuningControl diversityControl = new TuningControl(
            "Diversität",
            1.0,
            4.0,
            3.0,
            true,
            "1: ein Statblock, 4: vier unterschiedliche Statblocks",
            new EndpointTickLabelFormatter("1", "4"),
            value -> previewLabel(diversityPreviewLabels, value, diversityLabel((int) Math.round(value))),
            null,
            this::fireEncounterTuningChanged);
    private final PauseTransition debounce = new PauseTransition(Duration.millis(300));

    private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    private List<FilterChipView> activeFilterChips = List.of();
    private List<EncounterTableSelection> encounterTables = List.of();
    private List<Long> selectedEncounterTableIds = List.of();
    private final Map<Long, CheckBox> encounterTableCheckboxes = new LinkedHashMap<>();
    private boolean suppressFilterEvents;

    public CatalogControlsView() {
        setSpacing(0);
        setPadding(new Insets(0));
        difficultyControl.addSliderStyleClass("difficulty-slider");

        searchField.setPromptText("Monster suchen...");
        searchField.setMaxWidth(Double.MAX_VALUE);
        debounce.setOnFinished(event -> fireFilterChanged());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> debounce.playFromStart());

        HBox searchRow = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);

        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(event -> clearFilters());

        encounterTableButton.getStyleClass().addAll("compact", "filter-trigger");
        encounterTableButton.setTooltip(encounterTableTooltip);
        encounterTableButton.setOnAction(event -> toggleEncounterTablePopup());
        encounterTablePopupContent.getStyleClass().add("filter-dropdown");
        encounterTablePopupContent.setPadding(new Insets(8));
        encounterTablePopup.setContent(encounterTablePopupContent);

        filterRow.getChildren().addAll(
                crRange,
                sizeFilter,
                typeFilter,
                subtypeFilter,
                biomeFilter,
                alignmentFilter,
                encounterTableButton,
                clearButton);
        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.setMinHeight(24);

        VBox filterPane = new VBox(4, searchRow, filterRow, chipsPane);
        filterPane.getStyleClass().add("surface-root");
        filterPane.setPadding(new Insets(6, 8, 6, 8));

        VBox filterRegion = new VBox(filterPane);
        filterRegion.setPadding(new Insets(0, 4, 0, 4));

        Label filterHeader = new Label("FILTER");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");

        Label encounterHeader = new Label("ENCOUNTER");
        encounterHeader.getStyleClass().addAll("section-header", "text-muted");

        HBox controlRow = new HBox(8, difficultyControl, balanceControl, amountControl, diversityControl);
        HBox.setHgrow(difficultyControl, Priority.ALWAYS);
        HBox.setHgrow(balanceControl, Priority.ALWAYS);
        HBox.setHgrow(amountControl, Priority.ALWAYS);
        HBox.setHgrow(diversityControl, Priority.ALWAYS);

        VBox sliderGrid = new VBox(4, controlRow);
        sliderGrid.setMaxWidth(Double.MAX_VALUE);
        sliderGrid.setPadding(new Insets(0, 4, 0, 4));

        VBox filterSection = new VBox(0, filterHeader, filterRegion);
        VBox encounterSection = new VBox(0, encounterHeader, sliderGrid);
        getChildren().setAll(filterSection, controlSeparator(), encounterSection);
        setMaxHeight(Double.MAX_VALUE);
        updateEncounterTableControls();
    }

    public void setCreatureFilterData(CreatureFilterData data) {
        CreatureFilterData safeData = data == null ? CreatureFilterData.empty() : data;
        suppressFilterEvents = true;
        try {
            crRange.setValues(safeData.challengeRatings());
            sizeFilter.setOptions(safeData.sizes());
            typeFilter.setOptions(safeData.types());
            subtypeFilter.setOptions(safeData.subtypes());
            biomeFilter.setOptions(safeData.biomes());
            alignmentFilter.setOptions(safeData.alignments());
        } finally {
            suppressFilterEvents = false;
        }
    }

    public void setChips(List<FilterChipView> chips) {
        activeFilterChips = chips == null ? List.of() : List.copyOf(chips);
        renderChips();
    }

    public void setEncounterTables(List<EncounterTableSelection> tables) {
        encounterTables = tables == null ? List.of() : List.copyOf(tables);
        selectedEncounterTableIds = availableEncounterTableIds(selectedEncounterTableIds);
        updateEncounterTableControls();
        renderChips();
    }

    public void selectEncounterTables(List<Long> tableIds) {
        selectedEncounterTableIds = availableEncounterTableIds(tableIds);
        updateEncounterTableControls();
        renderChips();
    }

    public void onViewInputEvent(Consumer<CatalogControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void setEncounterTuningPreview(EncounterTuningPreview preview) {
        EncounterTuningPreview safePreview = preview == null ? EncounterTuningPreview.empty() : preview;
        replacePreviewLabels(difficultyPreviewLabels, safePreview.difficultyLabels(), defaultDifficultyPreviewLabels());
        replacePreviewLabels(balancePreviewLabels, safePreview.balanceLabels(), defaultBalancePreviewLabels());
        replacePreviewLabels(amountPreviewLabels, safePreview.amountLabels(), defaultAmountPreviewLabels());
        replacePreviewLabels(diversityPreviewLabels, safePreview.diversityLabels(), defaultDiversityPreviewLabels());
        difficultyControl.refreshDisplay();
        balanceControl.refreshDisplay();
        amountControl.refreshDisplay();
        diversityControl.refreshDisplay();
    }

    public void applyEncounterBuilderInputs(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            String difficultyKey,
            EncounterTuningSelection tuning,
            List<Long> encounterTableIds
    ) {
        EncounterTuningSelection safeTuning = tuning == null
                ? new EncounterTuningSelection(AUTO_LEVEL, AUTO_AMOUNT, AUTO_LEVEL)
                : tuning;
        suppressFilterEvents = true;
        try {
            typeFilter.setSelectedValues(types);
            subtypeFilter.setSelectedValues(subtypes);
            biomeFilter.setSelectedValues(biomes);
            difficultyControl.setAutoValue(
                    isAutoDifficulty(difficultyKey),
                    difficultySliderValue(difficultyKey));
            balanceControl.setAutoValue(
                    safeTuning.balanceLevel() == AUTO_LEVEL,
                    safeTuning.balanceLevel() == AUTO_LEVEL ? 3.0 : safeTuning.balanceLevel());
            amountControl.setAutoValue(
                    safeTuning.amountValue() == AUTO_AMOUNT,
                    safeTuning.amountValue() == AUTO_AMOUNT ? 3.0 : safeTuning.amountValue());
            diversityControl.setAutoValue(
                    safeTuning.diversityLevel() == AUTO_LEVEL,
                    safeTuning.diversityLevel() == AUTO_LEVEL ? 3.0 : safeTuning.diversityLevel());
            selectedEncounterTableIds = availableEncounterTableIds(encounterTableIds);
            updateEncounterTableControls();
            renderChips();
        } finally {
            suppressFilterEvents = false;
        }
    }

    private void clearFilters() {
        suppressFilterEvents = true;
        try {
            searchField.setText("");
            crRange.reset();
            sizeFilter.clearSelection();
            typeFilter.clearSelection();
            subtypeFilter.clearSelection();
            biomeFilter.clearSelection();
            alignmentFilter.clearSelection();
        } finally {
            suppressFilterEvents = false;
        }
        fireFilterChanged();
    }

    private void renderChips() {
        chipsPane.getChildren().clear();
        List<FilterChipView> allChips = new ArrayList<>(activeFilterChips);
        allChips.addAll(encounterTableChips());
        for (FilterChipView chip : allChips) {
            HBox chipNode = new HBox(2);
            chipNode.getStyleClass().addAll("chip", chip.styleClass());
            Label label = new Label(chip.label());
            Button remove = new Button("×");
            remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
            remove.setAccessibleText("Entfernen: " + chip.label());
            remove.setOnAction(event -> clearChip(chip.key()));
            chipNode.getChildren().addAll(label, remove);
            chipsPane.getChildren().add(chipNode);
        }
    }

    private void clearChip(String key) {
        if ("search".equals(key)) {
            searchField.setText("");
        } else if ("cr".equals(key)) {
            crRange.reset();
        } else if (key.startsWith("size:")) {
            sizeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("type:")) {
            typeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("subtype:")) {
            subtypeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("biome:")) {
            biomeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("alignment:")) {
            alignmentFilter.removeValue(valuePart(key));
        } else if (key.startsWith("encounter-table:")) {
            removeEncounterTableSelection(valuePart(key));
            return;
        }
        fireFilterChanged();
    }

    private void toggleEncounterTablePopup() {
        if (encounterTablePopup.isShowing()) {
            encounterTablePopup.hide();
            return;
        }
        renderEncounterTablePopup();
        encounterTablePopup.showBelow(encounterTableButton);
    }

    private void renderEncounterTablePopup() {
        encounterTablePopupContent.getChildren().clear();
        encounterTableCheckboxes.clear();

        Button clearAll = new Button("(Alle Monster)");
        clearAll.setMaxWidth(Double.MAX_VALUE);
        clearAll.getStyleClass().addAll("flat", "compact");
        clearAll.setOnAction(event -> {
            selectedEncounterTableIds = List.of();
            encounterTablePopup.hide();
            fireEncounterTablesChanged();
            updateEncounterTableControls();
            renderChips();
        });
        encounterTablePopupContent.getChildren().add(clearAll);

        if (encounterTables.isEmpty()) {
            Label empty = new Label("Keine Encounter-Tabellen gefunden");
            empty.getStyleClass().add("text-secondary");
            encounterTablePopupContent.getChildren().add(empty);
            return;
        }
        for (EncounterTableSelection table : encounterTables) {
            CheckBox checkbox = new CheckBox(table.name());
            checkbox.setUserData(table.tableId());
            checkbox.setMaxWidth(Double.MAX_VALUE);
            checkbox.setSelected(selectedEncounterTableIds.contains(table.tableId()));
            checkbox.setOnAction(event -> toggleEncounterTableSelection(table.tableId(), checkbox.isSelected()));
            encounterTableCheckboxes.put(table.tableId(), checkbox);
            encounterTablePopupContent.getChildren().add(checkbox);
        }
    }

    private void toggleEncounterTableSelection(long tableId, boolean selected) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>(selectedEncounterTableIds);
        if (selected) {
            ids.add(tableId);
        } else {
            ids.remove(tableId);
        }
        selectedEncounterTableIds = List.copyOf(ids);
        fireEncounterTablesChanged();
        updateEncounterTableControls();
        renderChips();
    }

    private void removeEncounterTableSelection(String tableIdText) {
        long tableId;
        try {
            tableId = Long.parseLong(tableIdText);
        } catch (NumberFormatException exception) {
            return;
        }
        CheckBox checkbox = encounterTableCheckboxes.get(tableId);
        if (checkbox != null) {
            checkbox.setSelected(false);
        }
        toggleEncounterTableSelection(tableId, false);
    }

    private void fireEncounterTablesChanged() {
        if (suppressFilterEvents) {
            return;
        }
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                false,
                false,
                false,
                true,
                CatalogControlsViewInputEvent.FilterPayload.empty(),
                "",
                CatalogControlsViewInputEvent.EncounterTuning.empty(),
                List.copyOf(selectedEncounterTableIds)));
    }

    private void updateEncounterTableControls() {
        encounterTableButton.getStyleClass().remove("filter-trigger-active");
        boolean lootConflict = hasLinkedLootConflict();
        if (selectedEncounterTableIds.isEmpty()) {
            encounterTableButton.setText("Tabelle ▾");
        } else if (selectedEncounterTableIds.size() == 1) {
            encounterTableButton.setText(selectedEncounterTables().getFirst().name() + " ▾");
            encounterTableButton.getStyleClass().add("filter-trigger-active");
        } else if (lootConflict) {
            encounterTableButton.setText("Tabellen (" + selectedEncounterTableIds.size() + ", Loot-Konflikt) ▾");
            encounterTableButton.getStyleClass().add("filter-trigger-active");
        } else {
            encounterTableButton.setText("Tabellen (" + selectedEncounterTableIds.size() + ") ▾");
            encounterTableButton.getStyleClass().add("filter-trigger-active");
        }
        encounterTableTooltip.setText(lootConflict
                ? "Mehrere ausgewählte Tabellen verweisen auf unterschiedliche Loot-Tabellen. Kampfstart bleibt blockiert, bis höchstens eine verknüpfte Loot-Tabelle aktiv ist."
                : "Mehrere Encounter-Tabellen können kombiniert werden.");
    }

    private List<FilterChipView> encounterTableChips() {
        List<FilterChipView> chips = new ArrayList<>();
        for (EncounterTableSelection table : selectedEncounterTables()) {
            chips.add(new FilterChipView(
                    "encounter-table:" + table.tableId(),
                    table.name(),
                    "chip-table"));
        }
        return chips;
    }

    private List<EncounterTableSelection> selectedEncounterTables() {
        Set<Long> selectedIds = new LinkedHashSet<>(selectedEncounterTableIds);
        return encounterTables.stream()
                .filter(table -> selectedIds.contains(table.tableId()))
                .toList();
    }

    private List<Long> availableEncounterTableIds(List<Long> tableIds) {
        if (tableIds == null || tableIds.isEmpty()) {
            return List.of();
        }
        Set<Long> availableIds = encounterTables.stream()
                .map(EncounterTableSelection::tableId)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        return tableIds.stream()
                .filter(Objects::nonNull)
                .filter(availableIds::contains)
                .distinct()
                .toList();
    }

    private boolean hasLinkedLootConflict() {
        long distinctLinkedLootTables = selectedEncounterTables().stream()
                .map(EncounterTableSelection::linkedLootTableId)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        return distinctLinkedLootTables > 1;
    }

    private void fireFilterChanged() {
        if (suppressFilterEvents) {
            return;
        }
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                true,
                false,
                false,
                false,
                toPublishedFilterState(buildFilterState()),
                "",
                CatalogControlsViewInputEvent.EncounterTuning.empty(),
                List.of()));
    }

    private void fireEncounterDifficultyChanged() {
        if (suppressFilterEvents) {
            return;
        }
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                false,
                true,
                false,
                false,
                CatalogControlsViewInputEvent.FilterPayload.empty(),
                difficultyControl.isAuto() ? "auto" : difficultyKey((int) Math.round(difficultyControl.rawValue())),
                CatalogControlsViewInputEvent.EncounterTuning.empty(),
                List.of()));
    }

    private void fireEncounterTuningChanged() {
        if (suppressFilterEvents) {
            return;
        }
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                false,
                false,
                true,
                false,
                CatalogControlsViewInputEvent.FilterPayload.empty(),
                "",
                new CatalogControlsViewInputEvent.EncounterTuning(
                        balanceControl.isAuto() ? AUTO_LEVEL : (int) Math.round(balanceControl.rawValue()),
                        amountControl.isAuto() ? AUTO_AMOUNT : amountControl.rawValue(),
                        diversityControl.isAuto() ? AUTO_LEVEL : (int) Math.round(diversityControl.rawValue())),
                List.of()));
    }

    private static CatalogControlsViewInputEvent.FilterPayload toPublishedFilterState(CreatureFilterState filterState) {
        CreatureFilterState safeState = filterState == null
                ? new CreatureFilterState("", null, null, List.of(), List.of(), List.of(), List.of(), List.of())
                : filterState;
        return new CatalogControlsViewInputEvent.FilterPayload(
                safe(safeState.nameQuery()),
                safe(safeState.challengeRatingMin()),
                safe(safeState.challengeRatingMax()),
                safeState.sizes(),
                safeState.types(),
                safeState.subtypes(),
                safeState.biomes(),
                safeState.alignments());
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

    private CreatureFilterState buildFilterState() {
        return new CreatureFilterState(
                normalized(searchField.getText()),
                crRange.minimumFilterValue(),
                crRange.maximumFilterValue(),
                sizeFilter.selectedValues(),
                typeFilter.selectedValues(),
                subtypeFilter.selectedValues(),
                biomeFilter.selectedValues(),
                alignmentFilter.selectedValues());
    }

    private static Region controlSeparator() {
        Region separator = new Region();
        separator.getStyleClass().add("control-separator");
        return separator;
    }

    private static String valuePart(String key) {
        int separator = key.indexOf(':');
        return separator < 0 ? key : key.substring(separator + 1);
    }

    private static @Nullable String normalized(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String difficultyKey(int value) {
        return switch (Math.max(1, Math.min(4, value))) {
            case 1 -> "easy";
            case 3 -> "hard";
            case 4 -> "deadly";
            default -> "medium";
        };
    }

    private static boolean isAutoDifficulty(@Nullable String value) {
        return value == null || value.isBlank() || "auto".equalsIgnoreCase(value);
    }

    private static double difficultySliderValue(@Nullable String value) {
        if (value == null) {
            return 2.0;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "easy" -> 1.0;
            case "hard" -> 3.0;
            case "deadly" -> 4.0;
            default -> 2.0;
        };
    }

    private static String difficultyLabel(int value) {
        return switch (Math.max(1, Math.min(4, value))) {
            case 1 -> "Easy";
            case 3 -> "Hard";
            case 4 -> "Deadly";
            default -> "Medium";
        };
    }

    private static String diversityLabel(int value) {
        int rounded = Math.max(1, Math.min(4, value));
        return rounded == 1 ? "1 Typ" : rounded + " Typen";
    }

    private static String amountLabel(double value) {
        int rounded = Math.max(1, Math.min(5, (int) Math.round(value)));
        return switch (rounded) {
            case 1 -> "Boss++";
            case 2 -> "Boss+";
            case 3 -> "Ausgeglichen";
            case 4 -> "Minions+";
            default -> "Minions++";
        };
    }

    private static String balanceLabel(int value) {
        return switch (Math.max(1, Math.min(5, value))) {
            case 1 -> "Extreme++";
            case 2 -> "Extreme+";
            case 3 -> "Neutral";
            case 4 -> "Durchschnitt+";
            default -> "Durchschnitt++";
        };
    }

    private static String previewLabel(Map<Integer, String> labels, double value, String fallback) {
        String label = labels.get((int) Math.round(value));
        return label == null || label.isBlank() ? fallback : label;
    }

    private static void replacePreviewLabels(
            Map<Integer, String> target,
            List<SliderPreviewLabel> labels,
            Map<Integer, String> fallback
    ) {
        target.clear();
        target.putAll(fallback);
        if (labels == null || labels.isEmpty()) {
            return;
        }
        for (SliderPreviewLabel label : labels) {
            if (label == null || label.label().isBlank()) {
                continue;
            }
            target.put((int) Math.round(label.value()), label.label());
        }
    }

    private static Map<Integer, String> defaultDifficultyPreviewLabels() {
        return Map.of(
                1, "25-49 XP",
                2, "50-74 XP",
                3, "75-99 XP",
                4, "100-125 XP");
    }

    private static Map<Integer, String> defaultBalancePreviewLabels() {
        return Map.of(
                1, "Extreme++",
                2, "Extreme+",
                3, "Neutral",
                4, "Durchschnitt+",
                5, "Durchschnitt++");
    }

    private static Map<Integer, String> defaultAmountPreviewLabels() {
        return Map.of(
                1, "Boss++",
                2, "Boss+",
                3, "Ausgeglichen",
                4, "Minions+",
                5, "Minions++");
    }

    private static Map<Integer, String> defaultDiversityPreviewLabels() {
        return Map.of(
                1, "1 Typ",
                2, "2 Typen",
                3, "3 Typen",
                4, "4 Typen");
    }

    public record EncounterTuningSelection(int balanceLevel, double amountValue, int diversityLevel) {
    }

    public record EncounterTableSelection(long tableId, String name, @Nullable Long linkedLootTableId) {
        public EncounterTableSelection {
            name = name == null || name.isBlank() ? "Tabelle " + tableId : name;
        }
    }

    public record CreatureFilterData(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<String> challengeRatings
    ) {
        public CreatureFilterData {
            sizes = copyOf(sizes);
            types = copyOf(types);
            subtypes = copyOf(subtypes);
            biomes = copyOf(biomes);
            alignments = copyOf(alignments);
            challengeRatings = copyOf(challengeRatings);
        }

        @Override
        public List<String> sizes() {
            return copyOf(sizes);
        }

        @Override
        public List<String> types() {
            return copyOf(types);
        }

        @Override
        public List<String> subtypes() {
            return copyOf(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyOf(biomes);
        }

        @Override
        public List<String> alignments() {
            return copyOf(alignments);
        }

        @Override
        public List<String> challengeRatings() {
            return copyOf(challengeRatings);
        }

        static CreatureFilterData empty() {
            return new CreatureFilterData(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record CreatureFilterState(
            @Nullable String nameQuery,
            @Nullable String challengeRatingMin,
            @Nullable String challengeRatingMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        public CreatureFilterState {
            sizes = copyOf(sizes);
            types = copyOf(types);
            subtypes = copyOf(subtypes);
            biomes = copyOf(biomes);
            alignments = copyOf(alignments);
        }

        @Override
        public List<String> sizes() {
            return copyOf(sizes);
        }

        @Override
        public List<String> types() {
            return copyOf(types);
        }

        @Override
        public List<String> subtypes() {
            return copyOf(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyOf(biomes);
        }

        @Override
        public List<String> alignments() {
            return copyOf(alignments);
        }
    }

    public record FilterChipView(String key, String label, String styleClass) {
    }

    public record SliderPreviewLabel(double value, String label) {
        public SliderPreviewLabel {
            label = label == null ? "" : label;
        }
    }

    public record EncounterTuningPreview(
            List<SliderPreviewLabel> difficultyLabels,
            List<SliderPreviewLabel> balanceLabels,
            List<SliderPreviewLabel> amountLabels,
            List<SliderPreviewLabel> diversityLabels
    ) {
        public EncounterTuningPreview {
            difficultyLabels = copyPreviewLabels(difficultyLabels);
            balanceLabels = copyPreviewLabels(balanceLabels);
            amountLabels = copyPreviewLabels(amountLabels);
            diversityLabels = copyPreviewLabels(diversityLabels);
        }

        @Override
        public List<SliderPreviewLabel> difficultyLabels() {
            return copyPreviewLabels(difficultyLabels);
        }

        @Override
        public List<SliderPreviewLabel> balanceLabels() {
            return copyPreviewLabels(balanceLabels);
        }

        @Override
        public List<SliderPreviewLabel> amountLabels() {
            return copyPreviewLabels(amountLabels);
        }

        @Override
        public List<SliderPreviewLabel> diversityLabels() {
            return copyPreviewLabels(diversityLabels);
        }

        static EncounterTuningPreview empty() {
            return new EncounterTuningPreview(List.of(), List.of(), List.of(), List.of());
        }
    }

    private static List<String> copyOf(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static List<SliderPreviewLabel> copyPreviewLabels(List<SliderPreviewLabel> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static final class CrRangeSelector extends HBox {

        private final ComboBox<String> minimum = new ComboBox<>();
        private final ComboBox<String> maximum = new ComboBox<>();
        private final Runnable onChange;
        private boolean updating;

        CrRangeSelector(Runnable onChange) {
            this.onChange = onChange;
            setSpacing(2);
            Label crLabel = new Label("CR");
            crLabel.getStyleClass().addAll("text-muted", "bold");
            crLabel.setMinWidth(20);
            minimum.setAccessibleText("Minimaler CR");
            maximum.setAccessibleText("Maximaler CR");
            minimum.setPrefWidth(65);
            maximum.setPrefWidth(65);
            Label dash = new Label("-");
            dash.getStyleClass().add("text-muted");
            minimum.setOnAction(event -> onSelectionChanged());
            maximum.setOnAction(event -> onSelectionChanged());
            getChildren().addAll(crLabel, minimum, dash, maximum);
        }

        void setValues(List<String> values) {
            List<String> safeValues = values == null || values.isEmpty() ? List.of("0", "30") : List.copyOf(values);
            updating = true;
            try {
                minimum.setItems(FXCollections.observableArrayList(safeValues));
                maximum.setItems(FXCollections.observableArrayList(safeValues));
                minimum.getSelectionModel().selectFirst();
                maximum.getSelectionModel().selectLast();
            } finally {
                updating = false;
            }
        }

        @Nullable String minimumFilterValue() {
            int index = minimum.getSelectionModel().getSelectedIndex();
            return index > 0 ? minimum.getValue() : null;
        }

        @Nullable String maximumFilterValue() {
            int index = maximum.getSelectionModel().getSelectedIndex();
            int last = maximum.getItems().size() - 1;
            return index >= 0 && index < last ? maximum.getValue() : null;
        }

        void reset() {
            updating = true;
            try {
                minimum.getSelectionModel().selectFirst();
                maximum.getSelectionModel().selectLast();
            } finally {
                updating = false;
            }
        }

        private void onSelectionChanged() {
            if (updating) {
                return;
            }
            int minIndex = minimum.getSelectionModel().getSelectedIndex();
            int maxIndex = maximum.getSelectionModel().getSelectedIndex();
            if (minIndex > maxIndex && minIndex >= 0) {
                updating = true;
                try {
                    maximum.getSelectionModel().select(minIndex);
                } finally {
                    updating = false;
                }
            }
            if (onChange != null) {
                onChange.run();
            }
        }
    }

    private static final class SearchableFilterButton extends Button {

        private static final int SEARCH_FIELD_THRESHOLD = 6;

        private final String label;
        private final AnchoredPopupView popup = new AnchoredPopupView();
        private final VBox checkboxList = new VBox(2);
        private final List<CheckBox> checkboxes = new ArrayList<>();
        private final Set<String> selectedValues = new LinkedHashSet<>();
        private final Runnable onChange;
        private boolean updatingSelection;

        SearchableFilterButton(String label, Runnable onChange) {
            this.label = label;
            this.onChange = onChange;
            getStyleClass().addAll("compact", "filter-trigger");
            setText(label + " ▾");
            setAccessibleText(label + " geschlossen");
            setOnAction(event -> togglePopup());
        }

        void setOptions(List<String> options) {
            checkboxes.clear();
            checkboxList.getChildren().clear();
            VBox popupContent = new VBox(4);
            popupContent.getStyleClass().add("filter-dropdown");
            popupContent.setPadding(new Insets(8));
            List<String> safeOptions = options == null ? List.of() : List.copyOf(options);
            selectedValues.retainAll(new LinkedHashSet<>(safeOptions));
            if (safeOptions.size() > SEARCH_FIELD_THRESHOLD) {
                TextField search = new TextField();
                search.setPromptText(label + " suchen...");
                search.getStyleClass().add("text-field");
                search.textProperty().addListener((obs, oldValue, newValue) -> filterCheckboxes(newValue));
                popupContent.getChildren().add(search);
            }
            for (String option : safeOptions) {
                CheckBox checkbox = new CheckBox(option);
                checkbox.setSelected(selectedValues.contains(option));
                checkbox.selectedProperty().addListener((obs, wasSelected, isSelected) ->
                        updateSelection(option, isSelected));
                checkboxes.add(checkbox);
                checkboxList.getChildren().add(checkbox);
            }
            ScrollPane scroll = new ScrollPane(checkboxList);
            scroll.setFitToWidth(true);
            scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            scroll.setMaxHeight(280);
            scroll.setPrefWidth(200);
            scroll.setMinWidth(160);
            popupContent.getChildren().add(scroll);
            popup.setContent(popupContent);
            updateTriggerText();
        }

        List<String> selectedValues() {
            return List.copyOf(selectedValues);
        }

        void removeValue(String value) {
            if (selectedValues.remove(value)) {
                syncCheckboxSelection();
                updateTriggerText();
            }
        }

        void setSelectedValues(List<String> values) {
            selectedValues.clear();
            if (values != null) {
                selectedValues.addAll(values);
            }
            syncCheckboxSelection();
            updateTriggerText();
        }

        void clearSelection() {
            if (!selectedValues.isEmpty()) {
                selectedValues.clear();
                syncCheckboxSelection();
            }
            updateTriggerText();
        }

        private void togglePopup() {
            if (popup.isShowing()) {
                popup.hide();
                setAccessibleText(label + " geschlossen");
                return;
            }
            popup.showBelow(this);
            setAccessibleText(label + " geöffnet - Escape zum Schließen");
        }

        private void filterCheckboxes(@Nullable String query) {
            String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
            for (CheckBox checkbox : checkboxes) {
                boolean visible = normalized.isEmpty()
                        || checkbox.getText().toLowerCase(Locale.ROOT).contains(normalized);
                checkbox.setVisible(visible);
                checkbox.setManaged(visible);
            }
        }

        private void updateSelection(String value, boolean selected) {
            if (updatingSelection) {
                return;
            }
            if (selected) {
                selectedValues.add(value);
            } else {
                selectedValues.remove(value);
            }
            updateTriggerText();
            if (onChange != null) {
                onChange.run();
            }
        }

        private void syncCheckboxSelection() {
            updatingSelection = true;
            try {
                for (CheckBox checkbox : checkboxes) {
                    checkbox.setSelected(selectedValues.contains(checkbox.getText()));
                }
            } finally {
                updatingSelection = false;
            }
        }

        private void updateTriggerText() {
            int count = selectedValues.size();
            getStyleClass().remove("filter-trigger-active");
            if (count > 0) {
                setText(label + " (" + count + ") ▾");
                getStyleClass().add("filter-trigger-active");
            } else {
                setText(label + " ▾");
            }
            if (!popup.isShowing()) {
                setAccessibleText(getText());
            }
        }
    }

    private static final class TuningControl extends HBox {

        private final Slider slider;
        private final Button autoButton;
        private final Label valueLabel;
        private final Function<Double, String> valueLabelFormatter;
        private final Runnable onChange;
        private boolean autoMode = true;

        TuningControl(
                String title,
                double min,
                double max,
                double defaultValue,
                boolean snapToTicks,
                String tooltip,
                StringConverter<Double> labelFormatter,
                Function<Double, String> valueLabelFormatter,
                @Nullable Double majorTickUnitOverride,
                Runnable onChange
        ) {
            setSpacing(4);
            setAlignment(Pos.CENTER_LEFT);
            this.valueLabelFormatter = valueLabelFormatter;
            this.onChange = onChange;

            Label titleLabel = new Label(title);
            titleLabel.getStyleClass().add("text-muted");
            titleLabel.setMinWidth(Region.USE_PREF_SIZE);

            autoButton = new Button("⚅");
            autoButton.getStyleClass().addAll("compact", "auto-dice-btn", "active");
            autoButton.setMinWidth(Region.USE_PREF_SIZE);
            autoButton.setAccessibleText(title + " automatisch bestimmen");

            valueLabel = new Label();
            valueLabel.getStyleClass().add("text-secondary");
            valueLabel.setMinWidth(56);
            valueLabel.setPrefWidth(56);

            slider = new Slider(min, max, defaultValue);
            slider.setShowTickLabels(true);
            slider.setShowTickMarks(true);
            if (snapToTicks) {
                slider.setSnapToTicks(true);
                slider.setMajorTickUnit(1);
                slider.setMinorTickCount(0);
            } else {
                slider.setMajorTickUnit(majorTickUnitOverride != null ? majorTickUnitOverride : (max - min) / 3);
            }
            if (labelFormatter != null) {
                slider.setLabelFormatter(labelFormatter);
            }
            slider.setDisable(true);
            slider.setAccessibleRoleDescription(title);
            slider.setAccessibleText(tooltip);
            HBox.setHgrow(slider, Priority.ALWAYS);

            autoButton.setOnAction(event -> {
                autoMode = !autoMode;
                slider.setDisable(autoMode);
                updateAutoButtonState();
                updateValueLabel();
                fireChanged();
            });
            slider.valueProperty().addListener((obs, oldValue, newValue) -> {
                updateValueLabel();
                fireChanged();
            });
            updateAutoButtonState();
            updateValueLabel();

            getChildren().addAll(titleLabel, autoButton, valueLabel, slider);
        }

        boolean isAuto() {
            return autoMode;
        }

        double rawValue() {
            return slider.getValue();
        }

        void setAutoValue(boolean auto, double value) {
            autoMode = auto;
            slider.setValue(value);
            slider.setDisable(autoMode);
            updateAutoButtonState();
            updateValueLabel();
        }

        void addSliderStyleClass(String styleClass) {
            if (styleClass != null && !styleClass.isBlank() && !slider.getStyleClass().contains(styleClass)) {
                slider.getStyleClass().add(styleClass);
            }
        }

        void refreshDisplay() {
            updateValueLabel();
        }

        private void updateValueLabel() {
            if (autoMode) {
                valueLabel.setText("");
                return;
            }
            valueLabel.setText(valueLabelFormatter == null ? "" : valueLabelFormatter.apply(slider.getValue()));
        }

        private void updateAutoButtonState() {
            autoButton.getStyleClass().remove("active");
            if (autoMode) {
                autoButton.getStyleClass().add("active");
            }
        }

        private void fireChanged() {
            if (onChange != null) {
                onChange.run();
            }
        }
    }

    private static final class DifficultyTickLabelFormatter extends StringConverter<Double> {
        @Override
        public String toString(Double value) {
            return difficultyLabel(value == null ? 2 : (int) Math.round(value));
        }

        @Override
        public Double fromString(String value) {
            return 0.0;
        }
    }

    private static final class EndpointTickLabelFormatter extends StringConverter<Double> {

        private final String minimumLabel;
        private final String maximumLabel;

        EndpointTickLabelFormatter(String minimumLabel, String maximumLabel) {
            this.minimumLabel = minimumLabel;
            this.maximumLabel = maximumLabel;
        }

        @Override
        public String toString(Double value) {
            if (value == null) {
                return "";
            }
            if (value <= 1.0) {
                return minimumLabel;
            }
            if (value >= 4.0 && "4".equals(maximumLabel)) {
                return maximumLabel;
            }
            if (value >= 5.0) {
                return maximumLabel;
            }
            return "";
        }

        @Override
        public Double fromString(String value) {
            return 0.0;
        }
    }
}
