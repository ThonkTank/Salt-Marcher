package src.domain.encounter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureEncounterCandidate;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.creatures.published.CreatureEncounterCandidatesResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.RefreshCreatureEncounterCandidatesCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterCreatureFacts;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.generation.GeneratedEncounterCreatureData;
import src.domain.encounter.model.generation.EncounterGenerator;
import src.domain.encounter.model.reference.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.reference.EncounterCreatureReference;
import src.domain.encounter.model.reference.EncounterTableCandidateCriteria;
import src.domain.encounter.model.session.CreatureDetailData;
import src.domain.encounter.model.session.EncounterCreatureData;
import src.domain.encounter.model.session.PartyBudgetFacts;
import src.domain.encounter.model.session.PartyMemberData;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCandidate;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.encountertable.published.EncounterTableCandidatesResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.RefreshEncounterTableCandidatesCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.ReadStatus;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class EncounterForeignFacts implements EncounterGenerator.ForeignFacts {

    private static final int DEFAULT_CREATURE_LIMIT = 250;
    private static final int MAX_CREATURE_LIMIT = 1000;
    private static final long UNRESOLVED_ID = 0L;
    private static final long NO_MATCHING_TABLE_ID = -1L;
    private static final String DEFAULT_CREATURE_ROLE = "Creature";
    private static final String AUTO_RESOLVED_MESSAGE =
            "Auto-Einstellungen wurden fuer diese Generierung auf konkrete Zielwerte aufgeloest.";
    private static final String FALLBACK_MESSAGE =
            "Kein exakter Treffer war verfuegbar. Die beste gefundene Alternative wurde uebernommen.";

    private final CreaturesApplicationService creatures;
    private final CreatureDetailModel creatureDetails;
    private final CreatureEncounterCandidatesModel creatureCandidates;
    private final EncounterTableApplicationService encounterTables;
    private final EncounterTableCandidatesModel tableCandidates;
    private final WorldPlannerSnapshotModel worldPlannerSources;
    private final PartyApplicationService party;
    private final ActivePartyModel activeParty;
    private final ActivePartyCompositionModel activePartyComposition;
    private final AdventuringDaySummaryModel adventuringDaySummary;
    private final PartyMutationModel partyMutation;

    EncounterForeignFacts(
            CreaturesApplicationService creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApplicationService encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            WorldPlannerSnapshotModel worldPlannerSources,
            PartyApplicationService party,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activePartyComposition,
            AdventuringDaySummaryModel adventuringDaySummary,
            PartyMutationModel partyMutation
    ) {
        this.creatures = java.util.Objects.requireNonNull(creatures, "creatures");
        this.creatureDetails = java.util.Objects.requireNonNull(creatureDetails, "creatureDetails");
        this.creatureCandidates = java.util.Objects.requireNonNull(creatureCandidates, "creatureCandidates");
        this.encounterTables = java.util.Objects.requireNonNull(encounterTables, "encounterTables");
        this.tableCandidates = java.util.Objects.requireNonNull(tableCandidates, "tableCandidates");
        this.worldPlannerSources = worldPlannerSources;
        this.party = java.util.Objects.requireNonNull(party, "party");
        this.activeParty = java.util.Objects.requireNonNull(activeParty, "activeParty");
        this.activePartyComposition = java.util.Objects.requireNonNull(activePartyComposition, "activePartyComposition");
        this.adventuringDaySummary = java.util.Objects.requireNonNull(adventuringDaySummary, "adventuringDaySummary");
        this.partyMutation = java.util.Objects.requireNonNull(partyMutation, "partyMutation");
    }

    @Override
    public PartyBudgetFacts loadPartyBudgetFacts() {
        ActivePartyCompositionResult compositionResult = activePartyComposition.current();
        AdventuringDayResult adventuringDayResult = adventuringDaySummary.current();
        if (compositionResult.status() != ReadStatus.SUCCESS || adventuringDayResult.status() != ReadStatus.SUCCESS) {
            return PartyBudgetFacts.storageError();
        }
        List<Integer> activeLevels = compositionResult.composition().activePartyLevels();
        if (activeLevels.isEmpty()) {
            return PartyBudgetFacts.noActiveParty();
        }
        return PartyBudgetFacts.success(
                activeLevels,
                compositionResult.composition().averageLevel(),
                adventuringDayResult.summary().consumedXp(),
                adventuringDayResult.summary().totalBudgetXp());
    }

    List<PartyMemberData> loadActiveParty() {
        ActivePartyResult result = activeParty.current();
        if (result.status() != ReadStatus.SUCCESS) {
            return List.of();
        }
        List<PartyMemberData> members = new ArrayList<>();
        for (PartyMemberSummary member : result.members()) {
            if (member != null) {
                members.add(new PartyMemberData(
                        "pc-" + member.id(),
                        member.id(),
                        member.name(),
                        member.level()));
            }
        }
        return List.copyOf(members);
    }

    List<PartyMemberData> loadActiveParty(List<Long> selectedIds) {
        List<Long> ids = selectedIds == null ? List.of() : List.copyOf(selectedIds);
        return loadActiveParty().stream().filter(member -> ids.contains(member.numericId())).toList();
    }

    PartyBudgetFacts loadPartyBudgetFacts(List<Long> selectedIds) {
        List<PartyMemberData> members = loadActiveParty(selectedIds);
        if (members.isEmpty()) {
            return PartyBudgetFacts.noActiveParty();
        }
        List<Integer> levels = members.stream().map(PartyMemberData::level).toList();
        int average = (int) Math.round(levels.stream().mapToInt(Integer::intValue).average().orElse(1.0));
        AdventuringDayResult day = adventuringDaySummary.current();
        int consumed = day.status() == ReadStatus.SUCCESS ? day.summary().consumedXp() : 0;
        int total = day.status() == ReadStatus.SUCCESS ? day.summary().totalBudgetXp() : 0;
        int globalSize = Math.max(1, loadActiveParty().size());
        return PartyBudgetFacts.success(levels, average,
                Math.max(0, consumed * members.size() / globalSize),
                Math.max(0, total * members.size() / globalSize));
    }

    EncounterGenerationRequest withWorldLocation(EncounterGenerationRequest request, long locationId) {
        if (request == null || locationId <= 0L) {
            return request;
        }
        EncounterGenerationInputs input = request.inputs();
        EncounterGenerationInputs scoped = new EncounterGenerationInputs(
                input.creatureTypes(), input.creatureSubtypes(), input.biomes(), input.targetDifficulty(),
                input.tuning(), input.encounterTableIds(), input.worldFactionIds(), locationId, input.finiteCreatureStockCaps());
        return new EncounterGenerationRequest(scoped, request.alternativeCount(), request.generationSeed(),
                request.excludedCreatureIds(), request.lockedCreatures());
    }

    boolean awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        party.awardXp(new AwardPartyXpCommand(partyMemberIds, xpPerCharacter));
        return partyMutation.current().status() == MutationStatus.SUCCESS;
    }

    EncounterGenerationRequest resolveWorldSource(EncounterGenerationRequest request) {
        if (request == null || worldPlannerSources == null || !hasWorldSource(request)) {
            return request;
        }
        SourceState source = SourceState.from(request, worldPlannerSources.current());
        EncounterGenerationInputs original = request.inputs();
        EncounterGenerationInputs resolvedInputs = new EncounterGenerationInputs(
                original.creatureTypes(),
                original.creatureSubtypes(),
                original.biomes(),
                original.targetDifficulty(),
                original.tuning(),
                source.effectiveEncounterTableIds(original.encounterTableIds()),
                original.worldFactionIds(),
                original.worldLocationId(),
                source.invalid() ? Map.of() : source.finiteStockCaps());
        return new EncounterGenerationRequest(
                resolvedInputs,
                request.alternativeCount(),
                request.generationSeed(),
                request.excludedCreatureIds(),
                request.lockedCreatures());
    }

    Optional<CreatureDetailData> loadCreatureDetailData(long creatureId) {
        return loadCreatureReference(creatureId).map(EncounterForeignFacts::toCreatureDetail);
    }

    public Optional<EncounterCreatureReference> loadCreatureReference(long creatureId) {
        requestCreature(creatureId);
        CreatureDetailResult result = creatureDetails.current();
        if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
            return Optional.empty();
        }
        return Optional.of(toReference(result.detail()));
    }

    EncounterCreatureData toCreatureData(GeneratedEncounterCreatureData creature) {
        Optional<CreatureDetailData> detail = loadCreatureDetailData(creature.creatureId());
        if (detail.isPresent()) {
            return detailedCreature(creature, detail.orElseThrow());
        }
        return fallbackCreature(creature);
    }

    List<String> advisoryMessages(boolean autoResolved, boolean fallbackUsed) {
        List<String> messages = new ArrayList<>();
        if (autoResolved) {
            messages.add(AUTO_RESOLVED_MESSAGE);
        }
        if (fallbackUsed) {
            messages.add(FALLBACK_MESSAGE);
        }
        return List.copyOf(messages);
    }

    @Override
    public List<EncounterCandidateProfile> loadCreatureCandidates(EncounterCreatureCandidateCriteria criteria) {
        EncounterCreatureCandidateCriteria safeCriteria = criteria == null
                ? new EncounterCreatureCandidateCriteria(List.of(), List.of(), List.of(), 0, 0, 0)
                : criteria;
        int minimumXp = Math.max(0, safeCriteria.minimumXp());
        int maximumXp = safeCriteria.maximumXp() <= 0 ? Integer.MAX_VALUE : safeCriteria.maximumXp();
        if (minimumXp <= maximumXp) {
            creatures.refreshEncounterCandidates(new RefreshCreatureEncounterCandidatesCommand(
                    safeCriteria.creatureTypes(),
                    safeCriteria.creatureSubtypes(),
                    safeCriteria.biomes(),
                    minimumXp,
                    maximumXp,
                    normalizeLimit(safeCriteria.limit())));
        }
        CreatureEncounterCandidatesResult result = creatureCandidates.current();
        if (result.status() != CreatureQueryStatus.SUCCESS) {
            return List.of();
        }
        List<EncounterCandidateProfile> candidates = new ArrayList<>();
        for (CreatureEncounterCandidate candidate : result.candidates()) {
            candidates.add(EncounterCandidateProfile.fromFacts(toFacts(candidate), candidate.selectionWeight()));
        }
        return List.copyOf(candidates);
    }

    @Override
    public List<EncounterCandidateProfile> loadTableCandidates(EncounterTableCandidateCriteria criteria) {
        EncounterTableCandidateCriteria safeCriteria =
                criteria == null ? new EncounterTableCandidateCriteria(List.of(), 0) : criteria;
        List<Long> normalizedTableIds = normalizedTableIds(safeCriteria.tableIds());
        if (!normalizedTableIds.isEmpty()) {
            refreshTableCandidates(normalizedTableIds, safeCriteria.maximumXp());
        }
        EncounterTableCandidatesResult result = tableCandidates.current();
        if (result.status() != EncounterTableReadStatus.SUCCESS) {
            return List.of();
        }
        List<EncounterCandidateProfile> candidates = new ArrayList<>();
        for (EncounterTableCandidate candidate : result.candidates()) {
            candidates.add(EncounterCandidateProfile.fromFacts(tableFacts(candidate), candidate.weight()));
        }
        return List.copyOf(candidates);
    }

    private void refreshTableCandidates(List<Long> tableIds, int maximumXp) {
        int effectiveMaximumXp = maximumXp <= 0 ? Integer.MAX_VALUE : maximumXp;
        encounterTables.refreshCandidates(new RefreshEncounterTableCandidatesCommand(
                tableIds,
                effectiveMaximumXp));
    }

    private static List<Long> normalizedTableIds(List<Long> tableIds) {
        List<Long> normalizedTableIds = new ArrayList<>();
        for (Long tableId : tableIds == null ? List.<Long>of() : tableIds) {
            if (tableId != null && tableId.longValue() > 0L && !normalizedTableIds.contains(tableId)) {
                normalizedTableIds.add(tableId);
            }
        }
        return List.copyOf(normalizedTableIds);
    }

    private void requestCreature(long creatureId) {
        if (creatureId > UNRESOLVED_ID) {
            creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        }
    }

    private static int normalizeLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_CREATURE_LIMIT;
        }
        return Math.min(limit, MAX_CREATURE_LIMIT);
    }

    private static EncounterCreatureReference toReference(CreatureDetail detail) {
        List<String> actionTypes = new ArrayList<>();
        for (CreatureActionDetail action : detail.actions()) {
            actionTypes.add(action.actionType());
        }
        return new EncounterCreatureReference(
                detail.id(),
                detail.name(),
                detail.creatureType(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.hitDiceCount(),
                detail.hitDiceSides(),
                detail.hitDiceModifier(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.legendaryActionCount(),
                detail.flySpeed(),
                detail.swimSpeed(),
                detail.climbSpeed(),
                detail.burrowSpeed(),
                detail.damageResistances(),
                detail.damageImmunities(),
                detail.conditionImmunities(),
                detail.passivePerception(),
                List.copyOf(actionTypes));
    }

    private static CreatureDetailData toCreatureDetail(EncounterCreatureReference creature) {
        return new CreatureDetailData(
                creature.id(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.hitPoints(),
                creature.armorClass(),
                creature.initiativeBonus(),
                creature.creatureType());
    }

    private static EncounterCreatureData detailedCreature(
            GeneratedEncounterCreatureData creature,
            CreatureDetailData current
    ) {
        return new EncounterCreatureData(
                "monster-" + current.id(),
                current.id(),
                0L,
                current.name(),
                current.challengeRating(),
                current.xp(),
                Math.max(1, current.hitPoints()),
                current.armorClass(),
                current.initiativeBonus(),
                current.creatureType(),
                normalizeRole(creature.role()),
                creature.quantity(),
                creature.tags());
    }

    private static EncounterCreatureData fallbackCreature(GeneratedEncounterCreatureData creature) {
        return new EncounterCreatureData(
                "monster-" + creature.creatureId(),
                creature.creatureId(),
                0L,
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                1,
                10,
                0,
                "",
                normalizeRole(creature.role()),
                creature.quantity(),
                creature.tags());
    }

    private static String normalizeRole(String role) {
        return role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role;
    }

    private static EncounterCreatureFacts toFacts(CreatureEncounterCandidate candidate) {
        return new EncounterCreatureFacts(
                candidate.id(),
                candidate.name(),
                candidate.creatureType(),
                candidate.challengeRating(),
                candidate.xp(),
                candidate.hitPoints(),
                candidate.hitDiceCount(),
                candidate.hitDiceSides(),
                candidate.hitDiceModifier(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount(),
                0,
                0,
                0,
                0,
                null,
                null,
                null,
                0,
                List.of());
    }

    private static EncounterCreatureFacts tableFacts(EncounterTableCandidate candidate) {
        return new EncounterCreatureFacts(
                candidate.creatureId(),
                candidate.name(),
                candidate.creatureType(),
                candidate.challengeRating(),
                candidate.xp(),
                candidate.hitPoints(),
                candidate.hitDiceCount(),
                candidate.hitDiceSides(),
                candidate.hitDiceModifier(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount(),
                0,
                0,
                0,
                0,
                null,
                null,
                null,
                0,
                List.of());
    }

    private static boolean hasWorldSource(EncounterGenerationRequest request) {
        return request.worldLocationId() > UNRESOLVED_ID || !request.worldFactionIds().isEmpty();
    }

    private record SourceState(
            boolean invalid,
            Set<Long> encounterTableIds,
            Map<Long, Integer> finiteStockCaps
    ) {

        static SourceState from(EncounterGenerationRequest request, WorldPlannerSnapshot snapshot) {
            Map<Long, WorldFactionSummary> factions = factionsById(snapshot.factions());
            Map<Long, WorldLocationSummary> locations = locationsById(snapshot.locations());
            Set<Long> selectedFactionIds = new LinkedHashSet<>(request.worldFactionIds());
            Set<Long> sourceTableIds = new LinkedHashSet<>();
            boolean invalid = false;
            if (request.worldLocationId() > UNRESOLVED_ID) {
                WorldLocationSummary location = locations.get(request.worldLocationId());
                invalid = location == null;
                if (location != null) {
                    selectedFactionIds.addAll(location.factionIds());
                    sourceTableIds.addAll(positiveIds(location.encounterTableIds()));
                }
            }
            Map<Long, Integer> finiteCaps = new LinkedHashMap<>();
            Set<Long> unlimitedStatblocks = new LinkedHashSet<>();
            for (Long factionId : selectedFactionIds) {
                WorldFactionSummary faction = factions.get(factionId);
                invalid = invalid || faction == null;
                if (faction == null) {
                    continue;
                }
                if (faction.primaryEncounterTableId() > UNRESOLVED_ID) {
                    sourceTableIds.add(faction.primaryEncounterTableId());
                }
                applyInventoryLimits(finiteCaps, unlimitedStatblocks, faction.inventoryLimits());
            }
            for (Long unlimited : unlimitedStatblocks) {
                finiteCaps.remove(unlimited);
            }
            return new SourceState(invalid, sourceTableIds, finiteCaps);
        }

        List<Long> effectiveEncounterTableIds(List<Long> explicitTableIds) {
            if (invalid) {
                return List.of(NO_MATCHING_TABLE_ID);
            }
            Set<Long> explicit = new LinkedHashSet<>(positiveIds(explicitTableIds));
            if (encounterTableIds.isEmpty()) {
                return List.copyOf(explicit);
            }
            if (explicit.isEmpty()) {
                return List.copyOf(encounterTableIds);
            }
            explicit.retainAll(encounterTableIds);
            return explicit.isEmpty() ? List.of(NO_MATCHING_TABLE_ID) : List.copyOf(explicit);
        }
    }

    private static Map<Long, WorldFactionSummary> factionsById(List<WorldFactionSummary> factions) {
        Map<Long, WorldFactionSummary> byId = new LinkedHashMap<>();
        for (WorldFactionSummary faction : factions == null ? List.<WorldFactionSummary>of() : factions) {
            byId.put(faction.factionId(), faction);
        }
        return byId;
    }

    private static Map<Long, WorldLocationSummary> locationsById(List<WorldLocationSummary> locations) {
        Map<Long, WorldLocationSummary> byId = new LinkedHashMap<>();
        for (WorldLocationSummary location : locations == null ? List.<WorldLocationSummary>of() : locations) {
            byId.put(location.locationId(), location);
        }
        return byId;
    }

    private static void applyInventoryLimits(
            Map<Long, Integer> finiteCaps,
            Set<Long> unlimitedStatblocks,
            List<WorldFactionInventoryLimitSummary> limits
    ) {
        for (WorldFactionInventoryLimitSummary limit : limits == null
                ? List.<WorldFactionInventoryLimitSummary>of()
                : limits) {
            if (!limit.finite()) {
                unlimitedStatblocks.add(limit.creatureStatblockId());
                continue;
            }
            if (!unlimitedStatblocks.contains(limit.creatureStatblockId())) {
                Integer current = finiteCaps.get(limit.creatureStatblockId());
                finiteCaps.put(limit.creatureStatblockId(), Integer.valueOf(
                        (current == null ? 0 : current.intValue()) + limit.quantity()));
            }
        }
    }

    private static List<Long> positiveIds(List<Long> ids) {
        List<Long> positive = new ArrayList<>();
        for (Long id : ids == null ? List.<Long>of() : ids) {
            if (id != null && id.longValue() > UNRESOLVED_ID) {
                positive.add(id);
            }
        }
        return List.copyOf(positive);
    }
}
