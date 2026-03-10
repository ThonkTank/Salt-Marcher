package features.encounter.service;

import features.creaturecatalog.model.Creature;
import features.encounter.model.Combatant;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.encounter.model.MonsterCombatant;
import features.gamerules.model.MonsterRole;
import features.gamerules.model.MonsterRoleParser;
import features.encounter.service.combat.CombatOutcomeService;
import features.encounter.service.combat.CombatSetup;
import features.encounter.service.combat.CombatSession;
import features.encounter.service.combat.EncounterLootService;
import features.encounter.service.combat.PreparedEncounterSlot;
import features.encounter.service.analysis.EncounterPartyAnalysisService;
import features.encounter.service.generation.EncounterScoring;
import features.encounter.service.generation.EncounterGenerator;
import features.encountertable.model.EncounterTable;
import features.gamerules.service.XpCalculator;
import features.party.model.PlayerCharacter;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Workflow facade for encounter UI use-cases.
 * Encapsulates party/table loading, candidate selection, generation, and combat setup.
 */
public class EncounterService {

    public interface PartyProvider {
        List<PlayerCharacter> getActiveParty();
        int averageLevel(List<PlayerCharacter> party);
    }

    public interface EncounterTableProvider {
        TableCatalogResult loadEncounterTables();
        CandidateSelection loadCandidates(List<Long> tableIds, int xpCeiling);
    }

    public interface CreatureCandidateProvider {
        List<Creature> getCreaturesForEncounter(
                List<String> types,
                int minXp,
                int maxXp,
                List<String> biomes,
                List<String> subtypes
        );
    }

    public record PartySnapshot(List<PlayerCharacter> party, int avgLevel) {}
    public enum TableLoadStatus { SUCCESS, STORAGE_ERROR }
    public record TableCatalogResult(TableLoadStatus status, List<EncounterTable> tables) {}
    public record CandidateSelection(
            List<Creature> candidates,
            Map<Long, Integer> selectionWeights,
            TableLoadStatus status
    ) {}

    public record EncounterFilter(
            List<String> types,
            List<String> subtypes,
            List<String> biomes
    ) {}

    public record GenerationRequest(
            int partySize,
            int avgLevel,
            EncounterFilter filter,
            double difficultyValue,
            int groupsLevel,
            int balanceLevel,
            double amountValue,
            List<Long> tableIds
    ) {}

    public record CombatStartRequest(
            List<PlayerCharacter> party,
            List<Integer> pcInitiatives,
            Encounter encounter,
            List<Integer> monsterInitiatives
    ) {}

    public enum CombatStartStatus { SUCCESS, INVALID_INPUT }

    public enum CombatStartFailureReason {
        REQUEST_MISSING,
        PARTY_MISSING,
        PC_INITIATIVES_MISSING,
        ENCOUNTER_MISSING,
        ENCOUNTER_SLOTS_INVALID,
        PARTY_MEMBER_MISSING,
        PC_INITIATIVE_VALUE_MISSING,
        PC_INITIATIVE_COUNT_MISMATCH
    }

    public record CombatStartResult(
            CombatStartStatus status,
            List<Combatant> combatants,
            CombatStartFailureReason failureReason
    ) {
        public static CombatStartResult success(List<Combatant> combatants) {
            return new CombatStartResult(CombatStartStatus.SUCCESS, combatants, null);
        }

        public static CombatStartResult invalidInput(CombatStartFailureReason failureReason) {
            return new CombatStartResult(CombatStartStatus.INVALID_INPUT, List.of(), failureReason);
        }
    }

    private record CandidateLoadResult(
            List<Creature> candidates,
            Map<Long, Integer> selectionWeights,
            EncounterGenerator.GenerationFailureReason failureReason
    ) {
        boolean isError() {
            return failureReason != null;
        }
    }

    private final PartyProvider partyProvider;
    private final EncounterTableProvider encounterTableProvider;
    private final CreatureCandidateProvider creatureCandidateProvider;

    public EncounterService(
            PartyProvider partyProvider,
            EncounterTableProvider encounterTableProvider,
            CreatureCandidateProvider creatureCandidateProvider
    ) {
        this.partyProvider = Objects.requireNonNull(partyProvider, "partyProvider");
        this.encounterTableProvider = Objects.requireNonNull(encounterTableProvider, "encounterTableProvider");
        this.creatureCandidateProvider = Objects.requireNonNull(creatureCandidateProvider, "creatureCandidateProvider");
    }

