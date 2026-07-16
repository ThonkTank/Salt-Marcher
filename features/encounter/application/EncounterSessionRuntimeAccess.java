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
import features.encounter.domain.generation.EncounterCandidateProfile;
import features.encounter.domain.generation.EncounterDifficultyThresholds;
import features.encounter.domain.generation.helper.EncounterDifficultyMathHelper;
import features.encounter.domain.reference.EncounterCreatureCandidateCriteria;
import features.encounter.domain.reference.EncounterCreatureReference;
import features.encounter.domain.reference.EncounterTableCandidateCriteria;
import features.encounter.domain.session.PartyBudgetFacts;

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
        return generateWith(generator, request);
    }

    GenerationResultData generateForParty(
            EncounterGenerationRequest request,
            List<PartyMemberData> partyMembers
    ) {
        List<Integer> partyLevels = partyLevels(partyMembers);
        return generateWith(
                new features.encounter.domain.generation.EncounterGenerator(
                        new ScopedPartyFacts(facts, partyLevels)),
                request);
    }

    Optional<BudgetData> loadBudgetForParty(List<PartyMemberData> partyMembers) {
        List<Integer> partyLevels = partyLevels(partyMembers);
        if (partyLevels.isEmpty()) {
            return Optional.empty();
        }
        EncounterDifficultyThresholds thresholds = EncounterDifficultyMathHelper.thresholdsFor(partyLevels);
        int averageLevel = (int) Math.round(partyLevels.stream()
                .mapToInt(Integer::intValue)
                .average()
                .orElse(1.0));
        return Optional.of(new BudgetData(
                partyLevels,
                averageLevel,
                thresholds.easy(),
                thresholds.medium(),
                thresholds.hard(),
                thresholds.deadly()));
    }

    private GenerationResultData generateWith(
            features.encounter.domain.generation.EncounterGenerator effectiveGenerator,
            EncounterGenerationRequest request
    ) {
        try {
            EncounterGenerationResult result = effectiveGenerator.generate(facts.resolveWorldSource(request));
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

    private static List<Integer> partyLevels(List<PartyMemberData> partyMembers) {
        return (partyMembers == null ? List.<PartyMemberData>of() : partyMembers).stream()
                .map(PartyMemberData::level)
                .toList();
    }

    private static final class ScopedPartyFacts
            implements features.encounter.domain.generation.EncounterGenerator.ForeignFacts {

        private final EncounterForeignFacts delegate;
        private final List<Integer> partyLevels;

        private ScopedPartyFacts(EncounterForeignFacts delegate, List<Integer> partyLevels) {
            this.delegate = delegate;
            this.partyLevels = List.copyOf(partyLevels);
        }

        @Override
        public PartyBudgetFacts loadPartyBudgetFacts() {
            if (partyLevels.isEmpty()) {
                return PartyBudgetFacts.noActiveParty();
            }
            int averageLevel = (int) Math.round(partyLevels.stream()
                    .mapToInt(Integer::intValue)
                    .average()
                    .orElse(1.0));
            return PartyBudgetFacts.success(partyLevels, averageLevel, 0, 0);
        }

        @Override
        public Optional<EncounterCreatureReference> loadCreatureReference(long creatureId) {
            return delegate.loadCreatureReference(creatureId);
        }

        @Override
        public List<EncounterCandidateProfile> loadCreatureCandidates(
                EncounterCreatureCandidateCriteria criteria
        ) {
            return delegate.loadCreatureCandidates(criteria);
        }

        @Override
        public List<EncounterCandidateProfile> loadTableCandidates(EncounterTableCandidateCriteria criteria) {
            return delegate.loadTableCandidates(criteria);
        }
    }
}
