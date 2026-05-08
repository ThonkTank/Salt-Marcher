package src.view.leftbartabs.catalog;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyLongProperty;
import javafx.beans.property.ReadOnlyLongWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
public final class CatalogContributionModel {

    private static final int PAGE_SIZE = 50;
    private static final double DEFAULT_DIFFICULTY_VALUE = 2.0;
    private static final double DEFAULT_BALANCE_VALUE = 3.0;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final double DEFAULT_DIVERSITY_VALUE = 3.0;
    private static final double MIN_DIFFICULTY_VALUE = 1.0;
    private static final double MAX_DIFFICULTY_VALUE = 4.0;
    private static final double MIN_BALANCE_VALUE = 1.0;
    private static final double MAX_BALANCE_VALUE = 5.0;
    private static final double MIN_AMOUNT_VALUE = 1.0;
    private static final double MAX_AMOUNT_VALUE = 5.0;
    private static final double MIN_DIVERSITY_VALUE = 1.0;
    private static final double MAX_DIVERSITY_VALUE = 4.0;
    private static final String SEARCH_CHIP_KEY = "search";
    private static final String CHALLENGE_RATING_CHIP_KEY = "cr";
    private static final String ENCOUNTER_TABLE_CHIP_PREFIX = "encounter-table:";
    private static final List<KeyLabel> CREATURE_COLUMNS = List.of(
            new KeyLabel("name", "Name"),
            new KeyLabel("cr", "CR"),
            new KeyLabel("type", "Typ"),
            new KeyLabel("size", "Größe"),
            new KeyLabel("xp", "XP"));
    private static final List<KeyLabel> SORT_OPTIONS = List.of(
            SortOption.NAME_ASC.asKeyLabel(),
            SortOption.NAME_DESC.asKeyLabel(),
            SortOption.CR_ASC.asKeyLabel(),
            SortOption.CR_DESC.asKeyLabel(),
            SortOption.XP_ASC.asKeyLabel(),
            SortOption.XP_DESC.asKeyLabel());
    private static final List<PreviewLabel> DEFAULT_DIFFICULTY_LABELS = List.of(
            new PreviewLabel(1.0, "25-49 XP"),
            new PreviewLabel(2.0, "50-74 XP"),
            new PreviewLabel(3.0, "75-99 XP"),
            new PreviewLabel(4.0, "100-125 XP"));
    private static final List<PreviewLabel> DEFAULT_BALANCE_LABELS = List.of(
            new PreviewLabel(1.0, "Extreme++"),
            new PreviewLabel(2.0, "Extreme+"),
            new PreviewLabel(3.0, "Neutral"),
            new PreviewLabel(4.0, "Durchschnitt+"),
            new PreviewLabel(5.0, "Durchschnitt++"));
    private static final List<PreviewLabel> DEFAULT_AMOUNT_LABELS = List.of(
            new PreviewLabel(1.0, "Boss++"),
            new PreviewLabel(2.0, "Boss+"),
            new PreviewLabel(3.0, "Ausgeglichen"),
            new PreviewLabel(4.0, "Minions+"),
            new PreviewLabel(5.0, "Minions++"));
    private static final List<PreviewLabel> DEFAULT_DIVERSITY_LABELS = List.of(
            new PreviewLabel(1.0, "1 Typ"),
            new PreviewLabel(2.0, "2 Typen"),
            new PreviewLabel(3.0, "3 Typen"),
            new PreviewLabel(4.0, "4 Typen"));

    private final ReadOnlyObjectWrapper<MainProjection> mainProjection =
            new ReadOnlyObjectWrapper<>(MainProjection.initial());
    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final ReadOnlyLongWrapper creatureDetailSelection = new ReadOnlyLongWrapper(0L);
    private final ProjectionState state = new ProjectionState();

    public CatalogContributionModel() {
        refreshControlsProjection();
        refreshMainProjection();
    }

    ReadOnlyObjectProperty<MainProjection> mainProjectionProperty() {
        return mainProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ControlsProjection> controlsProjectionProperty() {
        return controlsProjection.getReadOnlyProperty();
    }

    ReadOnlyLongProperty creatureDetailSelectionProperty() {
        return creatureDetailSelection.getReadOnlyProperty();
    }

    void applyControlsDraft(ControlsDraft draft) {
        state.applyControlsDraft(draft);
        refreshControlsProjection();
    }

    void applyCreatureFilterOptions(CreatureFilterOptionsResult result) {
        state.applyCreatureFilterOptions(result);
        refreshControlsProjection();
    }

    boolean applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        boolean searchChanged = state.applyEncounterBuilderInputs(builderInputs);
        refreshControlsProjection();
        return searchChanged;
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        state.applyEncounterTables(result);
        refreshControlsProjection();
    }

