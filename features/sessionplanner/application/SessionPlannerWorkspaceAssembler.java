package features.sessionplanner.application;

import features.encounter.api.EncounterApi;
import features.encounter.api.GeneratedEncounterBatchStatus;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchResult;
import features.encounter.api.GeneratedEncounterPlanSummaryEntry;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.SavedEncounterPlanSummary;
import features.party.api.PartyApi;
import features.party.api.PartyMemberSummary;
import features.party.api.PartyPlanningFactsQuery;
import features.party.api.PartyPlanningFactsResponse;
import features.party.api.ReadStatus;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRewardReference;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.sessionplanner.api.PreparedSceneSource;
import features.sessionplanner.api.SessionPlannerCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerParticipantsProjection;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
import features.sessionplanner.api.SessionPlannerStatePanelProjection;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionManualLootNote;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRestPlacement;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;
import platform.execution.ExecutionLane;

/** Assembles one coherent workspace from one planner capture and bounded owner reads. */
public final class SessionPlannerWorkspaceAssembler {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final String ENCOUNTER_FAILURE = "Encounter-Details konnten nicht geladen werden.";
    private static final String REWARD_FAILURE = "Generierte Belohnungen konnten nicht geladen werden.";

    private final SessionPlannerWorkspaceSource source;
    private final PartyApi party;
    private final EncounterApi encounters;
    private final SavedEncounterPlanListModel savedPlans;
    private final SessionGenerationApi generation;
    private final @Nullable WorldPlannerSnapshotModel worldPlanner;
    private final ExecutionLane executionLane;

    public SessionPlannerWorkspaceAssembler(
            SessionPlannerWorkspaceSource source,
            PartyApi party,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            SessionGenerationApi generation,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            ExecutionLane executionLane
    ) {
        this.source = Objects.requireNonNull(source, "source");
        this.party = Objects.requireNonNull(party, "party");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.savedPlans = Objects.requireNonNull(savedPlans, "savedPlans");
        this.generation = Objects.requireNonNull(generation, "generation");
        this.worldPlanner = worldPlanner;
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
    }

    public CompletionStage<SessionPlannerWorkspaceAssembly> assemble(SessionPreparationSnapshot preparation) {
        CompletableFuture<SessionPlannerReadCapture> plannerRead = new CompletableFuture<>();
        try {
            executionLane.execute(() -> {
                try {
                    plannerRead.complete(source.readWorkspace());
                } catch (RuntimeException failure) {
                    plannerRead.completeExceptionally(failure);
                }
            });
        } catch (RuntimeException failure) {
            plannerRead.completeExceptionally(failure);
        }
        SessionPreparationSnapshot safePreparation = preparation == null
                ? SessionPreparationSnapshot.idle() : preparation;
        return plannerRead.thenCompose(capture -> hydrate(capture, safePreparation));
    }

    private CompletionStage<SessionPlannerWorkspaceAssembly> hydrate(
            SessionPlannerReadCapture capture,
            SessionPreparationSnapshot preparation
    ) {
        Optional<SessionPlan> selected = capture.currentSession();
        PreparedSceneCatalogSnapshot prepared = preparedScenes(capture);
        if (selected.isEmpty()) {
            SessionPlannerWorkspaceSnapshot empty = new SessionPlannerWorkspaceSnapshot(
                    0L, 0L, 0L, catalog(capture, ""),
                    SessionPlannerSessionSnapshot.empty("Keine Session verfügbar."),
                    SessionPlannerParticipantsProjection.empty(), SessionPlannerSceneTimelineProjection.empty(),
                    SessionPlannerStatePanelProjection.empty(), preparation, List.of());
            return CompletableFuture.completedFuture(new SessionPlannerWorkspaceAssembly(empty, prepared));
        }

        SessionPlan session = selected.orElseThrow();
        SavedEncounterPlanListResult planCatalog = safeSavedPlans();
        WorldCapture world = captureWorld();
        List<Long> planIds = encounterPlanIds(session, planCatalog);
        List<RewardRef> rewardRefs = rewardReferences(session);
        CompletionStage<EncounterCapture> encounterStage = encounterCapture(planIds);
        CompletionStage<RewardCapture> rewardStage = rewardCapture(rewardRefs);
        return encounterStage.thenCompose(encounterCapture -> {
            int plannedXp = plannedXp(session, encounterCapture.byId());
            CompletionStage<PartyPlanningFactsResponse> partyStage;
            try {
                partyStage = party.loadPlanningFacts(new PartyPlanningFactsQuery(session.participantRefs(), plannedXp));
            } catch (RuntimeException failure) {
                partyStage = CompletableFuture.completedFuture(
                        PartyPlanningFactsResponse.failure("Party-Planungsdaten konnten nicht geladen werden."));
            }
            return partyStage.thenCombine(rewardStage, (partyFacts, rewards) -> assemble(
                    capture, session, preparation, planCatalog, world, encounterCapture,
                    normalizeParty(partyFacts, session.participantRefs()), rewards, prepared));
        });
    }

