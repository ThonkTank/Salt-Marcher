package features.encounter.builder.application;

import features.creatures.model.Creature;
import features.encounter.builder.application.ports.CreatureCandidateProvider;
import features.encounter.builder.application.ports.EncounterTableProvider;
import features.encounter.builder.application.ports.PartyAnalysisProvider;
import features.encounter.builder.application.ports.PartyProvider;
import features.encounter.generation.service.EncounterDifficultyBand;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterScoring;
import features.encounter.generation.service.EncounterTuning;
import features.encounter.generation.service.GenerationContext;
import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.model.EncounterSlot;
import features.encountertable.model.EncounterTable;
import features.party.api.PartyApi;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.model.StaticCreatureRoleHint;
import shared.rules.service.XpCalculator;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class EncounterBuilderService {

    public record PartySnapshot(List<PartyApi.PartyMember> party, int avgLevel) {}

    public record EncounterFilter(
            List<String> types,
            List<String> subtypes,
            List<String> biomes
    ) {}

    public record GenerationRequest(
            int partySize,
            int avgLevel,
            EncounterFilter filter,
            EncounterDifficultyBand difficultyBand,
            int balanceLevel,
            double amountValue,
            int diversityLevel,
            List<Long> tableIds
    ) {}

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
    private final PartyAnalysisProvider partyAnalysisProvider;
    private final EncounterTableProvider encounterTableProvider;
    private final CreatureCandidateProvider creatureCandidateProvider;

    public EncounterBuilderService(
            PartyProvider partyProvider,
            PartyAnalysisProvider partyAnalysisProvider,
            EncounterTableProvider encounterTableProvider,
            CreatureCandidateProvider creatureCandidateProvider
    ) {
        this.partyProvider = Objects.requireNonNull(partyProvider, "partyProvider");
        this.partyAnalysisProvider = Objects.requireNonNull(partyAnalysisProvider, "partyAnalysisProvider");
        this.encounterTableProvider = Objects.requireNonNull(encounterTableProvider, "encounterTableProvider");
        this.creatureCandidateProvider = Objects.requireNonNull(creatureCandidateProvider, "creatureCandidateProvider");
    }

    public PartySnapshot loadPartySnapshot() {
        List<PartyApi.PartyMember> party = partyProvider.getActiveParty();
        int avgLevel = partyProvider.averageLevel(party);
        return new PartySnapshot(party, avgLevel);
    }

    public EncounterTableProvider.TableCatalogResult loadEncounterTables() {
        return encounterTableProvider.loadEncounterTables();
    }

    public CreatureRoleProfile classifyRoleProfile(Creature creature) {
        return partyAnalysisProvider.classifyRoleProfileForActiveParty(creature);
    }

    public EncounterGenerator.GenerationResult generateEncounter(GenerationRequest request) {
        return generateEncounter(request, GenerationContext.defaultContext());
    }

    public EncounterGenerator.GenerationResult generateEncounter(
            GenerationRequest request,
            GenerationContext generationContext) {
        EncounterGenerator.EncounterRequest normalizedRequest = EncounterGenerator.normalizeRequest(
                new EncounterGenerator.EncounterRequest(
                        request.partySize(),
                        request.avgLevel(),
                        request.difficultyBand(),
                        request.amountValue(),
                        request.balanceLevel(),
                        request.diversityLevel(),
                        EncounterGenerator.GenerationDataSnapshot.empty()));
        EncounterFilter filter = request.filter();
        List<String> types = filter == null ? null : nullIfEmpty(filter.types());
        List<String> subtypes = filter == null ? null : nullIfEmpty(filter.subtypes());
        List<String> biomes = filter == null ? null : nullIfEmpty(filter.biomes());

        int xpCeiling = EncounterGenerator.computeXpCeiling(
                normalizedRequest.avgLevel(),
                normalizedRequest.difficultyBand(),
                normalizedRequest.partySize());

        CandidateLoadResult loadedCandidates =
                loadCandidates(request.tableIds(), xpCeiling, types, subtypes, biomes);
        if (loadedCandidates.isError()) {
            return EncounterGenerator.GenerationResult.blockedByUserInput(loadedCandidates.failureReason());
        }

        Set<Long> candidateIds = candidateIdsOf(loadedCandidates.candidates());
        PartyAnalysisProvider.GenerationSnapshot analysisSnapshot =
                partyAnalysisProvider.loadGenerationSnapshot(candidateIds);
        EncounterGenerator.GenerationAdvisory advisory = mapGenerationAdvisory(analysisSnapshot.readiness());
        Map<Long, CreatureRoleProfile> roleProfiles = resolveRoleProfiles(
                loadedCandidates.candidates(),
                analysisSnapshot,
                partyAnalysisProvider.loadStaticRoleHints(candidateIds),
                normalizedRequest.avgLevel(),
                normalizedRequest.partySize(),
                partyAnalysisProvider);

        EncounterGenerator.GenerationResult result = EncounterGenerator.generateEncounter(
                toEncounterRequest(
                        normalizedRequest,
                        loadedCandidates.selectionWeights(),
                        roleProfiles),
                loadedCandidates.candidates(),
                generationContext);
        if (result.status() == EncounterGenerator.GenerationStatus.SUCCESS) {
            return EncounterGenerator.GenerationResult.success(result.encounter(), advisory, result.diagnostics());
        }
        return result;
    }

    /**
     * The builder boundary resolves party-analysis data so the search pipeline
     * stays pure and does not reach back into other features.
     */
    private static Map<Long, CreatureRoleProfile> resolveRoleProfiles(
            List<Creature> candidates,
            PartyAnalysisProvider.GenerationSnapshot analysisSnapshot,
            Map<Long, StaticCreatureRoleHint> staticRoleHints,
            int avgLevel,
            int partySize,
            PartyAnalysisProvider partyAnalysisProvider) {
        if (candidates == null || candidates.isEmpty()) {
            return Map.of();
        }
        Map<Long, CreatureRoleProfile> cachedProfiles =
                analysisSnapshot == null ? Map.of() : analysisSnapshot.roleProfilesByCreatureId();
        java.util.HashMap<Long, CreatureRoleProfile> resolvedProfiles = new java.util.HashMap<>(cachedProfiles);
        EncounterPartyBenchmarks partyBenchmarks =
                EncounterCalibrationService.partyBenchmarksForAverageLevel(avgLevel, partySize);
        for (Creature creature : candidates) {
            if (creature == null || creature.Id == null || resolvedProfiles.containsKey(creature.Id)) {
                continue;
            }
            StaticCreatureRoleHint staticRoleHint = staticRoleHints == null ? null : staticRoleHints.get(creature.Id);
            CreatureRoleProfile fallbackProfile = staticRoleHint == null
                    ? partyAnalysisProvider.fallbackRoleProfile(creature, partyBenchmarks)
                    : partyAnalysisProvider.fallbackRoleProfile(creature, partyBenchmarks, staticRoleHint);
            resolvedProfiles.put(creature.Id, fallbackProfile);
        }
        return resolvedProfiles.isEmpty() ? Map.of() : Map.copyOf(resolvedProfiles);
    }

    public XpCalculator.DifficultyStats computeRosterDifficultyStats(
            List<EncounterSlot> slots, int partySize, int avgLevel) {
        return XpCalculator.computeStats(EncounterScoring.adjustedXp(slots), partySize, avgLevel);
    }

    public EncounterTuning.DifficultyBandBudgetRange previewDifficultyBandRange(
            int avgLevel,
            int partySize,
            EncounterDifficultyBand difficultyBand) {
        return EncounterGenerator.difficultyBandBudgetRange(avgLevel, partySize, difficultyBand);
    }

    public String previewAmountValue(double amountValue) {
        return EncounterTuning.describeAmountValue(amountValue);
    }

    public String previewBalanceLevel(int balanceLevel) {
        return EncounterTuning.describeBalanceLevel(balanceLevel);
    }

    public String previewDiversityLevel(int diversityLevel) {
        return EncounterTuning.describeDiversityLevel(diversityLevel);
    }

    public int maxCreaturesPerSlot() {
        return EncounterGenerator.MAX_CREATURES_PER_SLOT;
    }

    private static <T> List<T> nullIfEmpty(List<T> list) {
        return list == null || list.isEmpty() ? null : list;
    }

    private static EncounterGenerator.EncounterRequest toEncounterRequest(
            EncounterGenerator.EncounterRequest request,
            Map<Long, Integer> selectionWeights,
            Map<Long, CreatureRoleProfile> roleProfiles) {
        return new EncounterGenerator.EncounterRequest(
                request.partySize(),
                request.avgLevel(),
                request.difficultyBand(),
                request.amountValue(),
                request.balanceLevel(),
                request.diversityLevel(),
                new EncounterGenerator.GenerationDataSnapshot(
                        selectionWeights,
                        roleProfiles)
        );
    }

    private CandidateLoadResult loadCandidates(
            List<Long> requestedTableIds,
            int xpCeiling,
            List<String> types,
            List<String> subtypes,
            List<String> biomes) {
        List<Long> tableIds = requestedTableIds == null ? List.of() : requestedTableIds;
        if (!tableIds.isEmpty()) {
            EncounterTableProvider.CandidateSelection selection = encounterTableProvider.loadCandidates(tableIds, xpCeiling);
            if (selection.status() == EncounterTableProvider.TableLoadStatus.STORAGE_ERROR) {
                return new CandidateLoadResult(
                        List.of(),
                        Map.of(),
                        EncounterGenerator.GenerationFailureReason.TABLE_CANDIDATES_STORAGE_ERROR
                );
            }
            return new CandidateLoadResult(selection.candidates(), selection.selectionWeights(), null);
        }
        return new CandidateLoadResult(
                creatureCandidateProvider.getCreaturesForEncounter(types, 1, xpCeiling, biomes, subtypes),
                Map.of(),
                null
        );
    }

    private static Set<Long> candidateIdsOf(List<Creature> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return Set.of();
        }
        Set<Long> candidateIds = new HashSet<>();
        for (Creature candidate : candidates) {
            if (candidate != null && candidate.Id != null) {
                candidateIds.add(candidate.Id);
            }
        }
        return candidateIds.isEmpty() ? Set.of() : Set.copyOf(candidateIds);
    }

    private static EncounterGenerator.GenerationAdvisory mapGenerationAdvisory(
            PartyAnalysisProvider.CacheReadiness readiness) {
        if (readiness == null) {
            return null;
        }
        return switch (readiness) {
            case READY -> null;
            case NOT_READY -> EncounterGenerator.GenerationAdvisory.PARTY_ROLE_FALLBACK_CACHE_REBUILDING;
            case STORAGE_ERROR -> EncounterGenerator.GenerationAdvisory.PARTY_ROLE_FALLBACK_STORAGE_UNAVAILABLE;
        };
    }

}
