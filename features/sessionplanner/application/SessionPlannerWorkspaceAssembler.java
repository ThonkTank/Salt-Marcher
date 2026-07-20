package features.sessionplanner.application;

import features.encounter.api.EncounterApi;
import features.encounter.api.GeneratedEncounterBatchStatus;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchResult;
import features.encounter.api.GeneratedEncounterPlanSummaryEntry;
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
import features.sessionplanner.api.SessionEncounterPlanSearchSnapshot;
import features.sessionplanner.api.SessionPlannerParticipantsProjection;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSelectedSceneSnapshot;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
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
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;

/** Assembles one coherent workspace from one planner capture and bounded owner reads. */
public final class SessionPlannerWorkspaceAssembler {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final String ENCOUNTER_FAILURE = "Encounter-Details konnten nicht geladen werden.";
    private static final String REWARD_FAILURE = "Generierte Belohnungen konnten nicht geladen werden.";
    private static final DiagnosticId WORKSPACE_ASSEMBLY =
            new DiagnosticId("sessionplanner.workspace.assembly");

    private final SessionPlannerWorkspaceSource source;
    private final PartyApi party;
    private final EncounterApi encounters;
    private final SessionGenerationApi generation;
    private final @Nullable WorldPlannerSnapshotModel worldPlanner;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;