    private SessionPlannerWorkspaceAssembly assemble(
            SessionPlannerReadCapture capture,
            SessionPlan session,
            SessionPreparationSnapshot preparation,
            SavedEncounterPlanListResult planCatalog,
            WorldCapture world,
            EncounterCapture encounter,
            PartyCapture partyCapture,
            RewardCapture rewards,
            PreparedSceneCatalogSnapshot preparedScenes
    ) {
        List<SessionPlannerWorkspaceSnapshot.Issue> issues = new ArrayList<>();
        issues.addAll(world.issues());
        issues.addAll(encounter.issues());
        issues.addAll(partyCapture.issues());
        issues.addAll(rewards.issues());
        SessionPlannerParticipantsProjection participants = participants(session, partyCapture.response());
        int scaledBudgetXp = scaledBudget(session, partyCapture.response());
        SessionPlannerSceneTimelineProjection timeline = timeline(
                session, scaledBudgetXp, encounter.byId(), rewards.byReference());
        SessionPlannerSessionSnapshot current = currentSession(
                session, partyCapture.response(), participants, scaledBudgetXp,
                encounter.byId(), planCatalog, world.locations());
        SessionPlannerWorkspaceSnapshot workspace = new SessionPlannerWorkspaceSnapshot(
                0L,
                session.sessionId(),
                session.revision().value(),
                catalog(capture, session.statusText()),
                current,
                participants,
                timeline,
                statePanel(session, timeline),
                preparation,
                issues);
        return new SessionPlannerWorkspaceAssembly(workspace, preparedScenes);
    }

