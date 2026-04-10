package clean.creatures.catalog;

import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.catalog.repository.CatalogRepository;
import clean.creatures.catalog.state.CatalogState;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Canonical root seam for clean creature catalog reads.
 */
@SuppressWarnings("unused")
public final class CatalogObject {
    private static final Logger LOGGER = Logger.getLogger(CatalogObject.class.getName());
    private final ComposeCatalogInput.CatalogInput catalog;

    private static final Map<String, Integer> CR_TO_XP = Map.ofEntries(
            Map.entry("0", 10), Map.entry("1/8", 25),
            Map.entry("1/4", 50), Map.entry("1/2", 100),
            Map.entry("1", 200), Map.entry("2", 450),
            Map.entry("3", 700), Map.entry("4", 1100),
            Map.entry("5", 1800), Map.entry("6", 2300),
            Map.entry("7", 2900), Map.entry("8", 3900),
            Map.entry("9", 5000), Map.entry("10", 5900),
            Map.entry("11", 7200), Map.entry("12", 8400),
            Map.entry("13", 10000), Map.entry("14", 11500),
            Map.entry("15", 13000), Map.entry("16", 15000),
            Map.entry("17", 18000), Map.entry("18", 20000),
            Map.entry("19", 22000), Map.entry("20", 25000),
            Map.entry("21", 33000), Map.entry("22", 41000),
            Map.entry("23", 50000), Map.entry("24", 62000),
            Map.entry("25", 75000), Map.entry("26", 90000),
            Map.entry("27", 105000), Map.entry("28", 120000),
            Map.entry("29", 135000), Map.entry("30", 155000)
    );

    private static final List<String> CR_VALUES = List.of(
            "0", "1/8", "1/4", "1/2",
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
            "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
            "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"
    );

    public CatalogObject(ComposeCatalogInput input) {
        ComposeCatalogInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.catalog = new CatalogAssembly(resolvedInput).composeCatalog();
    }

    public ComposeCatalogInput.CatalogInput composeCatalog(ComposeCatalogInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return catalog;
    }

    private static final class CatalogAssembly {

        private CatalogAssembly(ComposeCatalogInput input) {
        }

        private ComposeCatalogInput.CatalogInput composeCatalog() {
            return new ComposeCatalogInput.CatalogInput(
                    this::loadFilterOptions,
                    this::searchCreatures,
                    this::loadCreature,
                    this::loadEncounterCandidates
            );
        }

        private ComposeCatalogInput.LoadedFilterOptionsInput loadFilterOptions(
                ComposeCatalogInput.LoadFilterOptionsInput input
        ) {
            try {
                CatalogState.FilterOptionsState state = CatalogRepository.loadFilterOptions();
                return new ComposeCatalogInput.LoadedFilterOptionsInput(
                        true,
                        state.sizes(),
                        state.types(),
                        state.subtypes(),
                        state.biomes(),
                        state.alignments(),
                        CR_VALUES
                );
            } catch (SQLException exception) {
                LOGGER.log(Level.WARNING, "CatalogObject.loadFilterOptions(): DB access failed", exception);
                return new ComposeCatalogInput.LoadedFilterOptionsInput(
                        false,
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        CR_VALUES
                );
            }
        }