    public SessionPlannerWorkspaceAssembler(
            SessionPlannerWorkspaceSource source,
            PartyApi party,
            EncounterApi encounters,
            SessionGenerationApi generation,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.source = Objects.requireNonNull(source, "source");
        this.party = Objects.requireNonNull(party, "party");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.generation = Objects.requireNonNull(generation, "generation");
        this.worldPlanner = worldPlanner;
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public CompletionStage<SessionPlannerWorkspaceAssembly> assemble(SessionPreparationSnapshot preparation) {
        long startedNanos = System.nanoTime();
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
        return plannerRead.thenCompose(capture -> hydrate(capture, safePreparation).thenApply(result -> {
            diagnostics.measurement(new Measurement(
                    WORKSPACE_ASSEMBLY,
                    safePreparation.attemptId(),
                    Math.max(0L, System.nanoTime() - startedNanos),
                    result.workspace().sceneTimeline().sceneHeaders().size(),
                    capture.queryCount()));
            return result;
        }));
    }

    private CompletionStage<SessionPlannerWorkspaceAssembly> hydrate(
            SessionPlannerReadCapture capture,
            SessionPreparationSnapshot preparation
    ) {
        Optional<SessionPlan> selected = capture.currentSession();
        PreparedSceneCatalogSnapshot prepared = preparedScenes(capture);
        if (selected.isEmpty()) {
            return partyCapture(List.of(), 0).thenApply(partyCapture -> {
                SessionPlannerWorkspaceSnapshot empty = new SessionPlannerWorkspaceSnapshot(
                        0L, 0L, 0L, catalog(capture, ""),
                        SessionPlannerSessionSnapshot.empty("Keine Session verfügbar."),
                        participants(List.of(), partyCapture.response()),
                        SessionPlannerSceneTimelineProjection.empty(),
                        SessionPlannerSelectedSceneSnapshot.empty(), preparation, partyCapture.issues());
                return new SessionPlannerWorkspaceAssembly(empty, prepared);
            });
        }

        SessionPlan session = selected.orElseThrow();
        SessionEncounter selectedScene = selectedScene(session);
        WorldCapture world = captureWorld();
        List<Long> planIds = encounterPlanIds(session);
        List<RewardRef> rewardRefs = rewardReferences(session, selectedScene == null ? 0L : selectedScene.encounterId());
        CompletionStage<EncounterCapture> encounterStage = encounterCapture(planIds);
        CompletionStage<RewardCapture> rewardStage = rewardCapture(rewardRefs);
        return encounterStage.thenCompose(encounterCapture -> {
            int plannedXp = plannedXp(session, encounterCapture.byId());
            return partyCapture(session.participantRefs(), plannedXp).thenCombine(rewardStage, (partyCapture, rewards) -> assemble(
                    capture, session, preparation, world, encounterCapture,
                    partyCapture, rewards, prepared));
        });
    }

    private CompletionStage<PartyCapture> partyCapture(List<Long> participantIds, int plannedXp) {
        CompletionStage<PartyPlanningFactsResponse> stage;
        try {
            stage = party.loadPlanningFacts(new PartyPlanningFactsQuery(participantIds, plannedXp));
        } catch (RuntimeException failure) {
            stage = CompletableFuture.completedFuture(
                    PartyPlanningFactsResponse.failure("Party-Planungsdaten konnten nicht geladen werden."));
        }
        if (stage == null) {
            stage = CompletableFuture.completedFuture(
                    PartyPlanningFactsResponse.failure("Party-Planungsdaten konnten nicht geladen werden."));
        }
        return stage.handle((response, failure) -> normalizeParty(
                failure == null ? response : PartyPlanningFactsResponse.failure(
                        "Party-Planungsdaten konnten nicht geladen werden."),
                participantIds));
    }

    private SessionPlannerWorkspaceAssembly assemble(
            SessionPlannerReadCapture capture,
            SessionPlan session,
            SessionPreparationSnapshot preparation,
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
        SessionPlannerParticipantsProjection participants = participants(
                session.participantRefs(), partyCapture.response());
        int scaledBudgetXp = scaledBudget(session, partyCapture.response());
        SessionPlannerSceneTimelineProjection timeline = timeline(
                session, scaledBudgetXp, encounter.byId(), world.locations());
        SessionPlannerSelectedSceneSnapshot selectedScene = selectedScene(
                session, scaledBudgetXp, encounter.byId(), rewards.byReference(), world.locations());
        SessionPlannerSessionSnapshot current = currentSession(
                session, partyCapture.response(), participants, scaledBudgetXp,
                encounter.byId());
        SessionPlannerWorkspaceSnapshot workspace = new SessionPlannerWorkspaceSnapshot(
                0L,
                session.sessionId(),
                session.revision().value(),
                catalog(capture, session.statusText()),
                current,
                participants,
                timeline,
                selectedScene,
                preparation,
                issues);
        return new SessionPlannerWorkspaceAssembly(workspace, preparedScenes);
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
                    .map(location -> new SessionPlannerSelectedSceneSnapshot.LocationChoice(
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
        Map<RewardRef, SessionPlannerSelectedSceneSnapshot.GeneratedReward> values = new LinkedHashMap<>();
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
                        == SessionPlannerSelectedSceneSnapshot.Availability.UNAVAILABLE)
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

    private static SessionPlannerSelectedSceneSnapshot.GeneratedReward availableReward(
            RewardRef ref,
            GenerationRewardBatchResponse.ResolvedReward reward
    ) {
        GenerationResult.Treasure treasure = reward.treasure();
        return new SessionPlannerSelectedSceneSnapshot.GeneratedReward(
                ref.runId(), ref.treasureId(), SessionPlannerSelectedSceneSnapshot.Availability.AVAILABLE,
                "", "", treasure.stockClass().name(), treasure.channel().name(),
                treasure.anchorEncounterNumber(), treasure.theme(), treasure.magicType(), treasure.targetCp(),
                treasure.nonMagicSlots(), treasure.magicSlots(),
                reward.lootItems().stream().map(line -> new SessionPlannerSelectedSceneSnapshot.ItemLine(
                        line.lineId(), line.role().name(), line.itemId(), line.text(), line.quantity(), line.unitCp(),
                        line.actualCp(), line.totalCapacity(), line.allowedContainers(), line.magicRarity(),
                        line.cursed())).toList(),
                reward.packing().stream().map(packing -> new SessionPlannerSelectedSceneSnapshot.Packing(
                        packing.lineId(), packing.containerType(), packing.containerCount(), packing.containerId(),
                        packing.valid())).toList());
    }

    private static SessionPlannerSelectedSceneSnapshot.GeneratedReward unavailableReward(
            RewardRef ref,
            String message
    ) {
        return new SessionPlannerSelectedSceneSnapshot.GeneratedReward(
                ref.runId(), ref.treasureId(), SessionPlannerSelectedSceneSnapshot.Availability.UNAVAILABLE,
                message, ref.fallbackLabel(), "", "", 0, "", "", 0L, 0, 0, List.of(), List.of());
    }

    private static RewardCapture failedRewards(List<RewardRef> requested, String message) {
        Map<RewardRef, SessionPlannerSelectedSceneSnapshot.GeneratedReward> values = new LinkedHashMap<>();
        requested.forEach(ref -> values.put(ref, unavailableReward(ref, message)));
        return new RewardCapture(Map.copyOf(values), List.of(issue(
                SessionPlannerWorkspaceSnapshot.Owner.SESSION_GENERATION,
                SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE, "", message)));
    }

    private static RewardCapture malformedRewards(List<RewardRef> requested) {
        String message = "Generierte Belohnungen waren widersprüchlich und wurden verworfen.";
        Map<RewardRef, SessionPlannerSelectedSceneSnapshot.GeneratedReward> values = new LinkedHashMap<>();
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
                        session.sessionId(), session.revision().value(), session.displayName())).toList(),
                capture.currentSessionId(), status);
    }

