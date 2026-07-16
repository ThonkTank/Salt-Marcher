package src.domain.sessionplanner;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.GeneratedEncounterImportResult;
import src.domain.encounter.published.GeneratedEncounterImportResult.ImportedEncounterPlan;
import src.domain.encounter.published.ImportGeneratedEncounterPlansCommand;
import src.domain.encounter.published.ImportGeneratedEncounterPlansCommand.GeneratedCreatureBlock;
import src.domain.encounter.published.ImportGeneratedEncounterPlansCommand.GeneratedEncounterDraft;
import src.domain.sessiongeneration.GenerationRequest;
import src.domain.sessiongeneration.GenerationResult;
import src.domain.sessiongeneration.GenerationResult.EncounterPlan;
import src.domain.sessiongeneration.GenerationResult.TreasureResult;
import src.domain.sessiongeneration.SessionGenerationApplicationService;
import src.domain.sessionplanner.model.session.GeneratedSessionPlan;
import src.domain.sessionplanner.model.session.GeneratedSessionPlan.GeneratedLootReference;
import src.domain.sessionplanner.model.session.GeneratedSessionPlan.GeneratedScene;
import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.published.ApplyGeneratedSessionEncounterLootCommand;
import src.domain.sessionplanner.published.GenerateSessionEncounterLootCommand;
import src.domain.sessionplanner.published.SessionPlannerGenerationModel;
import src.domain.sessionplanner.published.SessionPlannerGenerationProjection;
import src.domain.sessionplanner.published.SessionPlannerGenerationProjection.AuditPreview;
import src.domain.sessionplanner.published.SessionPlannerGenerationProjection.EncounterPreview;
import src.domain.sessionplanner.published.SessionPlannerGenerationProjection.Status;
import src.domain.sessionplanner.published.SessionPlannerGenerationProjection.TreasurePreview;
import src.domain.shared.published.PublishedState;

final class SessionPlannerGenerationWorkflow {

    private final @Nullable SessionGenerationApplicationService generation;
    private final EncounterApplicationService encounters;
    private final SessionPlannerForeignFacts facts;
    private final PublishedState<SessionPlannerGenerationProjection> state =
            new PublishedState<>(SessionPlannerGenerationProjection.idle());
    private final SessionPlannerGenerationModel model = new SessionPlannerGenerationModel(state::current, state::subscribe);

    SessionPlannerGenerationWorkflow(
            @Nullable SessionGenerationApplicationService generation,
            EncounterApplicationService encounters,
            SessionPlannerForeignFacts facts
    ) {
        this.generation = generation;
        this.encounters = java.util.Objects.requireNonNull(encounters, "encounters");
        this.facts = java.util.Objects.requireNonNull(facts, "facts");
    }

    SessionPlannerGenerationModel model() {
        return model;
    }

    void generate(SessionPlan session, GenerateSessionEncounterLootCommand command) {
        if (generation == null) {
            publishError("Session generation is not registered.");
            return;
        }
        Map<Integer, Integer> players = playersByLevel(session);
        if (players.isEmpty()) {
            publishError("Fuege zuerst mindestens einen verfuegbaren Spieler zur Session hinzu.");
            return;
        }
        try {
            GenerationResult result = generation.generate(GenerationRequest.sheetV1(
                    players,
                    session.encounterDays().value(),
                    command.encounterCount(),
                    command.seed()));
            state.publish(toProjection(result, Status.PREVIEW, result.applicable(), "Vorschau ist bereit."));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            publishError(exception.getMessage());
        }
    }

    SessionPlan apply(SessionPlan session, ApplyGeneratedSessionEncounterLootCommand command) {
        if (generation == null) {
            publishError("Session generation is not registered.");
            return session;
        }
        GenerationResult result = generation.load(command.generationId()).orElse(null);
        if (result == null || !result.applicable()) {
            publishError("Die Generator-Vorschau ist nicht mehr anwendbar.");
            return session;
        }
        GeneratedEncounterImportResult imported = encounters.importGeneratedPlans(toImportCommand(result, session.displayName()));
        if (imported.status() != GeneratedEncounterImportResult.Status.SUCCESS) {
            String detail = imported.unresolvedSlots().isEmpty()
                    ? imported.message()
                    : String.join("; ", imported.unresolvedSlots());
            publishError(detail);
            return session;
        }
        SessionPlan replaced = session.replaceWithGeneration(toSessionPlan(result, imported));
        state.publish(toProjection(result, Status.APPLIED, false, "Encounter und Loot wurden uebernommen."));
        return replaced;
    }

    private Map<Integer, Integer> playersByLevel(SessionPlan session) {
        SessionActivePartyMembersFact active = facts.activePartyMembers();
        Map<Integer, Integer> result = new LinkedHashMap<>();
        for (Long participantId : session.participantRefs()) {
            SessionPartyMemberProfile member = active.resolve(participantId);
            if (member != null && member.currentLevel() > 0) {
                result.merge(member.currentLevel(), 1, Integer::sum);
            }
        }
        return Map.copyOf(result);
    }