    void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
        state.applyEncounterTuningPreview(labels);
        refreshControlsProjection();
    }

    void selectSort(String sortKey) {
        state.selectSort(sortKey);
        refreshMainProjection();
    }

    void shiftPage(int pageShift) {
        state.shiftPage(pageShift);
        refreshMainProjection();
    }

    void applySearchResult(CreatureCatalogPageResult result) {
        state.applySearchResult(result);
        refreshMainProjection();
    }

    void beginSearch() {
        state.beginSearch();
        refreshMainProjection();
    }

    void setCreatureDetailSelection(long creatureId) {
        creatureDetailSelection.set(Math.max(0L, creatureId));
    }

    InteractionState currentInteractionState() {
        return state.interactionState();
    }

    CatalogPublishedEvent searchEvent() {
        return state.searchEvent();
    }

    private void refreshControlsProjection() {
        controlsProjection.set(state.controlsProjection());
    }

    private void refreshMainProjection() {
        mainProjection.set(state.mainProjection());
    }

    private static CreatureFilters mergedFilters(LocalFilterState local, ControlsState controls) {
        LocalFilterState safeLocal = local == null ? LocalFilterState.empty() : local;
        ControlsState safeControls = controls == null ? ControlsState.empty() : controls;
        return new CreatureFilters(
                safeLocal.nameQuery(),
                safeLocal.challengeRatingMin(),
                safeLocal.challengeRatingMax(),
                safeLocal.sizes(),
                safeControls.creatureTypes(),
                safeControls.creatureSubtypes(),
                safeControls.biomes(),
                safeLocal.alignments());
    }

    private static String defaultCrMinimum(String value) {
        return value == null || value.isBlank() ? "0" : value;
    }

    private static String defaultCrMaximum(String value) {
        return value == null || value.isBlank() ? "30" : value;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String formatInteger(long value) {
        return NumberFormat.getIntegerInstance(Locale.US).format(value);
    }

    private static <T> List<T> copiedList(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static <T> List<T> retainAvailable(List<T> selectedValues, List<T> availableValues) {
        if (selectedValues == null || selectedValues.isEmpty()) {
            return List.of();
        }
        List<T> safeAvailable = availableValues == null ? List.of() : List.copyOf(availableValues);
        return selectedValues.stream()
                .filter(safeAvailable::contains)
                .distinct()
                .toList();
    }

    enum SortOption {
        NAME_ASC("name-asc", "Name (A-Z)", CreatureCatalogSortField.NAME, CreatureSortDirection.ASCENDING),
        NAME_DESC("name-desc", "Name (Z-A)", CreatureCatalogSortField.NAME, CreatureSortDirection.DESCENDING),
        CR_ASC("cr-asc", "CR (aufst.)", CreatureCatalogSortField.CHALLENGE_RATING, CreatureSortDirection.ASCENDING),
        CR_DESC("cr-desc", "CR (abst.)", CreatureCatalogSortField.CHALLENGE_RATING, CreatureSortDirection.DESCENDING),
        XP_ASC("xp-asc", "XP (aufst.)", CreatureCatalogSortField.XP, CreatureSortDirection.ASCENDING),
        XP_DESC("xp-desc", "XP (abst.)", CreatureCatalogSortField.XP, CreatureSortDirection.DESCENDING);

        private final String key;
        private final String label;
        private final CreatureCatalogSortField field;
        private final CreatureSortDirection direction;

        SortOption(String key, String label, CreatureCatalogSortField field, CreatureSortDirection direction) {
            this.key = key;
            this.label = label;
            this.field = field;
            this.direction = direction;
        }

        String key() {
            return key;
        }

        CreatureCatalogSortField field() {
            return field;
        }

        CreatureSortDirection direction() {
            return direction;
        }

        KeyLabel asKeyLabel() {
            return new KeyLabel(key, label);
        }

        static SortOption fromKey(String key) {
            for (SortOption option : values()) {
                if (option.key.equals(key)) {
                    return option;
                }
            }
            return NAME_ASC;
        }
    }

    record MainProjection(
            List<KeyLabel> sortOptions,
            List<KeyLabel> columns,
            List<CatalogRow> rows,
            String selectedSortKey,
            String countLabel,
            String pageLabel,
            String placeholderText,
            boolean previousPageAvailable,
            boolean nextPageAvailable
    ) {
        MainProjection {
            sortOptions = copiedList(sortOptions);
            columns = copiedList(columns);
            rows = copiedList(rows);
            selectedSortKey = safe(selectedSortKey);
            countLabel = safe(countLabel);
            pageLabel = safe(pageLabel);
            placeholderText = safe(placeholderText);
        }

        static MainProjection initial() {
            return from(List.of(), SortOption.NAME_ASC, 0, 0, "Lade Monster...");
        }

        static MainProjection from(
                List<CatalogRow> rows,
                SortOption selectedSort,
                int pageOffset,
                int totalCount,
                String placeholderText
        ) {
            int currentPage = totalCount == 0 ? 1 : (pageOffset / PAGE_SIZE) + 1;
            int totalPages = totalCount == 0 ? 1 : (int) Math.ceil((double) totalCount / PAGE_SIZE);
            return new MainProjection(
                    SORT_OPTIONS,
                    CREATURE_COLUMNS,
                    rows,
                    selectedSort == null ? SortOption.NAME_ASC.key() : selectedSort.key(),
                    Math.max(0, totalCount) + " Monster gefunden",
                    "Seite " + currentPage + " / " + totalPages,
                    placeholderText,
                    pageOffset > 0,
                    pageOffset + PAGE_SIZE < totalCount);
        }
    }

    record ControlsProjection(
            FilterOptionsProjection filterOptions,
            CreatureFilters creatureFilters,
            FilterDropdownState sizeDropdownState,
            FilterDropdownState typeDropdownState,
            FilterDropdownState subtypeDropdownState,
            FilterDropdownState biomeDropdownState,
            FilterDropdownState alignmentDropdownState,
            FilterDropdownState encounterTableDropdownState,
            List<EncounterTableOption> encounterTableOptions,
            List<FilterChip> chips,
            ControlsState controlsState
    ) {
        ControlsProjection {
            filterOptions = filterOptions == null ? FilterOptionsProjection.empty() : filterOptions;
            creatureFilters = creatureFilters == null ? CreatureFilters.empty() : creatureFilters;
            sizeDropdownState = sizeDropdownState == null ? FilterDropdownState.closed() : sizeDropdownState;
            typeDropdownState = typeDropdownState == null ? FilterDropdownState.closed() : typeDropdownState;
            subtypeDropdownState = subtypeDropdownState == null ? FilterDropdownState.closed() : subtypeDropdownState;
            biomeDropdownState = biomeDropdownState == null ? FilterDropdownState.closed() : biomeDropdownState;
            alignmentDropdownState = alignmentDropdownState == null ? FilterDropdownState.closed() : alignmentDropdownState;
            encounterTableDropdownState = encounterTableDropdownState == null
                    ? FilterDropdownState.closed()
                    : encounterTableDropdownState;
            encounterTableOptions = copiedList(encounterTableOptions);
            chips = copiedList(chips);
            controlsState = controlsState == null ? ControlsState.empty() : controlsState;
        }

        static ControlsProjection initial() {
            return new ControlsProjection(
                    FilterOptionsProjection.empty(),
                    CreatureFilters.empty(),
                    FilterDropdownState.closed(),
                    FilterDropdownState.closed(),
                    FilterDropdownState.closed(),
                    FilterDropdownState.closed(),
                    FilterDropdownState.closed(),
                    FilterDropdownState.closed(),
                    List.of(),
                    List.of(),
                    ControlsState.empty());
        }
    }

    record InteractionState(
            LocalFilterState localFilters,
            ControlsState draftControls,
            ControlsState domainControls
    ) {
        InteractionState {
            localFilters = localFilters == null ? LocalFilterState.empty() : localFilters;
            draftControls = draftControls == null ? ControlsState.empty() : draftControls;
            domainControls = domainControls == null ? ControlsState.empty() : domainControls;
        }
    }

    record ControlsDraft(
            LocalFilterState localFilters,
            ControlsState controlsState,
            FilterDropdownState sizeDropdownState,
            FilterDropdownState typeDropdownState,
            FilterDropdownState subtypeDropdownState,
            FilterDropdownState biomeDropdownState,
            FilterDropdownState alignmentDropdownState,
            FilterDropdownState encounterTableDropdownState
    ) {
        ControlsDraft {
            localFilters = localFilters == null ? LocalFilterState.empty() : localFilters;
            controlsState = controlsState == null ? ControlsState.empty() : controlsState;
            sizeDropdownState = sizeDropdownState == null ? FilterDropdownState.closed() : sizeDropdownState;
            typeDropdownState = typeDropdownState == null ? FilterDropdownState.closed() : typeDropdownState;
            subtypeDropdownState = subtypeDropdownState == null ? FilterDropdownState.closed() : subtypeDropdownState;
            biomeDropdownState = biomeDropdownState == null ? FilterDropdownState.closed() : biomeDropdownState;
            alignmentDropdownState = alignmentDropdownState == null ? FilterDropdownState.closed() : alignmentDropdownState;
            encounterTableDropdownState = encounterTableDropdownState == null
                    ? FilterDropdownState.closed()
                    : encounterTableDropdownState;
        }
    }

    record KeyLabel(String key, String label) {
        KeyLabel {
            key = safe(key);
            label = safe(label);
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record CatalogRow(long id, List<String> cells) {
        CatalogRow {
            cells = copiedList(cells);
        }

        String cell(int index) {
            return index >= 0 && index < cells.size() ? cells.get(index) : "";
        }

        static CatalogRow fromCreature(CreatureCatalogRow creature) {
            return new CatalogRow(
                    creature.id(),
                    List.of(
                            safe(creature.name()),
                            safe(creature.challengeRating()),
                            safe(creature.creatureType()),
                            safe(creature.size()),
                            formatInteger(creature.xp())));
        }
    }

    record FilterChip(String key, String label, String styleClass) {
        FilterChip {
            key = safe(key);
            label = safe(label);
            styleClass = safe(styleClass);
        }

        static List<FilterChip> from(
                CreatureFilters creatureFilters,
                List<EncounterTableOption> encounterTableOptions,
                ControlsState controlsState
        ) {
            CreatureFilters safeFilters = creatureFilters == null ? CreatureFilters.empty() : creatureFilters;
            List<FilterChip> chips = new java.util.ArrayList<>();
            if (!safeFilters.nameQuery().isBlank()) {
                chips.add(new FilterChip(SEARCH_CHIP_KEY, "Suche: " + safeFilters.nameQuery(), "chip-type"));
            }
            if (!safeFilters.challengeRatingMin().isBlank() || !safeFilters.challengeRatingMax().isBlank()) {
                chips.add(new FilterChip(
                        CHALLENGE_RATING_CHIP_KEY,
                        "CR: " + defaultCrMinimum(safeFilters.challengeRatingMin())
                                + "-"
                                + defaultCrMaximum(safeFilters.challengeRatingMax()),
                        "chip-cr"));
            }
            add(chips, "size", safeFilters.sizes(), "chip-size");
            add(chips, "type", safeFilters.types(), "chip-type");
            add(chips, "subtype", safeFilters.subtypes(), "chip-subtype");
            add(chips, "biome", safeFilters.biomes(), "chip-biome");
            add(chips, "alignment", safeFilters.alignments(), "chip-align");
            for (Long tableId : controlsState == null ? List.<Long>of() : controlsState.encounterTableIds()) {
                if (tableId == null) {
                    continue;
                }
                EncounterTableOption option = encounterTableOption(encounterTableOptions, tableId);
                chips.add(new FilterChip(
                        ENCOUNTER_TABLE_CHIP_PREFIX + tableId,
                        option == null ? "Tabelle " + tableId : option.name(),
                        "chip-table"));
            }
            return List.copyOf(chips);
        }

        private static void add(List<FilterChip> chips, String prefix, List<String> values, String styleClass) {
            for (String value : copiedList(values)) {
                chips.add(new FilterChip(prefix + ":" + value, value, styleClass));
            }
        }

        private static @Nullable EncounterTableOption encounterTableOption(List<EncounterTableOption> options, Long tableId) {
            if (tableId == null) {
                return null;
            }
            for (EncounterTableOption option : copiedList(options)) {
                if (option.tableId() == tableId.longValue()) {
                    return option;
                }
            }
            return null;
        }
    }

    record LocalFilterState(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
            List<String> sizes,
            List<String> alignments
    ) {
        LocalFilterState {
            nameQuery = safe(nameQuery);
            challengeRatingMin = safe(challengeRatingMin);
            challengeRatingMax = safe(challengeRatingMax);
            sizes = copiedList(sizes);
            alignments = copiedList(alignments);
        }

        static LocalFilterState empty() {
            return new LocalFilterState("", "", "", List.of(), List.of());
        }

        LocalFilterState retainAvailable(FilterOptionsProjection options) {
            FilterOptionsProjection safeOptions = options == null ? FilterOptionsProjection.empty() : options;
            return new LocalFilterState(
                    nameQuery,
                    challengeRatingMin,
                    challengeRatingMax,
                    CatalogContributionModel.retainAvailable(sizes, safeOptions.sizes()),
                    CatalogContributionModel.retainAvailable(alignments, safeOptions.alignments()));
        }
    }

    record CreatureFilters(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        CreatureFilters {
            nameQuery = safe(nameQuery);
            challengeRatingMin = safe(challengeRatingMin);
            challengeRatingMax = safe(challengeRatingMax);
            sizes = copiedList(sizes);
            types = copiedList(types);
            subtypes = copiedList(subtypes);
            biomes = copiedList(biomes);
            alignments = copiedList(alignments);
        }

        static CreatureFilters empty() {
            return new CreatureFilters("", "", "", List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    record FilterOptionsProjection(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<String> challengeRatings
    ) {
        FilterOptionsProjection {
            sizes = copiedList(sizes);
            types = copiedList(types);
            subtypes = copiedList(subtypes);
            biomes = copiedList(biomes);
            alignments = copiedList(alignments);
            challengeRatings = copiedList(challengeRatings);
        }

        static FilterOptionsProjection empty() {
            return new FilterOptionsProjection(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    record SliderProjection(boolean auto, double value, List<PreviewLabel> labels) {
        SliderProjection {
            value = Double.isFinite(value) ? value : 0.0;
            labels = copiedList(labels);
        }

        static SliderProjection defaultDifficulty() {
            return new SliderProjection(true, DEFAULT_DIFFICULTY_VALUE, DEFAULT_DIFFICULTY_LABELS);
        }

        static SliderProjection defaultBalance() {
            return new SliderProjection(true, DEFAULT_BALANCE_VALUE, DEFAULT_BALANCE_LABELS);
        }

        static SliderProjection defaultAmount() {
            return new SliderProjection(true, DEFAULT_AMOUNT_VALUE, DEFAULT_AMOUNT_LABELS);
        }

        static SliderProjection defaultDiversity() {
            return new SliderProjection(true, DEFAULT_DIVERSITY_VALUE, DEFAULT_DIVERSITY_LABELS);
        }

        static SliderProjection draftDifficulty(boolean auto, double value, SliderProjection current) {
            return create(
                    auto,
                    clamp(value, MIN_DIFFICULTY_VALUE, MAX_DIFFICULTY_VALUE, DEFAULT_DIFFICULTY_VALUE),
                    current == null ? DEFAULT_DIFFICULTY_LABELS : current.labels(),
                    DEFAULT_DIFFICULTY_VALUE,
                    DEFAULT_DIFFICULTY_LABELS);
        }

        static SliderProjection draftBalance(boolean auto, double value, SliderProjection current) {
            return create(
                    auto,
                    clamp(value, MIN_BALANCE_VALUE, MAX_BALANCE_VALUE, DEFAULT_BALANCE_VALUE),
                    current == null ? DEFAULT_BALANCE_LABELS : current.labels(),
                    DEFAULT_BALANCE_VALUE,
                    DEFAULT_BALANCE_LABELS);
        }

        static SliderProjection draftAmount(boolean auto, double value, SliderProjection current) {
            return create(
                    auto,
                    clamp(value, MIN_AMOUNT_VALUE, MAX_AMOUNT_VALUE, DEFAULT_AMOUNT_VALUE),
                    current == null ? DEFAULT_AMOUNT_LABELS : current.labels(),
                    DEFAULT_AMOUNT_VALUE,
                    DEFAULT_AMOUNT_LABELS);
        }

        static SliderProjection draftDiversity(boolean auto, double value, SliderProjection current) {
            return create(
                    auto,
                    clamp(value, MIN_DIVERSITY_VALUE, MAX_DIVERSITY_VALUE, DEFAULT_DIVERSITY_VALUE),
                    current == null ? DEFAULT_DIVERSITY_LABELS : current.labels(),
                    DEFAULT_DIVERSITY_VALUE,
                    DEFAULT_DIVERSITY_LABELS);
        }

        static SliderProjection difficulty(boolean auto, int difficultyLevel, List<PreviewLabel> labels) {
            double value = switch (difficultyLevel) {
                case 1 -> 1.0;
                case 3 -> 3.0;
                case 4 -> 4.0;
                default -> DEFAULT_DIFFICULTY_VALUE;
            };
            return create(auto, value, labels, DEFAULT_DIFFICULTY_VALUE, DEFAULT_DIFFICULTY_LABELS);
        }

        SliderProjection withPreviewLabels(
                List<EncounterTuningPreviewLabels.PreviewLabel> previewLabels,
                List<PreviewLabel> fallback,
                double defaultValue
        ) {
            List<PreviewLabel> labels = previewLabels == null || previewLabels.isEmpty()
                    ? fallback
                    : previewLabels.stream().map(label -> new PreviewLabel(label.value(), label.label())).toList();
            return create(auto, value, labels, defaultValue, fallback);
        }

        private static SliderProjection create(
                boolean auto,
                double value,
                List<PreviewLabel> labels,
                double defaultValue,
                List<PreviewLabel> fallback
        ) {
            double safeValue = Double.isFinite(value) ? value : defaultValue;
            List<PreviewLabel> safeLabels = labels == null || labels.isEmpty() ? fallback : List.copyOf(labels);
            return new SliderProjection(auto, auto ? defaultValue : safeValue, safeLabels);
        }

        private static double clamp(double value, double min, double max, double fallback) {
            if (!Double.isFinite(value)) {
                return fallback;
            }
            return Math.max(min, Math.min(max, value));
        }
    }

    record ControlsState(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            List<Long> encounterTableIds,
            SliderProjection difficulty,
            SliderProjection balance,
            SliderProjection amount,
            SliderProjection diversity
    ) {
        ControlsState {
            creatureTypes = copiedList(creatureTypes);
            creatureSubtypes = copiedList(creatureSubtypes);
            biomes = copiedList(biomes);
            encounterTableIds = copiedList(encounterTableIds);
            difficulty = difficulty == null ? SliderProjection.defaultDifficulty() : difficulty;
            balance = balance == null ? SliderProjection.defaultBalance() : balance;
            amount = amount == null ? SliderProjection.defaultAmount() : amount;
            diversity = diversity == null ? SliderProjection.defaultDiversity() : diversity;
        }

        static ControlsState empty() {
            return new ControlsState(
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    SliderProjection.defaultDifficulty(),
                    SliderProjection.defaultBalance(),
                    SliderProjection.defaultAmount(),
                    SliderProjection.defaultDiversity());
        }

        static ControlsState fromBuilderInputs(EncounterBuilderInputs builderInputs, ControlsState source) {
            EncounterBuilderInputs safeInputs = builderInputs == null
                    ? EncounterBuilderInputs.empty()
                    : builderInputs;
            ControlsState safeSource = source == null ? empty() : source;
            return new ControlsState(
                    safeInputs.creatureTypes(),
                    safeInputs.creatureSubtypes(),
                    safeInputs.biomes(),
                    safeInputs.encounterTableIds(),
                    SliderProjection.difficulty(
                            safeInputs.autoDifficulty(),
                            safeInputs.difficultyLevel(),
                            safeSource.difficulty().labels()),
                    SliderProjection.create(
                            safeInputs.autoBalance(),
                            safeInputs.autoBalance() ? DEFAULT_BALANCE_VALUE : safeInputs.balanceLevel(),
                            safeSource.balance().labels(),
                            DEFAULT_BALANCE_VALUE,
                            DEFAULT_BALANCE_LABELS),
                    SliderProjection.create(
                            safeInputs.autoAmount(),
                            safeInputs.autoAmount() ? DEFAULT_AMOUNT_VALUE : safeInputs.amountValue(),
                            safeSource.amount().labels(),
                            DEFAULT_AMOUNT_VALUE,
                            DEFAULT_AMOUNT_LABELS),
                    SliderProjection.create(
                            safeInputs.autoDiversity(),
                            safeInputs.autoDiversity() ? DEFAULT_DIVERSITY_VALUE : safeInputs.diversityLevel(),
                            safeSource.diversity().labels(),
                            DEFAULT_DIVERSITY_VALUE,
                            DEFAULT_DIVERSITY_LABELS));
        }

        ControlsState withPreviewLabels(EncounterTuningPreviewLabels labels) {
            EncounterTuningPreviewLabels safeLabels = labels == null
                    ? new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of())
                    : labels;
            return new ControlsState(
                    creatureTypes,
                    creatureSubtypes,
                    biomes,
                    encounterTableIds,
                    difficulty.withPreviewLabels(
                            safeLabels.difficultyLabels(),
                            DEFAULT_DIFFICULTY_LABELS,
                            DEFAULT_DIFFICULTY_VALUE),
                    balance.withPreviewLabels(
                            safeLabels.balanceLabels(),
                            DEFAULT_BALANCE_LABELS,
                            DEFAULT_BALANCE_VALUE),
                    amount.withPreviewLabels(
                            safeLabels.amountLabels(),
                            DEFAULT_AMOUNT_LABELS,
                            DEFAULT_AMOUNT_VALUE),
                    diversity.withPreviewLabels(
                            safeLabels.diversityLabels(),
                            DEFAULT_DIVERSITY_LABELS,
                            DEFAULT_DIVERSITY_VALUE));
        }

        static boolean searchControlsChanged(ControlsState previous, ControlsState next) {
            ControlsState safePrevious = previous == null ? empty() : previous;
            ControlsState safeNext = next == null ? empty() : next;
            return !safePrevious.creatureTypes().equals(safeNext.creatureTypes())
                    || !safePrevious.creatureSubtypes().equals(safeNext.creatureSubtypes())
                    || !safePrevious.biomes().equals(safeNext.biomes());
        }
    }

    record EncounterTableOption(long tableId, String name, @Nullable Long linkedLootTableId) {
        EncounterTableOption {
            name = name == null || name.isBlank() ? "Tabelle " + tableId : name;
        }

        static EncounterTableOption fromSummary(EncounterTableSummary summary) {
            return new EncounterTableOption(summary.tableId(), summary.name(), summary.linkedLootTableId());
        }
    }

    record PreviewLabel(double value, String label) {
        PreviewLabel {
            label = safe(label);
        }
    }

    record FilterDropdownState(boolean open, String searchQuery) {
        FilterDropdownState {
            searchQuery = safe(searchQuery);
        }

        static FilterDropdownState closed() {
            return new FilterDropdownState(false, "");
        }
    }

    @SuppressWarnings({
            "PMD.TooManyMethods",
            "PMD.TooManyFields"
    })
    private static final class ProjectionState {

        private LocalFilterState localFilters = LocalFilterState.empty();
        private ControlsState authoritativeControls = ControlsState.empty();
        private ControlsState controlsState = ControlsState.empty();
        private FilterOptionsProjection filterOptions = FilterOptionsProjection.empty();
        private FilterDropdownState sizeDropdownState = FilterDropdownState.closed();
        private FilterDropdownState typeDropdownState = FilterDropdownState.closed();
        private FilterDropdownState subtypeDropdownState = FilterDropdownState.closed();
        private FilterDropdownState biomeDropdownState = FilterDropdownState.closed();
        private FilterDropdownState alignmentDropdownState = FilterDropdownState.closed();
        private FilterDropdownState encounterTableDropdownState = FilterDropdownState.closed();
        private List<EncounterTableOption> encounterTableOptions = List.of();
        private List<CatalogRow> rows = List.of();
        private SortOption selectedSort = SortOption.NAME_ASC;
        private String placeholderText = "Lade Monster...";
        private int pageOffset;
        private int totalCount;

        void applyControlsDraft(ControlsDraft draft) {
            ControlsDraft safeDraft = draft == null
                    ? new ControlsDraft(
                            LocalFilterState.empty(),
                            ControlsState.empty(),
                            FilterDropdownState.closed(),
                            FilterDropdownState.closed(),
                            FilterDropdownState.closed(),
                            FilterDropdownState.closed(),
                            FilterDropdownState.closed(),
                            FilterDropdownState.closed())
                    : draft;
            localFilters = safeDraft.localFilters();
            controlsState = safeDraft.controlsState();
            sizeDropdownState = safeDraft.sizeDropdownState();
            typeDropdownState = safeDraft.typeDropdownState();
            subtypeDropdownState = safeDraft.subtypeDropdownState();
            biomeDropdownState = safeDraft.biomeDropdownState();
            alignmentDropdownState = safeDraft.alignmentDropdownState();
            encounterTableDropdownState = safeDraft.encounterTableDropdownState();
        }

        void applyCreatureFilterOptions(CreatureFilterOptionsResult result) {
            CreatureFilterOptions options = result == null || result.options() == null
                    ? CreatureFilterOptions.empty()
                    : result.options();
            filterOptions = new FilterOptionsProjection(
                    options.sizes(),
                    options.types(),
                    options.subtypes(),
                    options.biomes(),
                    options.alignments(),
                    options.challengeRatings());
            localFilters = localFilters.retainAvailable(filterOptions);
        }

        boolean applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
            ControlsState previousAuthoritative = authoritativeControls;
            ControlsState next = ControlsState.fromBuilderInputs(builderInputs, previousAuthoritative);
            authoritativeControls = next;
            controlsState = next;
            return ControlsState.searchControlsChanged(previousAuthoritative, next);
        }

        void applyEncounterTables(EncounterTableCatalogResult result) {
            if (result == null || result.status() != EncounterTableReadStatus.SUCCESS) {
                encounterTableOptions = List.of();
                return;
            }
            encounterTableOptions = result.tables().stream()
                    .map(EncounterTableOption::fromSummary)
                    .toList();
        }

        void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
            authoritativeControls = authoritativeControls.withPreviewLabels(labels);
            controlsState = controlsState.withPreviewLabels(labels);
        }

        void selectSort(String sortKey) {
            selectedSort = SortOption.fromKey(sortKey);
            pageOffset = 0;
        }

        void shiftPage(int pageShift) {
            if (pageShift < 0 && pageOffset > 0) {
                pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
            } else if (pageShift > 0 && pageOffset + PAGE_SIZE < totalCount) {
                pageOffset += PAGE_SIZE;
            }
        }

        void applySearchResult(CreatureCatalogPageResult result) {
            CreatureCatalogPage page = result == null ? CreatureCatalogPage.empty(PAGE_SIZE, pageOffset) : result.page();
            if (page == null) {
                page = CreatureCatalogPage.empty(PAGE_SIZE, pageOffset);
            }
            totalCount = Math.max(0, page.totalCount());
            rows = page.rows().stream().map(CatalogRow::fromCreature).toList();
            placeholderText = switch (result == null ? CreatureQueryStatus.STORAGE_ERROR : result.status()) {
                case SUCCESS -> "Keine Monster gefunden";
                case INVALID_QUERY -> "Filter sind ungültig";
                default -> "Fehler beim Laden";
            };
        }

        void beginSearch() {
            placeholderText = "Lade Monster...";
        }

        InteractionState interactionState() {
            return new InteractionState(localFilters, controlsState, authoritativeControls);
        }

        CatalogPublishedEvent searchEvent() {
            CreatureFilters filters = mergedFilters(localFilters, authoritativeControls);
            return CatalogPublishedEvent.search(
                    filters.nameQuery(),
                    filters.challengeRatingMin(),
                    filters.challengeRatingMax(),
                    filters.sizes(),
                    filters.types(),
                    filters.subtypes(),
                    filters.biomes(),
                    filters.alignments(),
                    selectedSort.key(),
                    pageOffset);
        }

        ControlsProjection controlsProjection() {
            CreatureFilters creatureFilters = mergedFilters(localFilters, controlsState);
            return new ControlsProjection(
                    filterOptions,
                    creatureFilters,
                    sizeDropdownState,
                    typeDropdownState,
                    subtypeDropdownState,
                    biomeDropdownState,
                    alignmentDropdownState,
                    encounterTableDropdownState,
                    encounterTableOptions,
                    FilterChip.from(creatureFilters, encounterTableOptions, controlsState),
                    controlsState);
        }

        MainProjection mainProjection() {
            return MainProjection.from(rows, selectedSort, pageOffset, totalCount, placeholderText);
        }
    }
}