    private static SessionPlannerParticipantsProjection participants(
            List<Long> participantIds,
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
            participantIds.forEach(id -> participants.add(
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
        int size = participantIds.size();
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
            Map<Long, EncounterFact> encounters
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
        String status = session.statusText();
        if (status.isBlank() && !participants.party().ready()) {
            status = session.participantRefs().isEmpty()
                    ? "Session hat noch keine Teilnehmer."
                    : "Session enthält nicht mehr auflösbare Teilnehmer-Referenzen.";
        }
        return new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(
                        session.sessionId(), session.displayName(), session.encounterDays().value(),
                        session.encounterDays().displayText(), session.selectedEncounterId(),
                        session.selectedEncounterId() > 0L),
                xp, rests, status);
    }

    private static SessionPlannerSceneTimelineProjection timeline(
            SessionPlan session,
            int scaledBudget,
            Map<Long, EncounterFact> encounters,
            List<SessionPlannerSelectedSceneSnapshot.LocationChoice> locations
    ) {
        List<SessionPlannerSceneTimelineProjection.SceneHeader> scenes = new ArrayList<>();
        for (int index = 0; index < session.encounters().size(); index++) {
            SessionEncounter scene = session.encounters().get(index);
            EncounterFact encounter = scene.encounterPlanId() > 0L
                    ? encounters.getOrDefault(scene.encounterPlanId(),
                            EncounterFact.unavailable(scene.encounterPlanId(), ENCOUNTER_FAILURE))
                    : EncounterFact.unavailable(0L, "");
            int targetXp = scene.allocation().budgetPercentage().multiply(BigDecimal.valueOf(scaledBudget))
                    .divide(HUNDRED, 0, RoundingMode.HALF_UP).intValue();
            String displayTitle = scene.sceneTitle().isBlank() ? "Unbenannte Szene" : scene.sceneTitle();
            scenes.add(new SessionPlannerSceneTimelineProjection.SceneHeader(
                    scene.encounterId(), displayTitle, scene.encounterPlanId(), scene.encounterPlanId() > 0L,
                    encounter.name(), encounter.generatedLabel(), encounter.creatureCount(), encounter.adjustedXp(),
                    encounter.difficulty(), encounter.status(), scene.allocation().budgetPercentage(), targetXp,
                    session.selectedEncounterId() == scene.encounterId(), locationLabel(scene.locationId(), locations),
                    index > 0, index < session.encounters().size() - 1));
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

    private static SessionPlannerSelectedSceneSnapshot selectedScene(
            SessionPlan session,
            int scaledBudget,
            Map<Long, EncounterFact> encounters,
            Map<RewardRef, SessionPlannerSelectedSceneSnapshot.GeneratedReward> rewards,
            List<SessionPlannerSelectedSceneSnapshot.LocationChoice> locations
    ) {
        SessionEncounter selected = selectedScene(session);
        if (selected == null) {
            return SessionPlannerSelectedSceneSnapshot.empty();
        }
        EncounterFact encounter = selected.encounterPlanId() > 0L
                ? encounters.getOrDefault(selected.encounterPlanId(),
                        EncounterFact.unavailable(selected.encounterPlanId(), ENCOUNTER_FAILURE))
                : EncounterFact.unavailable(0L, "");
        int targetXp = selected.allocation().budgetPercentage().multiply(BigDecimal.valueOf(scaledBudget))
                .divide(HUNDRED, 0, RoundingMode.HALF_UP).intValue();
        List<SessionPlannerSelectedSceneSnapshot.ManualLootNote> notes = session.manualLootNotes().stream()
                .filter(note -> note.sceneId() == selected.encounterId())
                .map(note -> new SessionPlannerSelectedSceneSnapshot.ManualLootNote(
                        note.noteId(), note.authoredText())).toList();
        List<SessionPlannerSelectedSceneSnapshot.GeneratedReward> generated = session.generatedRewards().stream()
                .filter(reward -> reward.sceneId() == selected.encounterId())
                .map(RewardRef::from)
                .map(ref -> rewards.getOrDefault(ref, unavailableReward(ref, REWARD_FAILURE))).toList();
        return new SessionPlannerSelectedSceneSnapshot(
                true, selected.encounterId(), selected.sceneTitle(), selected.sceneNotes(), selected.locationId(),
                locationChoices(selected.locationId(), locations), selected.allocation().budgetPercentage(), targetXp,
                selected.encounterPlanId(), selected.encounterPlanId() > 0L, encounter.name(),
                encounter.generatedLabel(), encounter.creatureCount(), encounter.baseXp(), encounter.adjustedXp(),
                encounter.multiplier(), encounter.difficulty(), encounter.status(), encounter.roster(), notes,
                generated, SessionEncounterPlanSearchSnapshot.idle());
    }

    private static SessionEncounter selectedScene(SessionPlan session) {
        return session.encounters().stream()
                .filter(scene -> scene.encounterId() == session.selectedEncounterId())
                .findFirst().orElse(null);
    }

    private static String locationLabel(
            long locationId,
            List<SessionPlannerSelectedSceneSnapshot.LocationChoice> locations
    ) {
        if (locationId <= 0L) {
            return "Keine Location";
        }
        return locations.stream().filter(location -> location.locationId() == locationId)
                .map(SessionPlannerSelectedSceneSnapshot.LocationChoice::displayName)
                .findFirst().orElse("Location #" + locationId);
    }

    private static List<SessionPlannerSelectedSceneSnapshot.LocationChoice> locationChoices(
            long selectedLocationId,
            List<SessionPlannerSelectedSceneSnapshot.LocationChoice> locations
    ) {
        List<SessionPlannerSelectedSceneSnapshot.LocationChoice> choices = new ArrayList<>();
        choices.add(new SessionPlannerSelectedSceneSnapshot.LocationChoice(0L, "Keine Location"));
        choices.addAll(locations);
        if (selectedLocationId > 0L && locations.stream().noneMatch(item -> item.locationId() == selectedLocationId)) {
            choices.add(new SessionPlannerSelectedSceneSnapshot.LocationChoice(
                    selectedLocationId, "Location #" + selectedLocationId));
        }
        return List.copyOf(choices);
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

    private static List<Long> encounterPlanIds(SessionPlan session) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        session.encounters().stream().map(SessionEncounter::encounterPlanId)
                .filter(id -> id > 0L).forEach(ids::add);
        return List.copyOf(ids);
    }

    private static List<RewardRef> rewardReferences(SessionPlan session, long selectedSceneToken) {
        LinkedHashMap<String, RewardRef> unique = new LinkedHashMap<>();
        session.generatedRewards().stream()
                .filter(reward -> reward.sceneId() == selectedSceneToken)
                .map(RewardRef::from)
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
            Map<RewardRef, SessionPlannerSelectedSceneSnapshot.GeneratedReward> byReference,
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
            List<SessionPlannerSelectedSceneSnapshot.LocationChoice> locations,
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
            List<SessionPlannerSelectedSceneSnapshot.EncounterRosterLine> roster,
            String status
    ) {
        private static EncounterFact available(GeneratedEncounterPlanSummary summary) {
            double multiplier = summary.baseXp() <= 0L ? 1.0 : summary.adjustedXp() / (double) summary.baseXp();
            return new EncounterFact(
                    true, summary.planId(), summary.label(), summary.label(), summary.creatureCount(),
                    Math.toIntExact(summary.baseXp()), Math.toIntExact(summary.adjustedXp()), multiplier,
                    summary.difficulty().name(), summary.displaySummary(), summary.roster().stream()
                            .map(line -> new SessionPlannerSelectedSceneSnapshot.EncounterRosterLine(
                                    line.creatureId(), line.quantity(), line.displayName()))
                            .toList(), "");
        }

        private static EncounterFact unavailable(long planId, String status) {
            return new EncounterFact(false, planId, "", "", 0, 0, 0, 1.0, "", "", List.of(), status);
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