        private ComposeCatalogInput.SearchedCreaturesInput searchCreatures(
                ComposeCatalogInput.SearchCreaturesInput input
        ) {
            ComposeCatalogInput.CriteriaInput criteria = input != null && input.criteria() != null
                    ? input.criteria()
                    : new ComposeCatalogInput.CriteriaInput(
                            null,
                            null,
                            null,
                            List.of(),
                            List.of(),
                            List.of(),
                            List.of(),
                            List.of()
                    );
            ComposeCatalogInput.PageInput page = input != null && input.page() != null
                    ? input.page()
                    : new ComposeCatalogInput.PageInput("name", "ASC", 50, 0);

            Integer xpMin = this.parseCrToXpOrNull(criteria.crMin());
            if (criteria.crMin() != null && xpMin == null) {
                return new ComposeCatalogInput.SearchedCreaturesInput(false, true, List.of(), 0);
            }
            Integer xpMax = this.parseCrToXpOrNull(criteria.crMax());
            if (criteria.crMax() != null && xpMax == null) {
                return new ComposeCatalogInput.SearchedCreaturesInput(false, true, List.of(), 0);
            }
            if (xpMin != null && xpMax != null && xpMin > xpMax) {
                return new ComposeCatalogInput.SearchedCreaturesInput(false, true, List.of(), 0);
            }

            try {
                CatalogState.SearchResultState state = CatalogRepository.searchCreatures(
                        this.normalizeText(criteria.nameQuery()),
                        xpMin,
                        xpMax,
                        this.normalizeTexts(criteria.sizes()),
                        this.normalizeTexts(criteria.types()),
                        this.normalizeTexts(criteria.subtypes()),
                        this.normalizeTexts(criteria.biomes()),
                        this.normalizeTexts(criteria.alignments()),
                        input == null ? List.of() : this.normalizeIds(input.excludeIds()),
                        input == null ? List.of() : this.normalizeIds(input.tableIds()),
                        this.normalizeSortColumn(page.sortColumn()),
                        this.normalizeSortDirection(page.sortDirection()),
                        this.normalizeLimit(page.limit()),
                        this.normalizeOffset(page.offset())
                );
                return new ComposeCatalogInput.SearchedCreaturesInput(
                        true,
                        false,
                        state.creatures().stream()
                                .map(this::toCreatureSummaryInput)
                                .toList(),
                        state.totalCount()
                );
            } catch (SQLException exception) {
                LOGGER.log(Level.WARNING, "CatalogObject.searchCreatures(): DB access failed", exception);
                return new ComposeCatalogInput.SearchedCreaturesInput(false, false, List.of(), 0);
            }
        }

        private ComposeCatalogInput.LoadedCreatureInput loadCreature(ComposeCatalogInput.LoadCreatureInput input) {
            long creatureId = input == null || input.creatureId() == null ? -1L : input.creatureId();
            if (creatureId <= 0L) {
                return new ComposeCatalogInput.LoadedCreatureInput(false, null);
            }
            try {
                CatalogState.CreatureDetailsState state = CatalogRepository.loadCreature(creatureId);
                return new ComposeCatalogInput.LoadedCreatureInput(
                        true,
                        state == null ? null : this.toCreatureDetailsInput(state)
                );
            } catch (SQLException exception) {
                LOGGER.log(Level.WARNING, "CatalogObject.loadCreature(): DB access failed", exception);
                return new ComposeCatalogInput.LoadedCreatureInput(false, null);
            }
        }

        private ComposeCatalogInput.LoadedEncounterCandidatesInput loadEncounterCandidates(
                ComposeCatalogInput.LoadEncounterCandidatesInput input
        ) {
            if (input == null) {
                return new ComposeCatalogInput.LoadedEncounterCandidatesInput(false, List.of());
            }
            try {
                CatalogState.EncounterCandidatesState state = CatalogRepository.loadEncounterCandidates(
                        this.normalizeTexts(input.types()),
                        Math.max(0, input.minXp()),
                        Math.max(input.minXp(), input.maxXp()),
                        this.normalizeTexts(input.biomes()),
                        this.normalizeTexts(input.subtypes()),
                        input.encounterGenerationProjection()
                );
                return new ComposeCatalogInput.LoadedEncounterCandidatesInput(
                        true,
                        state.creatures().stream()
                                .map(this::toEncounterCandidateInput)
                                .toList()
                );
            } catch (SQLException exception) {
                LOGGER.log(Level.WARNING, "CatalogObject.loadEncounterCandidates(): DB access failed", exception);
                return new ComposeCatalogInput.LoadedEncounterCandidatesInput(false, List.of());
            }
        }

