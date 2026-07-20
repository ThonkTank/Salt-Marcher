package features.encounter.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import features.creatures.api.CreaturesApi;
import features.creatures.api.CreatureActionDetail;
import features.creatures.api.CreatureDetail;
import features.creatures.api.CreatureDetailModel;
import features.creatures.api.CreatureDetailResult;
import features.creatures.api.CreatureEncounterCandidate;
import features.creatures.api.CreatureEncounterCandidatesModel;
import features.creatures.api.CreatureEncounterCandidatesResult;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.RefreshCreatureEncounterCandidatesCommand;
import features.creatures.api.SelectCreatureDetailCommand;
import features.encounter.domain.generation.EncounterCandidateProfile;
import features.encounter.domain.generation.EncounterCreatureFacts;
import features.encounter.domain.generation.EncounterGenerationInputs;
import features.encounter.domain.generation.EncounterGenerationRequest;
import features.encounter.domain.generation.GeneratedEncounterCreatureData;
import features.encounter.domain.generation.EncounterGenerator;
import features.encounter.domain.reference.EncounterCreatureCandidateCriteria;
import features.encounter.domain.reference.EncounterCreatureReference;
import features.encounter.domain.reference.EncounterTableCandidateCriteria;
import features.encounter.domain.session.CreatureDetailData;
import features.encounter.domain.session.EncounterCreatureData;
import features.encounter.domain.session.PartyBudgetFacts;
import features.encounter.domain.session.PartyMemberData;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCandidate;
import features.encountertable.api.EncounterTableCandidatesModel;
import features.encountertable.api.EncounterTableCandidatesResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.RefreshEncounterTableCandidatesCommand;
import features.party.api.PartyApi;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyCompositionResult;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.AdventuringDayResult;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.AwardPartyXpCommand;
import features.party.api.MutationStatus;
import features.party.api.PartyMemberSummary;
import features.party.api.PartyMutationModel;
import features.party.api.ReadStatus;
import features.worldplanner.api.WorldFactionInventoryLimitSummary;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;

public final class EncounterForeignFacts implements EncounterGenerator.ForeignFacts {

    private static final int DEFAULT_CREATURE_LIMIT = 250;
    private static final int MAX_CREATURE_LIMIT = 1000;
    private static final long UNRESOLVED_ID = 0L;
    private static final long NO_MATCHING_TABLE_ID = -1L;
    private static final String DEFAULT_CREATURE_ROLE = "Creature";
    private static final String AUTO_RESOLVED_MESSAGE =
            "Auto-Einstellungen wurden fuer diese Generierung auf konkrete Zielwerte aufgeloest.";
    private static final String FALLBACK_MESSAGE =
            "Kein exakter Treffer war verfuegbar. Die beste gefundene Alternative wurde uebernommen.";

    private final CreaturesApi creatures;
    private final CreatureDetailModel creatureDetails;
    private final CreatureEncounterCandidatesModel creatureCandidates;
    private final EncounterTableApi encounterTables;
    private final EncounterTableCandidatesModel tableCandidates;
    private final WorldPlannerSnapshotModel worldPlannerSources;
    private final PartyApi party;
    private final ActivePartyModel activeParty;
    private final ActivePartyCompositionModel activePartyComposition;
    private final AdventuringDaySummaryModel adventuringDaySummary;
    private final PartyMutationModel partyMutation;

    public EncounterForeignFacts(
            CreaturesApi creatures,
            CreatureDetailModel creatureDetails,
            CreatureEncounterCandidatesModel creatureCandidates,
            EncounterTableApi encounterTables,
            EncounterTableCandidatesModel tableCandidates,
            WorldPlannerSnapshotModel worldPlannerSources,
            PartyApi party,
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
                original.nameQuery(),
                original.challengeRatingMin(),
                original.challengeRatingMax(),
                original.sizes(),
                original.alignments(),
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
                    safeCriteria.nameQuery(),
                    safeCriteria.challengeRatingMin(),
                    safeCriteria.challengeRatingMax(),
                    safeCriteria.sizes(),
                    safeCriteria.alignments(),
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