    private SavedEncounterPlanListResult safeSavedPlans() {
        try {
            return savedPlans.current();
        } catch (RuntimeException failure) {
            return new SavedEncounterPlanListResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), ENCOUNTER_FAILURE);
        }
    }

    private WorldCapture captureWorld() {
        if (worldPlanner == null) {
            return new WorldCapture(List.of(), List.of());
        }
        try {
            WorldPlannerSnapshot snapshot = worldPlanner.current();
            if (snapshot.status() != WorldPlannerReadStatus.SUCCESS) {
                return new WorldCapture(List.of(), List.of(issue(
                        SessionPlannerWorkspaceSnapshot.Owner.WORLD_PLANNER,
                        SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE, "", "World-Planner-Orte sind nicht verfügbar.")));
            }
            return new WorldCapture(snapshot.locations().stream()
                    .map(location -> new SessionPlannerSessionSnapshot.LocationReference(
                            location.locationId(), location.displayName()))
                    .toList(), List.of());
        } catch (RuntimeException failure) {
            return new WorldCapture(List.of(), List.of(issue(
                    SessionPlannerWorkspaceSnapshot.Owner.WORLD_PLANNER,
                    SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE, "", "World-Planner-Orte sind nicht verfügbar.")));
        }
    }

    private CompletionStage<EncounterCapture> encounterCapture(List<Long> planIds) {
        if (planIds.isEmpty()) {
            return CompletableFuture.completedFuture(new EncounterCapture(Map.of(), List.of()));
        }
        CompletionStage<GeneratedEncounterPlanSummaryBatchResult> stage;
        try {
            stage = encounters.loadGeneratedPlanSummaries(new GeneratedEncounterPlanSummaryBatchQuery(planIds));
        } catch (RuntimeException failure) {
            return CompletableFuture.completedFuture(failedEncounters(planIds, ENCOUNTER_FAILURE));
        }
        if (stage == null) {
            return CompletableFuture.completedFuture(failedEncounters(planIds, ENCOUNTER_FAILURE));
        }
        return stage.handle((response, failure) -> failure == null
                ? validateEncounters(planIds, response)
                : failedEncounters(planIds, ENCOUNTER_FAILURE));
    }

    private static EncounterCapture validateEncounters(
            List<Long> requested,
            GeneratedEncounterPlanSummaryBatchResult response
    ) {
        if (response == null || response.status() != GeneratedEncounterBatchStatus.SUCCESS
                || response.entries().size() != requested.size()) {
            return failedEncounters(requested, ENCOUNTER_FAILURE);
        }
        Map<Long, EncounterFact> values = new LinkedHashMap<>();
        List<SessionPlannerWorkspaceSnapshot.Issue> issues = new ArrayList<>();
        for (int index = 0; index < requested.size(); index++) {
            long planId = requested.get(index);
            GeneratedEncounterPlanSummaryEntry entry = response.entries().get(index);
            if (entry == null || entry.requestedPlanId() != planId || values.containsKey(planId)) {
                return malformedEncounters(requested);
            }
            if (entry.status() == GeneratedEncounterPlanSummaryEntry.Status.FOUND) {
                GeneratedEncounterPlanSummary summary = entry.summary().orElse(null);
                if (summary == null || summary.planId() != planId) {
                    return malformedEncounters(requested);
                }
                try {
                    values.put(planId, EncounterFact.available(summary));
                } catch (RuntimeException failure) {
                    return malformedEncounters(requested);
                }
            } else {
                String message = entry.status() == GeneratedEncounterPlanSummaryEntry.Status.MISSING
                        ? "Encounter-Plan fehlt." : "Encounter-Plan ist nicht auflösbar.";
                values.put(planId, EncounterFact.unavailable(planId, message));
                issues.add(issue(SessionPlannerWorkspaceSnapshot.Owner.ENCOUNTER,
                        SessionPlannerWorkspaceSnapshot.Kind.UNAVAILABLE, Long.toString(planId), message));
            }
        }
        return new EncounterCapture(Map.copyOf(values), List.copyOf(issues));
    }

    private static EncounterCapture failedEncounters(List<Long> requested, String message) {
        Map<Long, EncounterFact> values = new LinkedHashMap<>();
        requested.forEach(id -> values.put(id, EncounterFact.unavailable(id, message)));
        return new EncounterCapture(Map.copyOf(values), List.of(issue(
                SessionPlannerWorkspaceSnapshot.Owner.ENCOUNTER,
                SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE, "", message)));
    }

    private static EncounterCapture malformedEncounters(List<Long> requested) {
        String message = "Encounter-Details waren widersprüchlich und wurden verworfen.";
        Map<Long, EncounterFact> values = new LinkedHashMap<>();
        requested.forEach(id -> values.put(id, EncounterFact.unavailable(id, message)));
        return new EncounterCapture(Map.copyOf(values), List.of(issue(
                SessionPlannerWorkspaceSnapshot.Owner.ENCOUNTER,
                SessionPlannerWorkspaceSnapshot.Kind.MALFORMED_RESPONSE, "", message)));
    }

    private CompletionStage<RewardCapture> rewardCapture(List<RewardRef> requested) {
        if (requested.isEmpty()) {
            return CompletableFuture.completedFuture(new RewardCapture(Map.of(), List.of()));
        }
        List<GenerationRewardReference> queryRefs = requested.stream().map(RewardRef::apiReference).toList();
        CompletionStage<GenerationRewardBatchResponse> stage;
        try {
            stage = generation.loadRewards(new GenerationRewardBatchQuery(queryRefs));
        } catch (RuntimeException failure) {
            return CompletableFuture.completedFuture(failedRewards(requested, REWARD_FAILURE));
        }
        if (stage == null) {
            return CompletableFuture.completedFuture(failedRewards(requested, REWARD_FAILURE));
        }
        return stage.handle((response, failure) -> failure == null
                ? validateRewards(requested, response)
                : failedRewards(requested, REWARD_FAILURE));
    }

    private static RewardCapture validateRewards(
            List<RewardRef> requested,
            GenerationRewardBatchResponse response
    ) {
        if (response == null || response.status() != GenerationStatus.SUCCESS) {
            return failedRewards(requested, REWARD_FAILURE);
        }
        Map<GenerationRewardReference, RewardRef> requestedByApi = new LinkedHashMap<>();
        requested.forEach(ref -> requestedByApi.put(ref.apiReference(), ref));
        Map<RewardRef, SessionPlannerSceneTimelineProjection.GeneratedReward> values = new LinkedHashMap<>();
        Set<GenerationRewardReference> seen = new LinkedHashSet<>();
        try {
            for (GenerationRewardBatchResponse.ResolvedReward resolved : response.resolved()) {
                RewardRef ref = requestedByApi.get(resolved.reference());
                if (ref == null || !seen.add(resolved.reference()) || !validResolvedReward(resolved)) {
                    return malformedRewards(requested);
                }
                values.put(ref, availableReward(ref, resolved));
            }
            for (GenerationRewardReference missing : response.missing()) {
                RewardRef ref = requestedByApi.get(missing);
                if (ref == null || !seen.add(missing)) {
                    return malformedRewards(requested);
                }
                values.put(ref, unavailableReward(ref, "Generierte Belohnung fehlt."));
            }
        } catch (RuntimeException failure) {
            return malformedRewards(requested);
        }
        if (!seen.equals(requestedByApi.keySet())) {
            return malformedRewards(requested);
        }
        List<SessionPlannerWorkspaceSnapshot.Issue> issues = requested.stream()
                .filter(ref -> values.get(ref).availability()
                        == SessionPlannerSceneTimelineProjection.Availability.UNAVAILABLE)
                .map(ref -> issue(SessionPlannerWorkspaceSnapshot.Owner.SESSION_GENERATION,
                        SessionPlannerWorkspaceSnapshot.Kind.UNAVAILABLE, ref.stableReference(),
                        "Generierte Belohnung fehlt."))
                .toList();
        return new RewardCapture(Map.copyOf(values), issues);
    }

    private static boolean validResolvedReward(GenerationRewardBatchResponse.ResolvedReward reward) {
        GenerationResult.Treasure treasure = reward.treasure();
        if (treasure.treasureId() != reward.reference().treasureId()) {
            return false;
        }
        Set<Integer> lineIds = new LinkedHashSet<>();
        for (GenerationResult.LootItem line : reward.lootItems()) {
            if (line.treasureId() != treasure.treasureId() || line.lineId() <= 0 || !lineIds.add(line.lineId())) {
                return false;
            }
        }
        Set<Integer> packed = new LinkedHashSet<>();
        for (GenerationResult.Packing packing : reward.packing()) {
            if (packing.treasureId() != treasure.treasureId()
                    || !lineIds.contains(packing.lineId()) || !packed.add(packing.lineId())) {
                return false;
            }
        }
        return packed.equals(lineIds);
    }

    private static SessionPlannerSceneTimelineProjection.GeneratedReward availableReward(
            RewardRef ref,
            GenerationRewardBatchResponse.ResolvedReward reward
    ) {
        GenerationResult.Treasure treasure = reward.treasure();
        return new SessionPlannerSceneTimelineProjection.GeneratedReward(
                ref.runId(), ref.treasureId(), SessionPlannerSceneTimelineProjection.Availability.AVAILABLE,
                "", "", treasure.stockClass().name(), treasure.channel().name(),
                treasure.anchorEncounterNumber(), treasure.theme(), treasure.magicType(), treasure.targetCp(),
                treasure.nonMagicSlots(), treasure.magicSlots(),
                reward.lootItems().stream().map(line -> new SessionPlannerSceneTimelineProjection.ItemLine(
                        line.lineId(), line.role().name(), line.itemId(), line.text(), line.quantity(), line.unitCp(),
                        line.actualCp(), line.totalCapacity(), line.allowedContainers(), line.magicRarity(),
                        line.cursed())).toList(),
                reward.packing().stream().map(packing -> new SessionPlannerSceneTimelineProjection.Packing(
                        packing.lineId(), packing.containerType(), packing.containerCount(), packing.containerId(),
                        packing.valid())).toList());
    }

    private static SessionPlannerSceneTimelineProjection.GeneratedReward unavailableReward(
            RewardRef ref,
            String message
    ) {
        return new SessionPlannerSceneTimelineProjection.GeneratedReward(
                ref.runId(), ref.treasureId(), SessionPlannerSceneTimelineProjection.Availability.UNAVAILABLE,
                message, ref.fallbackLabel(), "", "", 0, "", "", 0L, 0, 0, List.of(), List.of());
    }

    private static RewardCapture failedRewards(List<RewardRef> requested, String message) {
        Map<RewardRef, SessionPlannerSceneTimelineProjection.GeneratedReward> values = new LinkedHashMap<>();
        requested.forEach(ref -> values.put(ref, unavailableReward(ref, message)));
        return new RewardCapture(Map.copyOf(values), List.of(issue(
                SessionPlannerWorkspaceSnapshot.Owner.SESSION_GENERATION,
                SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE, "", message)));
    }

    private static RewardCapture malformedRewards(List<RewardRef> requested) {
        String message = "Generierte Belohnungen waren widersprüchlich und wurden verworfen.";
        Map<RewardRef, SessionPlannerSceneTimelineProjection.GeneratedReward> values = new LinkedHashMap<>();
        requested.forEach(ref -> values.put(ref, unavailableReward(ref, message)));
        return new RewardCapture(Map.copyOf(values), List.of(issue(
                SessionPlannerWorkspaceSnapshot.Owner.SESSION_GENERATION,
                SessionPlannerWorkspaceSnapshot.Kind.MALFORMED_RESPONSE, "", message)));
    }

    private static PartyCapture normalizeParty(PartyPlanningFactsResponse response, List<Long> requestedIds) {
        if (response == null || response.status() != ReadStatus.SUCCESS
                || response.participants().size() != requestedIds.size()) {
            PartyPlanningFactsResponse failure = PartyPlanningFactsResponse.failure(
                    "Party-Planungsdaten konnten nicht geladen werden.");
            return new PartyCapture(failure, List.of(issue(
                    SessionPlannerWorkspaceSnapshot.Owner.PARTY,
                    SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE, "",
                    "Party-Planungsdaten konnten nicht geladen werden.")));
        }
        Set<Long> activeIds = new LinkedHashSet<>();
        if (response.activeMembers().stream().anyMatch(member -> member == null || member.id() == null
                || member.id() <= 0L || !activeIds.add(member.id()))) {
            return malformedParty();
        }
        for (int index = 0; index < requestedIds.size(); index++) {
            PartyPlanningFactsResponse.ResolvedParticipant participant = response.participants().get(index);
            if (participant == null || participant.requestedId() != requestedIds.get(index)
                    || participant.available() && !Objects.equals(
                            participant.requestedId(), participant.member().id())) {
                return malformedParty();
            }
        }
        List<SessionPlannerWorkspaceSnapshot.Issue> issues = response.participants().stream()
                .filter(participant -> !participant.available())
                .map(participant -> issue(SessionPlannerWorkspaceSnapshot.Owner.PARTY,
                        SessionPlannerWorkspaceSnapshot.Kind.UNAVAILABLE,
                        Long.toString(participant.requestedId()), "Session-Teilnehmer ist nicht verfügbar."))
                .toList();
        return new PartyCapture(response, issues);
    }

    private static PartyCapture malformedParty() {
        return new PartyCapture(
                PartyPlanningFactsResponse.failure("Party-Planungsdaten waren widersprüchlich."),
                List.of(issue(SessionPlannerWorkspaceSnapshot.Owner.PARTY,
                        SessionPlannerWorkspaceSnapshot.Kind.MALFORMED_RESPONSE, "",
                        "Party-Planungsdaten waren widersprüchlich und wurden verworfen.")));
    }

    private static SessionPlannerCatalogSnapshot catalog(SessionPlannerReadCapture capture, String status) {
        return new SessionPlannerCatalogSnapshot(
                capture.sessions().stream().map(session -> new SessionPlannerCatalogSnapshot.SessionSummary(
                        session.sessionId(), session.displayName())).toList(),
                capture.currentSessionId(), status);
    }

    private static SessionPlannerParticipantsProjection participants(
            SessionPlan session,
            PartyPlanningFactsResponse facts
    ) {
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants = new ArrayList<>();
        if (facts.status() == ReadStatus.SUCCESS) {
            for (PartyPlanningFactsResponse.ResolvedParticipant resolved : facts.participants()) {
                PartyMemberSummary member = resolved.member();
                participants.add(member == null
                        ? new SessionPlannerParticipantsProjection.SessionParticipant(
                                resolved.requestedId(), "Charakter #" + resolved.requestedId(), 0, false,
                                "Nicht mehr in der aktiven Party verfügbar.")
                        : new SessionPlannerParticipantsProjection.SessionParticipant(
                                resolved.requestedId(), member.name(), member.level(), true, ""));
            }
        } else {
            session.participantRefs().forEach(id -> participants.add(
                    new SessionPlannerParticipantsProjection.SessionParticipant(
                            id, "Charakter #" + id, 0, false, "Party-Planungsdaten nicht verfügbar.")));
        }
        List<Integer> levels = participants.stream()
                .filter(SessionPlannerParticipantsProjection.SessionParticipant::available)
                .map(SessionPlannerParticipantsProjection.SessionParticipant::level).toList();
        int average = levels.isEmpty() ? 0
                : (int) Math.round(levels.stream().mapToInt(Integer::intValue).average().orElse(0.0));
        long missing = participants.stream()
                .filter(participant -> !participant.available()).count();
        int size = session.participantRefs().size();
        String detail = size == 0 ? "Session hat noch keine Teilnehmer."
                : missing > 0 ? levels.size() + " aufgelöst · " + missing + " fehlend"
                : "Durchschnittsstufe " + average + " · Level " + joinLevels(levels);
        return new SessionPlannerParticipantsProjection(
                new SessionPlannerParticipantsProjection.PartyState(
                        levels, size, average, size > 0 && missing == 0,
                        size == 0 ? "Keine Session-Teilnehmer" : size + " Session-Teilnehmer", detail),
                facts.status() == ReadStatus.SUCCESS
                        ? facts.activeMembers().stream().map(member -> new SessionPlannerParticipantsProjection.ActivePartyMember(
                                member.id(), member.name(), member.level())).toList() : List.of(),
                participants);
    }

    private static int scaledBudget(SessionPlan session, PartyPlanningFactsResponse facts) {
        return facts.status() == ReadStatus.SUCCESS
                ? session.encounterDays().scaleBudget(facts.adventuringDay().totalBudgetXp()) : 0;
    }

    private static SessionPlannerSessionSnapshot currentSession(
            SessionPlan session,
            PartyPlanningFactsResponse party,
            SessionPlannerParticipantsProjection participants,
            int scaledBudget,
            Map<Long, EncounterFact> encounters,
            SavedEncounterPlanListResult planCatalog,
            List<SessionPlannerSessionSnapshot.LocationReference> locations
    ) {
        int plannedXp = plannedXp(session, encounters);
        int remaining = Math.max(0, scaledBudget - plannedXp);
        int over = Math.max(0, plannedXp - scaledBudget);
        boolean budgetAvailable = party.status() == ReadStatus.SUCCESS && participants.party().ready();
        SessionPlannerSessionSnapshot.XpBudgetState xp = budgetAvailable
                ? new SessionPlannerSessionSnapshot.XpBudgetState(
                        true, scaledBudget, plannedXp, remaining, over,
                        session.encounterDays().scaleBudget(party.adventuringDay().firstShortRestXp()),
                        session.encounterDays().scaleBudget(party.adventuringDay().secondShortRestXp()),
                        scaledBudget <= 0 ? 0.0 : plannedXp / (double) scaledBudget,
                        over > 0, over > 0 ? over + " XP über Budget" : remaining + " XP verbleibend")
                : SessionPlannerSessionSnapshot.XpBudgetState.empty();
        SessionPlannerSessionSnapshot.RestAdviceState rests = budgetAvailable
                ? new SessionPlannerSessionSnapshot.RestAdviceState(
                        true, party.adventuringDay().recommendedShortRests(),
                        party.adventuringDay().recommendedLongRests(), countShortRests(session.restPlacements()),
                        countLongRests(session.restPlacements()),
                        "Empfohlen " + party.adventuringDay().recommendedShortRests() + " SR / "
                                + party.adventuringDay().recommendedLongRests() + " LR · platziert "
                                + countShortRests(session.restPlacements()) + " SR / "
                                + countLongRests(session.restPlacements()) + " LR")
                : SessionPlannerSessionSnapshot.RestAdviceState.empty();
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> available = planCatalog.status()
                == SavedEncounterPlanStatus.SUCCESS
                ? planCatalog.plans().stream().map(plan -> availablePlan(plan, encounters.get(plan.planId()))).toList()
                : List.of();
        String status = session.statusText();
        if (status.isBlank() && !participants.party().ready()) {
            status = session.participantRefs().isEmpty()
                    ? "Session hat noch keine Teilnehmer."
                    : "Session enthält nicht mehr auflösbare Teilnehmer-Referenzen.";
        }
        if (status.isBlank() && planCatalog.status() != SavedEncounterPlanStatus.SUCCESS) {
            status = ENCOUNTER_FAILURE;
        }
        return new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(
                        session.sessionId(), session.displayName(), session.encounterDays().value(),
                        session.encounterDays().displayText(), session.selectedEncounterId(),
                        session.selectedEncounterId() > 0L),
                xp, rests, SessionPlannerSessionSnapshot.GoldBudgetState.manualNotes(session.manualLootNotes().size()),
                available, locations, status);
    }

    private static SessionPlannerSessionSnapshot.AvailableEncounterPlan availablePlan(
            SavedEncounterPlanSummary plan,
            @Nullable EncounterFact fact
    ) {
        EncounterFact detail = fact == null ? EncounterFact.unavailable(plan.planId(), ENCOUNTER_FAILURE) : fact;
        return new SessionPlannerSessionSnapshot.AvailableEncounterPlan(
                plan.planId(), detail.name().isBlank() ? plan.name() : detail.name(),
                detail.available() ? detail.displaySummary() : plan.summaryText(), detail.adjustedXp(),
                detail.difficulty(), detail.status(), detail.available());
    }

    private static SessionPlannerSceneTimelineProjection timeline(
            SessionPlan session,
            int scaledBudget,
            Map<Long, EncounterFact> encounters,
            Map<RewardRef, SessionPlannerSceneTimelineProjection.GeneratedReward> rewards
    ) {
        List<SessionPlannerSceneTimelineProjection.SessionScene> scenes = new ArrayList<>();
        for (SessionEncounter scene : session.encounters()) {
            EncounterFact encounter = scene.encounterPlanId() > 0L
                    ? encounters.getOrDefault(scene.encounterPlanId(),
                            EncounterFact.unavailable(scene.encounterPlanId(), ENCOUNTER_FAILURE))
                    : EncounterFact.unavailable(0L, "");
            int targetXp = scene.allocation().budgetPercentage().multiply(BigDecimal.valueOf(scaledBudget))
                    .divide(HUNDRED, 0, RoundingMode.HALF_UP).intValue();
            List<SessionPlannerSceneTimelineProjection.ManualLootNote> notes = session.manualLootNotes().stream()
                    .filter(note -> note.sceneId() == scene.encounterId())
                    .map(note -> new SessionPlannerSceneTimelineProjection.ManualLootNote(
                            note.noteId(), note.authoredText())).toList();
            List<SessionPlannerSceneTimelineProjection.GeneratedReward> generated = session.generatedRewards().stream()
                    .filter(reward -> reward.sceneId() == scene.encounterId())
                    .map(RewardRef::from)
                    .map(ref -> rewards.getOrDefault(ref, unavailableReward(ref, REWARD_FAILURE))).toList();
            scenes.add(new SessionPlannerSceneTimelineProjection.SessionScene(
                    scene.encounterId(), scene.encounterPlanId(), scene.encounterPlanId() > 0L,
                    encounter.name(), encounter.generatedLabel(), encounter.creatureCount(), encounter.baseXp(),
                    encounter.adjustedXp(), encounter.multiplier(), encounter.difficulty(),
                    scene.allocation().budgetPercentage(), targetXp,
                    session.selectedEncounterId() == scene.encounterId(), scene.sceneTitle(), scene.sceneNotes(),
                    scene.locationId(), notes, generated));
        }
        List<SessionPlannerSceneTimelineProjection.RestGap> gaps = new ArrayList<>();
        for (int index = 0; index < session.encounters().size() - 1; index++) {
            SessionEncounter left = session.encounters().get(index);
            SessionEncounter right = session.encounters().get(index + 1);
            gaps.add(new SessionPlannerSceneTimelineProjection.RestGap(
                    index, left.encounterId(), right.encounterId(), restKind(
                            left.encounterId(), right.encounterId(), session.restPlacements())));
        }
        return new SessionPlannerSceneTimelineProjection(scenes, gaps);
    }

    private static SessionPlannerStatePanelProjection statePanel(
            SessionPlan session,
            SessionPlannerSceneTimelineProjection timeline
    ) {
        SessionPlannerSceneTimelineProjection.SessionScene selected = timeline.sessionScenes().stream()
                .filter(SessionPlannerSceneTimelineProjection.SessionScene::selected).findFirst().orElse(null);
        if (selected == null) {
            return SessionPlannerStatePanelProjection.empty();
        }
        String title = !selected.sceneTitle().isBlank() ? selected.sceneTitle()
                : !selected.linkedEncounterName().isBlank() ? selected.linkedEncounterName()
                : "Szene #" + selected.sceneToken();
        String detail = selected.linkedEncounterPlan()
                ? selected.linkedEncounterCreatureCount() + " Kreaturen"
                : "Keine verknüpfte Encounter-Planung";
        String xp = selected.budgetPercentage().stripTrailingZeros().toPlainString()
                + "% Budget · Ziel " + selected.targetXp() + " XP · Ist "
                + selected.linkedEncounterAdjustedXp() + " XP";
        return new SessionPlannerStatePanelProjection(
                true, title, detail, xp, "Ausgewählte Szene #" + session.selectedEncounterId(),
                "Katalog-Vorbereitung", "Planner-owned read-only Placeholder.");
    }

    private static PreparedSceneCatalogSnapshot preparedScenes(SessionPlannerReadCapture capture) {
        List<PreparedSceneSource> scenes = capture.sessions().stream().flatMap(session -> session.encounters().stream()
                .map(scene -> new PreparedSceneSource(
                        session.sessionId(), session.displayName(), scene.encounterId(), scene.sceneTitle(),
                        scene.sceneNotes(), scene.locationId(), scene.encounterPlanId(), session.participantRefs())))
                .toList();
        long revision = capture.sessions().stream().mapToLong(session -> session.revision().value()).sum();
        return new PreparedSceneCatalogSnapshot(revision, scenes, "");
    }

    private static List<Long> encounterPlanIds(SessionPlan session, SavedEncounterPlanListResult catalog) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        session.encounters().stream().map(SessionEncounter::encounterPlanId)
                .filter(id -> id > 0L).forEach(ids::add);
        if (catalog.status() == SavedEncounterPlanStatus.SUCCESS) {
            catalog.plans().stream().map(SavedEncounterPlanSummary::planId)
                    .filter(id -> id > 0L).forEach(ids::add);
        }
        return List.copyOf(ids);
    }

    private static List<RewardRef> rewardReferences(SessionPlan session) {
        LinkedHashMap<String, RewardRef> unique = new LinkedHashMap<>();
        session.generatedRewards().stream().map(RewardRef::from)
                .forEach(ref -> unique.putIfAbsent(ref.stableReference(), ref));
        return List.copyOf(unique.values());
    }

    private static SessionPlannerRestKind restKind(
            long left,
            long right,
            List<SessionRestPlacement> placements
    ) {
        return placements.stream().filter(rest -> rest.matchesGap(left, right)).findFirst()
                .map(rest -> rest.isLongRest() ? SessionPlannerRestKind.LONG_REST
                        : SessionPlannerRestKind.SHORT_REST)
                .orElse(SessionPlannerRestKind.NONE);
    }

    private static int countShortRests(List<SessionRestPlacement> placements) {
        return (int) placements.stream().filter(SessionRestPlacement::isShortRest).count();
    }

    private static int countLongRests(List<SessionRestPlacement> placements) {
        return (int) placements.stream().filter(SessionRestPlacement::isLongRest).count();
    }

    private static int plannedXp(SessionPlan session, Map<Long, EncounterFact> encounters) {
        long total = session.encounters().stream()
                .mapToLong(scene -> encounters.getOrDefault(
                        scene.encounterPlanId(), EncounterFact.unavailable(scene.encounterPlanId(), "")).adjustedXp())
                .sum();
        return (int) Math.min(Integer.MAX_VALUE, Math.max(0L, total));
    }

    private static String joinLevels(List<Integer> levels) {
        return levels.stream().map(String::valueOf).reduce((left, right) -> left + ", " + right).orElse("-");
    }

    private static SessionPlannerWorkspaceSnapshot.Issue issue(
            SessionPlannerWorkspaceSnapshot.Owner owner,
            SessionPlannerWorkspaceSnapshot.Kind kind,
            String reference,
            String message
    ) {
        return new SessionPlannerWorkspaceSnapshot.Issue(owner, kind, reference, message);
    }

    private record EncounterCapture(
            Map<Long, EncounterFact> byId,
            List<SessionPlannerWorkspaceSnapshot.Issue> issues
    ) {
        private EncounterCapture {
            byId = Map.copyOf(byId);
            issues = List.copyOf(issues);
        }
    }

    private record RewardCapture(
            Map<RewardRef, SessionPlannerSceneTimelineProjection.GeneratedReward> byReference,
            List<SessionPlannerWorkspaceSnapshot.Issue> issues
    ) {
        private RewardCapture {
            byReference = Map.copyOf(byReference);
            issues = List.copyOf(issues);
        }
    }

    private record PartyCapture(
            PartyPlanningFactsResponse response,
            List<SessionPlannerWorkspaceSnapshot.Issue> issues
    ) {
        private PartyCapture {
            response = Objects.requireNonNull(response, "response");
            issues = List.copyOf(issues);
        }
    }

    private record WorldCapture(
            List<SessionPlannerSessionSnapshot.LocationReference> locations,
            List<SessionPlannerWorkspaceSnapshot.Issue> issues
    ) {
        private WorldCapture {
            locations = List.copyOf(locations);
            issues = List.copyOf(issues);
        }
    }

    private record EncounterFact(
            boolean available,
            long planId,
            String name,
            String generatedLabel,
            int creatureCount,
            int baseXp,
            int adjustedXp,
            double multiplier,
            String difficulty,
            String displaySummary,
            String status
    ) {
        private static EncounterFact available(GeneratedEncounterPlanSummary summary) {
            double multiplier = summary.baseXp() <= 0L ? 1.0 : summary.adjustedXp() / (double) summary.baseXp();
            return new EncounterFact(
                    true, summary.planId(), summary.label(), summary.label(), summary.creatureCount(),
                    Math.toIntExact(summary.baseXp()), Math.toIntExact(summary.adjustedXp()), multiplier,
                    summary.difficulty().name(), summary.displaySummary(), "");
        }

        private static EncounterFact unavailable(long planId, String status) {
            return new EncounterFact(false, planId, "", "", 0, 0, 0, 1.0, "", "", status);
        }
    }

    private record RewardRef(
            String runId,
            int treasureId,
            String fallbackLabel
    ) {
        private static RewardRef from(SessionGeneratedRewardReference reference) {
            return new RewardRef(
                    reference.generationId(), Math.toIntExact(reference.treasureId()), reference.lastKnownLabel());
        }

        private GenerationRewardReference apiReference() {
            return new GenerationRewardReference(new GenerationRunId(runId), treasureId);
        }

        private String stableReference() {
            return runId + ":" + treasureId;
        }
    }
}