        private ComposeCatalogInput.CreatureSummaryInput toCreatureSummaryInput(
                CatalogState.CreatureSummaryState state
        ) {
            return new ComposeCatalogInput.CreatureSummaryInput(
                    state.creatureId(),
                    state.name(),
                    state.cr(),
                    state.xp(),
                    state.size(),
                    state.creatureType(),
                    state.alignment()
            );
        }

        private ComposeCatalogInput.CreatureDetailsInput toCreatureDetailsInput(
                CatalogState.CreatureDetailsState state
        ) {
            return new ComposeCatalogInput.CreatureDetailsInput(
                    state.creatureId(),
                    state.name(),
                    state.size(),
                    state.creatureType(),
                    List.copyOf(state.subtypes()),
                    state.alignment(),
                    state.cr(),
                    state.xp(),
                    state.hp(),
                    state.hitDice(),
                    state.hitDiceCount(),
                    state.hitDiceSides(),
                    state.hitDiceModifier(),
                    state.ac(),
                    state.acNotes(),
                    state.speed(),
                    state.flySpeed(),
                    state.swimSpeed(),
                    state.climbSpeed(),
                    state.burrowSpeed(),
                    state.strength(),
                    state.dexterity(),
                    state.constitution(),
                    state.intelligence(),
                    state.wisdom(),
                    state.charisma(),
                    state.initiativeBonus(),
                    state.proficiencyBonus(),
                    state.savingThrows(),
                    state.skills(),
                    state.damageVulnerabilities(),
                    state.damageResistances(),
                    state.damageImmunities(),
                    state.conditionImmunities(),
                    state.senses(),
                    state.passivePerception(),
                    state.languages(),
                    state.legendaryActionCount(),
                    List.copyOf(state.biomes()),
                    state.traits().stream().map(this::toCreatureActionInput).toList(),
                    state.actions().stream().map(this::toCreatureActionInput).toList(),
                    state.bonusActions().stream().map(this::toCreatureActionInput).toList(),
                    state.reactions().stream().map(this::toCreatureActionInput).toList(),
                    state.legendaryActions().stream().map(this::toCreatureActionInput).toList()
            );
        }

        private ComposeCatalogInput.CreatureActionInput toCreatureActionInput(
                CatalogState.CreatureActionState state
        ) {
            return new ComposeCatalogInput.CreatureActionInput(
                    state.name(),
                    state.description(),
                    state.toHitBonus()
            );
        }

        private ComposeCatalogInput.EncounterCandidateInput toEncounterCandidateInput(
                CatalogState.EncounterCandidateState state
        ) {
            return new ComposeCatalogInput.EncounterCandidateInput(
                    state.creatureId(),
                    state.name(),
                    state.creatureType(),
                    state.cr(),
                    state.xp(),
                    state.hp(),
                    state.ac(),
                    state.initiativeBonus(),
                    state.legendaryActionCount()
            );
        }

        private Integer parseCrToXpOrNull(String cr) {
            String normalized = this.normalizeText(cr);
            return normalized.isEmpty() ? null : CR_TO_XP.get(normalized);
        }

        private String normalizeSortColumn(String value) {
            String normalized = this.normalizeText(value);
            return switch (normalized) {
                case "cr", "xp", "type", "size" -> normalized;
                default -> "name";
            };
        }

        private String normalizeSortDirection(String value) {
            return "DESC".equalsIgnoreCase(this.normalizeText(value)) ? "DESC" : "ASC";
        }

        private int normalizeLimit(int value) {
            return value <= 0 ? 50 : Math.min(value, 100);
        }

        private int normalizeOffset(int value) {
            return Math.max(0, value);
        }

        private List<String> normalizeTexts(List<String> values) {
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            return values.stream()
                    .filter(java.util.Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .distinct()
                    .toList();
        }

        private List<Long> normalizeIds(List<Long> values) {
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            return values.stream()
                    .filter(java.util.Objects::nonNull)
                    .filter(value -> value > 0L)
                    .distinct()
                    .toList();
        }

        private String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
