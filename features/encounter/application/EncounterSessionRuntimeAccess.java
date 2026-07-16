package features.encounter.application;

import java.util.List;
import java.util.Optional;
import features.encounter.domain.generation.EncounterGenerationRequest;
import features.encounter.domain.generation.EncounterGenerationResult;
import features.encounter.domain.generation.EncounterGeneratedAlternative;
import features.encounter.domain.generation.EncounterDifficultyIntent;
import features.encounter.domain.generation.EncounterTuningIntent;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.session.AwardXpOutcome;
import features.encounter.domain.session.BudgetData;
import features.encounter.domain.session.CreatureDetailData;
import features.encounter.domain.session.EncounterCreatureData;
import features.encounter.domain.session.EncounterSession;
import features.encounter.domain.session.GeneratedEncounterData;
import features.encounter.domain.session.GenerationDiagnosticsData;
import features.encounter.domain.session.GenerationResultData;
import features.encounter.domain.session.ListPlansOutcome;
import features.encounter.domain.session.PartyMemberData;
import features.encounter.domain.session.PlanOutcome;
import features.encounter.domain.generation.GeneratedEncounterCreatureData;

public final class EncounterSessionRuntimeAccess implements EncounterSession.SessionRepository {

    private final EncounterForeignFacts facts;
    private final EncounterPlanGateway plans;
    private final features.encounter.domain.generation.EncounterGenerator generator;

    public EncounterSessionRuntimeAccess(
            EncounterForeignFacts facts,
            EncounterPlanGateway plans,
            features.encounter.domain.generation.EncounterGenerator generator
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