    public PartySnapshot loadPartySnapshot() {
        List<PlayerCharacter> party = partyProvider.getActiveParty();
        int avgLevel = partyProvider.averageLevel(party);
        return new PartySnapshot(party, avgLevel);
    }

    public TableCatalogResult loadEncounterTables() {
        return encounterTableProvider.loadEncounterTables();
    }

    public MonsterRole classifyRole(Creature creature) {
        if (creature != null && creature.Id != null) {
            MonsterRole dynamic = EncounterPartyAnalysisService.loadDynamicRoleForCreature(creature.Id);
            if (dynamic != null) return dynamic;
        }
        return MonsterRoleParser.parseOrBrute(creature != null ? creature.Role : null);
    }

    public EncounterGenerator.GenerationResult generateEncounter(GenerationRequest request) {
        EncounterPartyAnalysisService.CacheReadiness readiness = EncounterPartyAnalysisService.ensureCacheReady();
        EncounterGenerator.GenerationAdvisory advisory = mapGenerationAdvisory(readiness);
        Map<Long, MonsterRole> dynamicRolesByCreatureId = loadDynamicRolesForGeneration(readiness);

        EncounterFilter filter = request.filter();
        List<String> types = filter == null ? null : nullIfEmpty(filter.types());
        List<String> subtypes = filter == null ? null : nullIfEmpty(filter.subtypes());
        List<String> biomes = filter == null ? null : nullIfEmpty(filter.biomes());

        int xpCeiling = EncounterGenerator.computeXpCeiling(
                request.avgLevel(), request.difficultyValue(), request.partySize());

        CandidateLoadResult loadedCandidates =
                loadCandidates(request, xpCeiling, types, subtypes, biomes);
        if (loadedCandidates.isError()) {
            return EncounterGenerator.GenerationResult.blockedByUserInput(loadedCandidates.failureReason());
        }

        EncounterGenerator.GenerationResult result = EncounterGenerator.generateEncounter(
                toEncounterRequest(
                        request,
                        types,
                        subtypes,
                        biomes,
                        loadedCandidates.selectionWeights(),
                        dynamicRolesByCreatureId),
                loadedCandidates.candidates());
        if (result.status() == EncounterGenerator.GenerationStatus.SUCCESS) {
            return EncounterGenerator.GenerationResult.success(result.encounter(), advisory);
        }
        return result;
    }

    public CombatStartResult prepareCombatants(CombatStartRequest request) {
        if (request == null) {
            return CombatStartResult.invalidInput(CombatStartFailureReason.REQUEST_MISSING);
        }
        if (request.encounter() == null) {
            return CombatStartResult.invalidInput(CombatStartFailureReason.ENCOUNTER_MISSING);
        }
        List<EncounterSlot> encounterSlots = request.encounter().slots();
        if (encounterSlots == null || encounterSlots.isEmpty()) {
            return CombatStartResult.invalidInput(CombatStartFailureReason.ENCOUNTER_SLOTS_INVALID);
        }
        List<PreparedEncounterSlot> preparedSlots = EncounterLootService.assignLootToSlots(
                encounterSlots,
                request.encounter().averageLevel(),
                request.party() != null ? request.party().size() : request.encounter().partySize());
        CombatSetup.BuildCombatantsResult result = CombatSetup.buildCombatants(
                request.party(),
                request.pcInitiatives(),
                preparedSlots,
                request.monsterInitiatives()
        );
        if (result.status() == CombatSetup.BuildCombatantsStatus.SUCCESS) {
            return CombatStartResult.success(result.combatants());
        }
        return CombatStartResult.invalidInput(mapCombatStartFailureReason(result.failureReason()));
    }

    public XpCalculator.DifficultyStats computeLiveDifficultyStats(
            List<Combatant> combatants, int partySize, int avgLevel) {
        return CombatSetup.computeLiveStats(combatants, partySize, avgLevel);
    }

    public XpCalculator.DifficultyStats computeRosterDifficultyStats(
            List<EncounterSlot> slots, int partySize, int avgLevel) {
        return XpCalculator.computeStats(EncounterScoring.adjustedXp(slots), partySize, avgLevel);
    }

    public int previewDifficultyTargetXp(int avgLevel, int partySize, double difficultyValue) {
        return EncounterGenerator.targetBudgetForDifficulty(avgLevel, partySize, difficultyValue);
    }

    public int previewTargetMonsterSlots(int partySize, int groupsLevel) {
        return EncounterGenerator.targetMonsterSlotsForLevel(partySize, groupsLevel);
    }