    private static ImportGeneratedEncounterPlansCommand toImportCommand(GenerationResult result, String sessionName) {
        List<GeneratedEncounterDraft> drafts = result.encounters().stream()
                .map(encounter -> new GeneratedEncounterDraft(
                        encounter.encounterNumber(),
                        sessionName + " · Encounter " + encounter.encounterNumber(),
                        encounter.line(),
                        encounter.blocks().stream().map(block -> new GeneratedCreatureBlock(
                                block.role(), block.challengeRating(), block.unitXp(), block.quantity())).toList()))
                .toList();
        return new ImportGeneratedEncounterPlansCommand(result.generationId(), result.request().seed(), drafts);
    }

    private static GeneratedSessionPlan toSessionPlan(
            GenerationResult result,
            GeneratedEncounterImportResult imported
    ) {
        Map<Integer, Long> planIds = new LinkedHashMap<>();
        for (ImportedEncounterPlan plan : imported.plans()) planIds.put(plan.encounterNumber(), plan.planId());
        List<GeneratedScene> scenes = new ArrayList<>();
        List<TreasureResult> quests = byChannel(result.treasures(), "quest");
        if (!quests.isEmpty()) scenes.add(scene(0L, BigDecimal.ZERO, "Quest Reward", result.generationId(), quests));
        for (EncounterPlan encounter : result.encounters()) {
            BigDecimal allocation = BigDecimal.valueOf(encounter.targetXp())
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(Math.max(1, result.session().sessionXpTarget())), 4, RoundingMode.HALF_UP);
            List<TreasureResult> loot = result.treasures().stream()
                    .filter(treasure -> treasure.anchorEncounterNumber() != null
                            && treasure.anchorEncounterNumber() == encounter.encounterNumber()).toList();
            scenes.add(scene(
                    planIds.getOrDefault(encounter.encounterNumber(), 0L),
                    allocation,
                    "Encounter " + encounter.encounterNumber() + " · " + encounter.difficulty(),
                    result.generationId(),
                    loot));
        }
        List<TreasureResult> environment = byChannel(result.treasures(), "environment");
        if (!environment.isEmpty()) {
            scenes.add(scene(0L, BigDecimal.ZERO, "Environmental Rewards", result.generationId(), environment));
        }
        return new GeneratedSessionPlan(scenes);
    }

    private static GeneratedScene scene(
            long encounterPlanId,
            BigDecimal allocation,
            String title,
            long generationId,
            List<TreasureResult> treasures
    ) {
        List<GeneratedLootReference> loot = treasures.stream()
                .map(treasure -> new GeneratedLootReference(
                        generationId,
                        treasure.treasureId(),
                        treasure.loot().stream().map(GenerationResult.LootLine::text)
                                .reduce((left, right) -> left + " · " + right).orElse("—")))
                .toList();
        return new GeneratedScene(encounterPlanId, allocation, title, loot);
    }

    private static List<TreasureResult> byChannel(List<TreasureResult> treasures, String channel) {
        return treasures.stream().filter(treasure -> channel.equals(treasure.rewardChannel())).toList();
    }

    private static SessionPlannerGenerationProjection toProjection(
            GenerationResult result,
            Status status,
            boolean applyEnabled,
            String message
    ) {
        String summary = result.encounters().size() + " Encounter · "
                + integer(result.session().sessionXpTarget()) + " Ziel-XP · "
                + gp(result.summary().normalActualCp()) + " gp"
                + (result.summary().overstockActualCp() > 0 ? " + " + gp(result.summary().overstockActualCp()) + " gp Overstock" : "")
                + " · " + result.summary().magicCount() + " Magic";
        List<EncounterPreview> encounters = result.encounters().stream()
                .map(encounter -> new EncounterPreview(
                        encounter.encounterNumber(), encounter.line(), encounter.blocks().stream()
                                .map(block -> block.role() + " " + block.quantity() + "x CR " + block.challengeRating())
                                .reduce((left, right) -> left + " · " + right).orElse("")))
                .toList();
        List<TreasurePreview> treasures = result.treasures().stream()
                .map(treasure -> new TreasurePreview(
                        treasure.treasureId(),
                        placement(treasure),
                        gp(treasure.actualCp()) + " gp",
                        treasure.loot().stream().map(GenerationResult.LootLine::text).toList()))
                .toList();
        List<AuditPreview> audits = result.audits().stream()
                .map(audit -> new AuditPreview(audit.name(), audit.passed(), audit.detail())).toList();
        return new SessionPlannerGenerationProjection(
                status,
                result.generationId(),
                summary,
                "Seed " + result.request().seed() + " · sheet-v1 · " + result.dataContentHash().substring(0, 12),
                encounters,
                treasures,
                audits,
                applyEnabled,
                message);
    }

    private static String placement(TreasureResult treasure) {
        if ("quest".equals(treasure.rewardChannel())) return "Quest";
        if ("encounter".equals(treasure.rewardChannel())) return "Encounter " + treasure.anchorEncounterNumber();
        return "Environment";
    }

    private void publishError(String message) {
        state.publish(new SessionPlannerGenerationProjection(
                Status.ERROR, 0L, "", "", List.of(), List.of(), List.of(), false,
                message == null || message.isBlank() ? "Generierung fehlgeschlagen." : message));
    }

    private static String integer(int value) {
        return NumberFormat.getIntegerInstance(Locale.GERMANY).format(value);
    }

    private static String gp(long cp) {
        return BigDecimal.valueOf(cp).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString().replace('.', ',');
    }
}
