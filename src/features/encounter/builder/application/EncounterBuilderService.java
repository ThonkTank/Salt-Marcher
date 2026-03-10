package features.encounter.builder.application;

import features.creatures.model.Creature;
import features.encounter.builder.application.ports.CreatureCandidateProvider;
import features.encounter.builder.application.ports.EncounterTableProvider;
import features.encounter.builder.application.ports.PartyProvider;
import features.encounter.generation.service.EncounterDifficultyBand;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterScoring;
import features.encounter.generation.service.EncounterTuning;
import features.encounter.model.EncounterSlot;
import features.encounter.partyanalysis.application.EncounterPartyAnalysisService;
import features.encounter.partyanalysis.model.CreatureRoleProfile;
import features.encountertable.model.EncounterTable;
import features.party.api.PartyApi;
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
    private final EncounterTableProvider encounterTableProvider;
    private final CreatureCandidateProvider creatureCandidateProvider;

    public EncounterBuilderService(
            PartyProvider partyProvider,
            EncounterTableProvider encounterTableProvider,
            CreatureCandidateProvider creatureCandidateProvider
    ) {
        this.partyProvider = Objects.requireNonNull(partyProvider, "partyProvider");
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
        return EncounterPartyAnalysisService.classifyRoleProfileForActiveParty(creature);
    }

    public EncounterGenerator.GenerationResult generateEncounter(GenerationRequest request) {
        EncounterFilter filter = request.filter();
        List<String> types = filter == null ? null : nullIfEmpty(filter.types());
        List<String> subtypes = filter == null ? null : nullIfEmpty(filter.subtypes());
        List<String> biomes = filter == null ? null : nullIfEmpty(filter.biomes());

        int xpCeiling = EncounterGenerator.computeXpCeiling(
                request.avgLevel(), request.difficultyBand(), request.partySize());

        CandidateLoadResult loadedCandidates =
                loadCandidates(request, xpCeiling, types, subtypes, biomes);
        if (loadedCandidates.isError()) {
            return EncounterGenerator.GenerationResult.blockedByUserInput(loadedCandidates.failureReason());
        }

        EncounterPartyAnalysisService.GenerationSnapshot analysisSnapshot =
                EncounterPartyAnalysisService.loadGenerationSnapshot(candidateIdsOf(loadedCandidates.candidates()));
        EncounterGenerator.GenerationAdvisory advisory = mapGenerationAdvisory(analysisSnapshot.readiness());

        EncounterGenerator.GenerationResult result = EncounterGenerator.generateEncounter(
                toEncounterRequest(request, types, subtypes, biomes, loadedCandidates.selectionWeights(), analysisSnapshot),
                loadedCandidates.candidates());
        if (result.status() == EncounterGenerator.GenerationStatus.SUCCESS) {
            return EncounterGenerator.GenerationResult.success(result.encounter(), advisory, result.diagnostics());
        }
        return result;
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

    public int previewTargetCreaturesForAmount(double amountValue, int partySize) {
        return EncounterGenerator.targetCreaturesForAmount(amountValue, partySize);
    }

    public int maxCreaturesPerSlot() {
        return EncounterGenerator.MAX_CREATURES_PER_SLOT;
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
            EncounterPartyAnalysisService.GenerationSnapshot analysisSnapshot) {
        return new EncounterGenerator.EncounterRequest(
                request.partySize(),
                request.avgLevel(),
                types,
                subtypes,
                biomes,
                request.difficultyBand(),
                request.amountValue(),
                request.balanceLevel(),
                new EncounterGenerator.GenerationDataSnapshot(
                        selectionWeights,
                        analysisSnapshot == null ? Map.of() : analysisSnapshot.roleProfilesByCreatureId())
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
            EncounterPartyAnalysisService.CacheReadiness readiness) {
        return switch (readiness) {
            case READY -> null;
            case NOT_READY -> EncounterGenerator.GenerationAdvisory.PARTY_ROLE_FALLBACK_CACHE_REBUILDING;
            case STORAGE_ERROR -> EncounterGenerator.GenerationAdvisory.PARTY_ROLE_FALLBACK_STORAGE_UNAVAILABLE;
        };
    }
}