    public int previewTargetCreaturesForAmount(double amountValue, int partySize) {
        return EncounterGenerator.targetCreaturesForAmount(amountValue, partySize);
    }

    public int maxCreaturesPerSlot() {
        return EncounterGenerator.MAX_CREATURES_PER_SLOT;
    }

    public CombatOutcomeService.CombatRewardsSettlement settleCombatRewards(
            List<CombatSession.EnemyOutcome> outcomes,
            int partySize,
            double defeatThreshold,
            double xpFraction,
            Set<MonsterCombatant> optionalLootSelections) {
        return CombatOutcomeService.settleRewards(
                outcomes,
                partySize,
                defeatThreshold,
                xpFraction,
                optionalLootSelections);
    }

    private static <T> List<T> nullIfEmpty(List<T> list) {
        return list == null || list.isEmpty() ? null : list;
    }

    private static EncounterGenerator.EncounterRequest toEncounterRequest(
            GenerationRequest request,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            Map<Long, Integer> selectionWeights,
            Map<Long, MonsterRole> dynamicRolesByCreatureId) {
        return new EncounterGenerator.EncounterRequest(
                request.partySize(),
                request.avgLevel(),
                types,
                subtypes,
                biomes,
                request.difficultyValue(),
                request.amountValue(),
                request.groupsLevel(),
                request.balanceLevel(),
                selectionWeights,
                dynamicRolesByCreatureId
        );
    }

    private CandidateLoadResult loadCandidates(
            GenerationRequest request,
            int xpCeiling,
            List<String> types,
            List<String> subtypes,
            List<String> biomes) {
        List<Long> tableIds = request.tableIds() == null ? List.of() : request.tableIds();
        if (!tableIds.isEmpty()) {
            CandidateSelection selection = encounterTableProvider.loadCandidates(tableIds, xpCeiling);
            if (selection.status() == TableLoadStatus.STORAGE_ERROR) {
                return new CandidateLoadResult(
                        List.of(),
                        Map.of(),
                        EncounterGenerator.GenerationFailureReason.TABLE_CANDIDATES_STORAGE_ERROR
                );
            }
            return new CandidateLoadResult(
                    selection.candidates(),
                    selection.selectionWeights(),
                    null
            );
        }
        return new CandidateLoadResult(
                creatureCandidateProvider.getCreaturesForEncounter(types, 1, xpCeiling, biomes, subtypes),
                Map.of(),
                null
        );
    }

    private static CombatStartFailureReason mapCombatStartFailureReason(
            CombatSetup.BuildCombatantsFailureReason failureReason) {
        if (failureReason == null) {
            return CombatStartFailureReason.PC_INITIATIVE_COUNT_MISMATCH;
        }
        return switch (failureReason) {
            case PARTY_MISSING -> CombatStartFailureReason.PARTY_MISSING;
            case PC_INITIATIVES_MISSING -> CombatStartFailureReason.PC_INITIATIVES_MISSING;
            case SLOTS_MISSING, SLOTS_INVALID -> CombatStartFailureReason.ENCOUNTER_SLOTS_INVALID;
            case PARTY_MEMBER_MISSING -> CombatStartFailureReason.PARTY_MEMBER_MISSING;
            case PC_INITIATIVE_VALUE_MISSING -> CombatStartFailureReason.PC_INITIATIVE_VALUE_MISSING;
            case PC_INITIATIVE_COUNT_MISMATCH -> CombatStartFailureReason.PC_INITIATIVE_COUNT_MISMATCH;
        };
    }

    private static Map<Long, MonsterRole> loadDynamicRolesForGeneration(
            EncounterPartyAnalysisService.CacheReadiness readiness) {
        if (readiness == EncounterPartyAnalysisService.CacheReadiness.READY) {
            return EncounterPartyAnalysisService.loadDynamicRolesForActiveParty();
        }
        if (readiness == EncounterPartyAnalysisService.CacheReadiness.NOT_READY) {
            EncounterPartyAnalysisService.rebuildCurrentPartyCacheAsyncBestEffort();
        }
        return Map.of();
    }

    private static EncounterGenerator.GenerationAdvisory mapGenerationAdvisory(
            EncounterPartyAnalysisService.CacheReadiness readiness) {
        return switch (readiness) {
            case READY -> null;
            case NOT_READY -> EncounterGenerator.GenerationAdvisory.PARTY_ROLE_FALLBACK_CACHE_REBUILDING;
            case STORAGE_ERROR -> EncounterGenerator.GenerationAdvisory.PARTY_ROLE_FALLBACK_STORAGE_UNAVAILABLE;
        };
    }
}
