package features.catalog.adapter.javafx;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureFilterOptionsResult;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterTuningPreviewLabels;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableSummary;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldPlannerSnapshot;

public final class CatalogControlsContentModel {

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

    private final ReadOnlyObjectWrapper<ControlsProjection> projection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final CatalogControlsContentState state = new CatalogControlsContentState();

    ReadOnlyObjectProperty<ControlsProjection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyControlsDraft(ControlsDraft draft) {
        state.applyControlsDraft(draft);
        refreshProjection();
    }

    void applyCreatureFilterOptions(CreatureFilterOptionsResult result) {
        state.applyCreatureFilterOptions(result);
        refreshProjection();
    }

    boolean applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        boolean searchControlsChanged = state.applyEncounterBuilderInputs(builderInputs);
        refreshProjection();
        return searchControlsChanged;
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        state.applyEncounterTables(result);
        refreshProjection();
    }

    void applyWorldPlannerSnapshot(WorldPlannerSnapshot snapshot) {
        state.applyWorldPlannerSnapshot(snapshot);
        refreshProjection();
    }

    void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
        state.applyEncounterTuningPreview(labels);
        refreshProjection();
    }

    InteractionState interactionState() {
        return state.interactionState();
    }

    CreatureFilters currentSearchFilters() {
        return state.currentSearchFilters();
    }

    private void refreshProjection() {
        projection.set(state.projection());
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
            List<WorldSourceOption> worldFactionOptions,
            List<WorldSourceOption> worldLocationOptions,
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
            encounterTableOptions = Values.copiedList(encounterTableOptions);
            worldFactionOptions = Values.copiedList(worldFactionOptions);
            worldLocationOptions = Values.copiedList(worldLocationOptions);
            chips = Values.copiedList(chips);
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
                    List.of(),
                    List.of(),
                    ControlsState.empty());
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
            nameQuery = Values.safe(nameQuery);
            challengeRatingMin = Values.safe(challengeRatingMin);
            challengeRatingMax = Values.safe(challengeRatingMax);
            sizes = Values.copiedList(sizes);
            types = Values.copiedList(types);
            subtypes = Values.copiedList(subtypes);
            biomes = Values.copiedList(biomes);
            alignments = Values.copiedList(alignments);
        }

        static CreatureFilters empty() {
            return new CreatureFilters("", "", "", List.of(), List.of(), List.of(), List.of(), List.of());
        }

        static CreatureFilters from(CreatureFilters filters) {
            CreatureFilters safeFilters = filters == null
                    ? empty()
                    : filters;
            return new CreatureFilters(
                    safeFilters.nameQuery(),
                    safeFilters.challengeRatingMin(),
                    safeFilters.challengeRatingMax(),
                    safeFilters.sizes(),
                    safeFilters.types(),
                    safeFilters.subtypes(),
                    safeFilters.biomes(),
                    safeFilters.alignments());
        }

        static CreatureFilters merged(LocalFilterState local, ControlsState controls) {
            LocalFilterState safeLocal = local == null
                    ? LocalFilterState.empty()
                    : local;
            ControlsState safeControls = controls == null
                    ? ControlsState.empty()
                    : controls;
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
            sizes = Values.copiedList(sizes);
            types = Values.copiedList(types);
            subtypes = Values.copiedList(subtypes);
            biomes = Values.copiedList(biomes);
            alignments = Values.copiedList(alignments);
            challengeRatings = Values.copiedList(challengeRatings);
        }

        static FilterOptionsProjection empty() {
            return new FilterOptionsProjection(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }

        static FilterOptionsProjection from(FilterOptionsProjection projection) {
            FilterOptionsProjection safeProjection = projection == null
                    ? empty()
                    : projection;
            return new FilterOptionsProjection(
                    safeProjection.sizes(),
                    safeProjection.types(),
                    safeProjection.subtypes(),
                    safeProjection.biomes(),
                    safeProjection.alignments(),
                    safeProjection.challengeRatings());
        }
    }

    record ControlsState(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            List<Long> encounterTableIds,
            List<Long> worldFactionIds,
            long worldLocationId,
            SliderProjection difficulty,
            SliderProjection balance,
            SliderProjection amount,
            SliderProjection diversity
    ) {
        ControlsState {
            creatureTypes = Values.copiedList(creatureTypes);
            creatureSubtypes = Values.copiedList(creatureSubtypes);
            biomes = Values.copiedList(biomes);
            encounterTableIds = Values.copiedList(encounterTableIds);
            worldFactionIds = Values.copiedList(worldFactionIds);
            worldLocationId = Math.max(0L, worldLocationId);
            difficulty = difficulty == null ? SliderProjection.empty() : difficulty;
            balance = balance == null ? SliderProjection.empty() : balance;
            amount = amount == null ? SliderProjection.empty() : amount;
            diversity = diversity == null ? SliderProjection.empty() : diversity;
        }

        static ControlsState empty() {
            return new ControlsState(
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    0L,
                    SliderProjection.defaultDifficulty(),
                    SliderProjection.defaultBalance(),
                    SliderProjection.defaultAmount(),
                    SliderProjection.defaultDiversity());
        }

        static ControlsState from(ControlsState state) {
            ControlsState safeState = state == null
                    ? empty()
                    : state;
            return new ControlsState(
                    safeState.creatureTypes(),
                    safeState.creatureSubtypes(),
                    safeState.biomes(),
                    safeState.encounterTableIds(),
                    safeState.worldFactionIds(),
                    safeState.worldLocationId(),
                    SliderProjection.from(safeState.difficulty()),
                    SliderProjection.from(safeState.balance()),
                    SliderProjection.from(safeState.amount()),
                    SliderProjection.from(safeState.diversity()));
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
                    safeInputs.worldFactionIds(),
                    safeInputs.worldLocationId(),
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

        ControlsState withPreviewLabels(CatalogControlsPreviewLabels labels) {
            CatalogControlsPreviewLabels safeLabels = labels == null
                    ? CatalogControlsPreviewLabels.empty()
                    : labels;
            return new ControlsState(
                    creatureTypes,
                    creatureSubtypes,
                    biomes,
                    encounterTableIds,
                    worldFactionIds,
                    worldLocationId,
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

    record SliderProjection(boolean auto, double value, List<PreviewLabel> labels) {
        SliderProjection {
            value = Double.isFinite(value) ? value : 0.0;
            labels = Values.copiedList(labels);
        }

        static SliderProjection empty() {
            return defaultDifficulty();
        }

        static SliderProjection from(SliderProjection projection) {
            if (projection == null) {
                return empty();
            }
            return new SliderProjection(
                    projection.auto(),
                    projection.value(),
                    projection.labels().stream().map(PreviewLabel::from).toList());
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
                List<PreviewLabel> previewLabels,
                List<PreviewLabel> fallback,
                double defaultValue
        ) {
            List<PreviewLabel> labels = previewLabels == null || previewLabels.isEmpty()
                    ? fallback
                    : previewLabels;
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

    record PreviewLabel(double value, String label) {
        PreviewLabel {
            label = Values.safe(label);
        }

        static PreviewLabel from(PreviewLabel label) {
            return label == null ? new PreviewLabel(0.0, "") : new PreviewLabel(label.value(), label.label());
        }
    }

    record EncounterTableOption(long tableId, String name, Long linkedLootTableId) {
        EncounterTableOption {
            name = name == null || name.isBlank() ? "Tabelle " + tableId : name;
        }

        static EncounterTableOption from(EncounterTableOption option) {
            return option == null
                    ? new EncounterTableOption(0L, "", null)
                    : new EncounterTableOption(option.tableId(), option.name(), option.linkedLootTableId());
        }
    }

    record WorldSourceOption(long id, String name) {
        WorldSourceOption {
            id = Math.max(0L, id);
            name = name == null || name.isBlank() ? "Quelle " + id : name;
        }

        static WorldSourceOption from(WorldSourceOption option) {
            return option == null
                    ? new WorldSourceOption(0L, "")
                    : new WorldSourceOption(option.id(), option.name());
        }
    }

    record FilterChip(String key, String label, String styleClass) {
        FilterChip {
            key = Values.safe(key);
            label = Values.safe(label);
            styleClass = Values.safe(styleClass);
        }

        static FilterChip from(FilterChip chip) {
            return chip == null
                    ? new FilterChip("", "", "")
                    : new FilterChip(chip.key(), chip.label(), chip.styleClass());
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
                        "CR: " + Values.defaultCrMinimum(safeFilters.challengeRatingMin())
                                + "-"
                                + Values.defaultCrMaximum(safeFilters.challengeRatingMax()),
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
            for (String value : Values.copiedList(values)) {
                chips.add(new FilterChip(prefix + ":" + value, value, styleClass));
            }
        }

        private static EncounterTableOption encounterTableOption(List<EncounterTableOption> options, Long tableId) {
            if (tableId == null) {
                return null;
            }
            for (EncounterTableOption option : Values.copiedList(options)) {
                if (option.tableId() == tableId.longValue()) {
                    return option;
                }
            }
            return null;
        }
    }

    record FilterDropdownState(boolean open, String searchQuery) {
        FilterDropdownState {
            searchQuery = Values.safe(searchQuery);
        }

        static FilterDropdownState closed() {
            return new FilterDropdownState(false, "");
        }

        static FilterDropdownState from(FilterDropdownState state) {
            FilterDropdownState safeState = state == null
                    ? closed()
                    : state;
            return new FilterDropdownState(safeState.open(), safeState.searchQuery());
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

    record LocalFilterState(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
            List<String> sizes,
            List<String> alignments
    ) {
        LocalFilterState {
            nameQuery = Values.safe(nameQuery);
            challengeRatingMin = Values.safe(challengeRatingMin);
            challengeRatingMax = Values.safe(challengeRatingMax);
            sizes = Values.copiedList(sizes);
            alignments = Values.copiedList(alignments);
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
                    Values.retainAvailable(sizes, safeOptions.sizes()),
                    Values.retainAvailable(alignments, safeOptions.alignments()));
        }
    }

    static final class Values {

        static <T> List<T> copiedList(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }

        static String safe(String value) {
            return value == null ? "" : value;
        }

        static String defaultCrMinimum(String value) {
            return value == null || value.isBlank() ? "0" : value;
        }

        static String defaultCrMaximum(String value) {
            return value == null || value.isBlank() ? "30" : value;
        }

        static <T> List<T> retainAvailable(List<T> selectedValues, List<T> availableValues) {
            if (selectedValues == null || selectedValues.isEmpty()) {
                return List.of();
            }
            List<T> safeAvailable = availableValues == null ? List.of() : List.copyOf(availableValues);
            return selectedValues.stream()
                    .filter(safeAvailable::contains)
                    .distinct()
                    .toList();
        }

        private Values() {
        }
    }
    private static final class CatalogControlsContentState {
    
        private CatalogControlsContentModel.LocalFilterState localFilters =
                CatalogControlsContentModel.LocalFilterState.empty();
        private CatalogControlsContentModel.ControlsState authoritativeControls =
                CatalogControlsContentModel.ControlsState.empty();
        private CatalogControlsContentModel.ControlsState controlsState =
                CatalogControlsContentModel.ControlsState.empty();
        private CatalogControlsContentModel.FilterOptionsProjection filterOptions =
                CatalogControlsContentModel.FilterOptionsProjection.empty();
        private CatalogControlsContentModel.FilterDropdownState sizeDropdownState =
                CatalogControlsContentModel.FilterDropdownState.closed();
        private CatalogControlsContentModel.FilterDropdownState typeDropdownState =
                CatalogControlsContentModel.FilterDropdownState.closed();
        private CatalogControlsContentModel.FilterDropdownState subtypeDropdownState =
                CatalogControlsContentModel.FilterDropdownState.closed();
        private CatalogControlsContentModel.FilterDropdownState biomeDropdownState =
                CatalogControlsContentModel.FilterDropdownState.closed();
        private CatalogControlsContentModel.FilterDropdownState alignmentDropdownState =
                CatalogControlsContentModel.FilterDropdownState.closed();
        private CatalogControlsContentModel.FilterDropdownState encounterTableDropdownState =
                CatalogControlsContentModel.FilterDropdownState.closed();
        private List<CatalogControlsContentModel.EncounterTableOption> encounterTableOptions = List.of();
        private List<CatalogControlsContentModel.WorldSourceOption> worldFactionOptions = List.of();
        private List<CatalogControlsContentModel.WorldSourceOption> worldLocationOptions = List.of();
    
        void applyControlsDraft(CatalogControlsContentModel.ControlsDraft draft) {
            CatalogControlsContentModel.ControlsDraft safeDraft = draft == null
                    ? new CatalogControlsContentModel.ControlsDraft(
                            CatalogControlsContentModel.LocalFilterState.empty(),
                            CatalogControlsContentModel.ControlsState.empty(),
                            CatalogControlsContentModel.FilterDropdownState.closed(),
                            CatalogControlsContentModel.FilterDropdownState.closed(),
                            CatalogControlsContentModel.FilterDropdownState.closed(),
                            CatalogControlsContentModel.FilterDropdownState.closed(),
                            CatalogControlsContentModel.FilterDropdownState.closed(),
                            CatalogControlsContentModel.FilterDropdownState.closed())
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
            filterOptions = new CatalogControlsContentModel.FilterOptionsProjection(
                    options.sizes(),
                    options.types(),
                    options.subtypes(),
                    options.biomes(),
                    options.alignments(),
                    options.challengeRatings());
            localFilters = localFilters.retainAvailable(filterOptions);
        }
    
        boolean applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
            CatalogControlsContentModel.ControlsState previousAuthoritative = authoritativeControls;
            CatalogControlsContentModel.LocalFilterState previousLocal = localFilters;
            EncounterBuilderInputs safeInputs = builderInputs == null ? EncounterBuilderInputs.empty() : builderInputs;
            CatalogControlsContentModel.ControlsState next =
                    CatalogControlsContentModel.ControlsState.fromBuilderInputs(safeInputs, previousAuthoritative);
            localFilters = new CatalogControlsContentModel.LocalFilterState(
                    safeInputs.nameQuery(), safeInputs.challengeRatingMin(), safeInputs.challengeRatingMax(),
                    safeInputs.sizes(), safeInputs.alignments()).retainAvailable(filterOptions);
            authoritativeControls = next;
            controlsState = next;
            return !previousLocal.equals(localFilters)
                    || CatalogControlsContentModel.ControlsState.searchControlsChanged(previousAuthoritative, next);
        }
    
        void applyEncounterTables(EncounterTableCatalogResult result) {
            if (result == null || result.status() != EncounterTableReadStatus.SUCCESS) {
                encounterTableOptions = List.of();
                return;
            }
            encounterTableOptions = result.tables().stream()
                    .map(CatalogControlsContentState::encounterTableOption)
                    .toList();
        }

        void applyWorldPlannerSnapshot(WorldPlannerSnapshot snapshot) {
            if (snapshot == null) {
                worldFactionOptions = List.of();
                worldLocationOptions = List.of();
                return;
            }
            worldFactionOptions = snapshot.factions().stream()
                    .map(CatalogControlsContentState::worldFactionOption)
                    .toList();
            worldLocationOptions = snapshot.locations().stream()
                    .map(CatalogControlsContentState::worldLocationOption)
                    .toList();
        }
    
        void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
            CatalogControlsPreviewLabels previewLabels = CatalogControlsPreviewLabels.from(labels);
            authoritativeControls = authoritativeControls.withPreviewLabels(previewLabels);
            controlsState = controlsState.withPreviewLabels(previewLabels);
        }
    
        CatalogControlsContentModel.InteractionState interactionState() {
            return new CatalogControlsContentModel.InteractionState(
                    localFilters,
                    controlsState,
                    authoritativeControls);
        }
    
        CatalogControlsContentModel.CreatureFilters currentSearchFilters() {
            return CatalogControlsContentModel.CreatureFilters.merged(localFilters, authoritativeControls);
        }
    
        CatalogControlsContentModel.ControlsProjection projection() {
            CatalogControlsContentModel.CreatureFilters creatureFilters =
                    CatalogControlsContentModel.CreatureFilters.merged(localFilters, controlsState);
            return new CatalogControlsContentModel.ControlsProjection(
                    CatalogControlsContentModel.FilterOptionsProjection.from(filterOptions),
                    CatalogControlsContentModel.CreatureFilters.from(creatureFilters),
                    CatalogControlsContentModel.FilterDropdownState.from(sizeDropdownState),
                    CatalogControlsContentModel.FilterDropdownState.from(typeDropdownState),
                    CatalogControlsContentModel.FilterDropdownState.from(subtypeDropdownState),
                    CatalogControlsContentModel.FilterDropdownState.from(biomeDropdownState),
                    CatalogControlsContentModel.FilterDropdownState.from(alignmentDropdownState),
                    CatalogControlsContentModel.FilterDropdownState.from(encounterTableDropdownState),
                    CatalogControlsContentModel.Values.copiedList(encounterTableOptions)
                            .stream()
                            .map(CatalogControlsContentModel.EncounterTableOption::from)
                            .toList(),
                    CatalogControlsContentModel.Values.copiedList(worldFactionOptions)
                            .stream()
                            .map(CatalogControlsContentModel.WorldSourceOption::from)
                            .toList(),
                    CatalogControlsContentModel.Values.copiedList(worldLocationOptions)
                            .stream()
                            .map(CatalogControlsContentModel.WorldSourceOption::from)
                            .toList(),
                    CatalogControlsContentModel.FilterChip.from(creatureFilters, encounterTableOptions, controlsState)
                            .stream()
                            .map(CatalogControlsContentModel.FilterChip::from)
                            .toList(),
                    CatalogControlsContentModel.ControlsState.from(controlsState));
        }
    
        private static CatalogControlsContentModel.EncounterTableOption encounterTableOption(
                EncounterTableSummary summary
        ) {
            return new CatalogControlsContentModel.EncounterTableOption(
                    summary.tableId(),
                    summary.name(),
                    summary.linkedLootTableId());
        }

        private static CatalogControlsContentModel.WorldSourceOption worldFactionOption(WorldFactionSummary summary) {
            return new CatalogControlsContentModel.WorldSourceOption(summary.factionId(), summary.displayName());
        }

        private static CatalogControlsContentModel.WorldSourceOption worldLocationOption(WorldLocationSummary summary) {
            return new CatalogControlsContentModel.WorldSourceOption(summary.locationId(), summary.displayName());
        }
    }
    
    private record CatalogControlsPreviewLabels(
            List<CatalogControlsContentModel.PreviewLabel> difficultyLabels,
            List<CatalogControlsContentModel.PreviewLabel> balanceLabels,
            List<CatalogControlsContentModel.PreviewLabel> amountLabels,
            List<CatalogControlsContentModel.PreviewLabel> diversityLabels
    ) {
        CatalogControlsPreviewLabels {
            difficultyLabels = copy(difficultyLabels);
            balanceLabels = copy(balanceLabels);
            amountLabels = copy(amountLabels);
            diversityLabels = copy(diversityLabels);
        }
    
        static CatalogControlsPreviewLabels empty() {
            return new CatalogControlsPreviewLabels(List.of(), List.of(), List.of(), List.of());
        }
    
        static CatalogControlsPreviewLabels from(EncounterTuningPreviewLabels previewLabels) {
            if (previewLabels == null) {
                return empty();
            }
            return new CatalogControlsPreviewLabels(
                    previewLabels(previewLabels.difficultyLabels()),
                    previewLabels(previewLabels.balanceLabels()),
                    previewLabels(previewLabels.amountLabels()),
                    previewLabels(previewLabels.diversityLabels()));
        }
    
        private static List<CatalogControlsContentModel.PreviewLabel> previewLabels(
                List<EncounterTuningPreviewLabels.PreviewLabel> labels
        ) {
            if (labels == null || labels.isEmpty()) {
                return List.of();
            }
            return labels.stream()
                    .map(label -> new CatalogControlsContentModel.PreviewLabel(label.value(), label.label()))
                    .toList();
        }
    
        private static List<CatalogControlsContentModel.PreviewLabel> copy(
                List<CatalogControlsContentModel.PreviewLabel> labels
        ) {
            return labels == null ? List.of() : List.copyOf(labels);
        }
    }
}
