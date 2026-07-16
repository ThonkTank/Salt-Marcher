package src.domain.encounter;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.generation.EncounterGenerationResult;
import src.domain.encounter.model.generation.EncounterGeneratedAlternative;
import src.domain.encounter.model.generation.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.model.plan.EncounterPlan;
import src.domain.encounter.model.session.AwardXpOutcome;
import src.domain.encounter.model.session.BudgetData;
import src.domain.encounter.model.session.CreatureDetailData;
import src.domain.encounter.model.session.EncounterCreatureData;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.GeneratedEncounterData;
import src.domain.encounter.model.session.GenerationDiagnosticsData;
import src.domain.encounter.model.session.GenerationResultData;
import src.domain.encounter.model.session.ListPlansOutcome;
import src.domain.encounter.model.session.PartyMemberData;
import src.domain.encounter.model.session.PlanOutcome;
import src.domain.encounter.model.generation.GeneratedEncounterCreatureData;

final class EncounterSessionRuntimeAccess implements EncounterSession.SessionRepository {

    private final EncounterForeignFacts facts;
    private final EncounterPlanGateway plans;
    private final src.domain.encounter.model.generation.EncounterGenerator generator;

    EncounterSessionRuntimeAccess(
            EncounterForeignFacts facts,
            EncounterPlanGateway plans,
            src.domain.encounter.model.generation.EncounterGenerator generator
    ) {
        this.facts = java.util.Objects.requireNonNull(facts, "facts");
        this.plans = java.util.Objects.requireNonNull(plans, "plans");
        this.generator = java.util.Objects.requireNonNull(generator, "generator");
    }

    @Override
    public List<PartyMemberData> loadActiveParty() {
        return facts.loadActiveParty();
    }

    @Override
    public Optional<BudgetData> loadBudget() {
        return plans.loadBudget();
    }

    @Override
    public GenerationResultData generate(EncounterGenerationRequest request) {
        try {
            EncounterGenerationResult result = generator.generate(facts.resolveWorldSource(request));
            return generationData(result);
        } catch (IllegalStateException exception) {
            return new GenerationResultData(false, List.of(), "Encounter generation failed.", Optional.empty(), false);
        }
    }

    @Override
    public PlanOutcome savePlan(EncounterPlan plan) {
        return plans.savePlan(plan);
    }

    @Override
    public PlanOutcome loadPlan(long planId) {
        return plans.loadPlan(planId);
    }

    @Override
    public ListPlansOutcome listPlans() {
        return plans.listPlansForSession();
    }

    @Override
    public Optional<CreatureDetailData> loadCreature(long creatureId) {
        return facts.loadCreatureDetailData(creatureId);
    }

    @Override
    public AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        return new AwardXpOutcome(facts.awardXp(partyMemberIds, xpPerCharacter));
    }

    private GenerationResultData generationData(EncounterGenerationResult result) {
        List<GeneratedEncounterData> encounters = result.encounters().stream()
                .map(encounter -> generatedEncounter(encounter, result.autoResolved(), result.fallbackUsed()))
                .toList();
        return new GenerationResultData(
                result.success(),
                encounters,
                result.message(),
                diagnostics(result),
                result.fallbackUsed());
    }

    private GeneratedEncounterData generatedEncounter(
            EncounterGeneratedAlternative encounter,
            boolean autoResolved,
            boolean fallbackUsed
    ) {
        return new GeneratedEncounterData(
                encounter.title(),
                difficultyLabel(encounter.achievedDifficulty()),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(this::toCreature).toList(),
                facts.advisoryMessages(autoResolved, fallbackUsed));
    }

    private EncounterCreatureData toCreature(GeneratedEncounterCreatureData creature) {
        return facts.toCreatureData(creature);
    }

    private Optional<GenerationDiagnosticsData> diagnostics(EncounterGenerationResult result) {
        if (result.diagnostics() == null) {
            return Optional.empty();
        }
        return Optional.of(new GenerationDiagnosticsData(
                difficultyLabel(result.diagnostics().resolvedDifficulty()),
                tuningLabel(result.diagnostics().resolvedTuning())));
    }

    private static String difficultyLabel(EncounterDifficultyIntent band) {
        EncounterDifficultyIntent effective = band == null ? EncounterDifficultyIntent.defaultIntent() : band;
        return switch (effective.name()) {
            case "EASY" -> "Easy";
            case "HARD" -> "Hard";
            case "DEADLY" -> "Deadly";
            default -> "Medium";
        };
    }

    private static String tuningLabel(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }
}
