package features.encounter.service;

import features.creaturecatalog.model.Creature;
import features.creaturecatalog.service.CreatureService;
import features.encounter.model.Combatant;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.encounter.model.MonsterRole;
import features.encounter.model.MonsterRoleParser;
import features.encounter.service.combat.CombatSetup;
import features.gamerules.service.XpCalculator;
import features.encounter.service.generation.EncounterGenerator;
import features.encountertable.model.EncounterTable;
import features.encountertable.service.EncounterTableService;
import features.party.model.PlayerCharacter;
import features.party.service.PartyService;

import java.util.List;
import java.util.Map;

/**
 * Workflow facade for encounter UI use-cases.
 * Encapsulates party/table loading, candidate selection, generation, and combat setup.
 */
public class EncounterService {

    public record PartySnapshot(List<PlayerCharacter> party, int avgLevel) {}
    public enum TableLoadStatus { SUCCESS, STORAGE_ERROR }
    public record TableCatalogResult(TableLoadStatus status, List<EncounterTable> tables) {}
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

    private record CandidateLoadResult(
            List<Creature> candidates,
            Map<Long, Integer> selectionWeights,
            String errorMessage
    ) {
        boolean isError() {
            return errorMessage != null;
        }
    }

    public PartySnapshot loadPartySnapshot() {
        List<PlayerCharacter> party = PartyService.getActiveParty();
        int avgLevel = PartyService.averageLevel(party);
        return new PartySnapshot(party, avgLevel);
    }

    public TableCatalogResult loadEncounterTables() {
        EncounterTableService.TableListResult result = EncounterTableService.loadAll();
        if (result.status() == EncounterTableService.ReadStatus.SUCCESS) {
            return new TableCatalogResult(TableLoadStatus.SUCCESS, result.tables());
        }
        return new TableCatalogResult(TableLoadStatus.STORAGE_ERROR, List.of());
    }

    public MonsterRole classifyRole(Creature creature) {
        return MonsterRoleParser.parseOrBrute(creature != null ? creature.Role : null);
    }

    public EncounterGenerator.GenerationResult generateEncounter(GenerationRequest request) {
        EncounterFilter filter = request.filter();
        List<String> types = filter == null ? null : nullIfEmpty(filter.types());
        List<String> subtypes = filter == null ? null : nullIfEmpty(filter.subtypes());
        List<String> biomes = filter == null ? null : nullIfEmpty(filter.biomes());

        int xpCeiling = EncounterGenerator.computeXpCeiling(
                request.avgLevel(), request.difficultyValue(), request.partySize());

        CandidateLoadResult loadedCandidates =
                loadCandidates(request, xpCeiling, types, subtypes, biomes);
        if (loadedCandidates.isError()) {
            return EncounterGenerator.GenerationResult.blockedByUserInput(loadedCandidates.errorMessage());
        }

        return EncounterGenerator.generateEncounter(
                toEncounterRequest(request, types, subtypes, biomes, loadedCandidates.selectionWeights()),
                loadedCandidates.candidates()
        );
    }

    public List<Combatant> prepareCombatants(CombatStartRequest request) {
        return CombatSetup.buildCombatants(
                request.party(),
                request.pcInitiatives(),
                request.encounter(),
                request.monsterInitiatives()
        );
    }

    public XpCalculator.DifficultyStats computeLiveDifficultyStats(
            List<Combatant> combatants, int partySize, int avgLevel) {
        return CombatSetup.computeLiveStats(combatants, partySize, avgLevel);
    }

    public XpCalculator.DifficultyStats computeRosterDifficultyStats(
            List<EncounterSlot> slots, int partySize, int avgLevel) {
        return XpCalculator.computeStatsFromSlots(slots, partySize, avgLevel);
    }

    private static <T> List<T> nullIfEmpty(List<T> list) {
        return list == null || list.isEmpty() ? null : list;
    }

    private static EncounterGenerator.EncounterRequest toEncounterRequest(
            GenerationRequest request,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            Map<Long, Integer> selectionWeights) {
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
                selectionWeights
        );
    }

    private static CandidateLoadResult loadCandidates(
            GenerationRequest request,
            int xpCeiling,
            List<String> types,
            List<String> subtypes,
            List<String> biomes) {
        List<Long> tableIds = request.tableIds() == null ? List.of() : request.tableIds();
        if (!tableIds.isEmpty()) {
            EncounterTableService.CandidatesResult candidateResult =
                    EncounterTableService.getCandidatesFromTables(tableIds, xpCeiling);
            if (candidateResult.status() == EncounterTableService.ReadStatus.STORAGE_ERROR) {
                return new CandidateLoadResult(
                        List.of(),
                        Map.of(),
                        "Datenbankfehler: Tabellen-Kandidaten konnten nicht geladen werden."
                );
            }
            return new CandidateLoadResult(
                    candidateResult.candidates(),
                    candidateResult.selectionWeights(),
                    null
            );
        }
        return new CandidateLoadResult(
                CreatureService.getCreaturesForEncounter(types, 1, xpCeiling, biomes, subtypes),
                Map.of(),
                null
        );
    }
}
