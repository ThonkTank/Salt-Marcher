package src.domain.encounter.model.session.repository;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.model.EncounterGenerationDiagnosticsData;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;
import src.domain.encounter.model.generation.model.GeneratedEncounterCreatureData;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.model.EncounterSessionValues.AwardXpOutcome;
import src.domain.encounter.model.session.model.EncounterSessionValues.BudgetData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CreatureDetailData;
import src.domain.encounter.model.session.model.EncounterSessionValues.EncounterCreatureData;
import src.domain.encounter.model.session.model.EncounterSessionValues.GeneratedEncounterData;
import src.domain.encounter.model.session.model.EncounterSessionValues.GenerationDiagnosticsData;
import src.domain.encounter.model.session.model.EncounterSessionValues.GenerationResultData;
import src.domain.encounter.model.session.model.EncounterSessionValues.ListPlansOutcome;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;
import src.domain.encounter.model.session.model.EncounterSessionValues.PlanOutcome;

public final class EncounterSessionRepository implements EncounterSession.SessionRepository {

    private final EncounterPartyFactsRepository party;
    private final EncounterCreatureRepository creatures;
    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable SaveEncounterPlanUseCase savePlanUseCase;
    private final @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final SessionDataMapper dataMapper = new SessionDataMapper();

    public EncounterSessionRepository(
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            @Nullable EncounterGenerationUseCase generator,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase,
            @Nullable SaveEncounterPlanUseCase savePlanUseCase,
            @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase
    ) {
        this.party = party;
        this.creatures = creatures;
        this.generator = generator;
        this.loadBudgetUseCase = loadBudgetUseCase;
        this.savePlanUseCase = savePlanUseCase;
        this.loadSavedPlanUseCase = loadSavedPlanUseCase;
        this.listSavedPlansUseCase = listSavedPlansUseCase;
    }

    @Override
    public List<PartyMemberData> loadActiveParty() {
        return party.loadActiveParty();
    }

    @Override
    public Optional<BudgetData> loadBudget() {
        LoadEncounterBudgetUseCase useCase = loadBudgetUseCase;
        if (useCase == null) {
            return Optional.empty();
        }
        try {
            LoadEncounterBudgetUseCase.Result result = useCase.execute();
            return result.status().isSuccess() && result.budget() != null
                    ? Optional.of(toSessionBudget(result.budget()))
                    : Optional.empty();
        } catch (IllegalStateException exception) {
            return Optional.empty();
        }
    }

    @Override
    public GenerationResultData generate(EncounterGenerationRequest request) {
        EncounterGenerationUseCase useCase = generator;
        if (useCase == null) {
            return new GenerationResultData(false, List.of(), "Encounter generator service is not registered.", Optional.empty(), false);
        }
        try {
            EncounterGenerationUseCase.GenerateResult result = useCase.execute(request);
            return new GenerationResultData(
                    result.success(),
                    result.encounters().stream()
                            .map(encounter -> dataMapper.toGeneratedEncounter(
                                    encounter,
                                    result.autoResolved(),
                                    result.fallbackUsed()))
                            .toList(),
                    result.message(),
                    SessionDataMapper.toDiagnostics(result.diagnostics()),
                    result.fallbackUsed());
        } catch (IllegalStateException exception) {
            return new GenerationResultData(false, List.of(), "Encounter generation failed.", Optional.empty(), false);
        }
    }

    @Override
    public PlanOutcome savePlan(EncounterPlan plan) {
        SaveEncounterPlanUseCase useCase = savePlanUseCase;
        if (useCase == null) {
            return new PlanOutcome(Optional.empty(), "Encounter plan storage is not registered.");
        }
        try {
            EncounterPlan savedPlan = useCase.execute(
                    Math.max(0L, plan.id()),
                    plan.name(),
                    plan.generatedLabel(),
                    plan.creatures());
            return new PlanOutcome(Optional.of(savedPlan), "Encounter saved.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), SessionDataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan is invalid."));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), SessionDataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan could not be saved."));
        }
    }

    @Override
    public PlanOutcome loadPlan(long planId) {
        LoadSavedEncounterPlanUseCase useCase = loadSavedPlanUseCase;
        if (useCase == null) {
            return new PlanOutcome(Optional.empty(), "Encounter plan storage is not registered.");
        }
        try {
            Optional<EncounterPlan> loadedPlan = useCase.execute(planId);
            return loadedPlan.isPresent()
                    ? new PlanOutcome(loadedPlan, "Encounter loaded.")
                    : new PlanOutcome(Optional.empty(), "Encounter plan not found.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), SessionDataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan id must be positive."));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), SessionDataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan could not be loaded."));
        }
    }

    @Override
    public ListPlansOutcome listPlans() {
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            return new ListPlansOutcome(false, List.of(), "Encounter plan storage is not registered.");
        }
        src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult result = useCase.execute();
        return new ListPlansOutcome(
                result.loadedSuccessfully(),
                result.plans(),
                result.message());
    }

    @Override
    public Optional<CreatureDetailData> loadCreature(long creatureId) {
        return creatures.loadCreature(creatureId).map(SessionDataMapper::toCreatureDetail);
    }

    @Override
    public AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        return new AwardXpOutcome(party.awardXp(partyMemberIds, xpPerCharacter));
    }

    private final class SessionDataMapper {

        private static final String DEFAULT_CREATURE_ROLE = "Creature";
        private static final String AUTO_RESOLVED_MESSAGE =
                "Auto-Einstellungen wurden fuer diese Generierung auf konkrete Zielwerte aufgeloest.";
        private static final String FALLBACK_MESSAGE =
                "Kein exakter Treffer war verfuegbar. Die beste gefundene Alternative wurde uebernommen.";

        private GeneratedEncounterData toGeneratedEncounter(
                EncounterGenerationUseCase.GeneratedAlternative encounter,
                boolean autoResolved,
                boolean fallbackUsed
        ) {
            return new GeneratedEncounterData(
                    encounter.title(),
                    difficultyLabel(encounter.achievedDifficulty()),
                    encounter.adjustedXp(),
                    encounter.creatures().stream().map(this::toCreature).toList(),
                    advisoryMessages(autoResolved, fallbackUsed));
        }

        private EncounterCreatureData toCreature(GeneratedEncounterCreatureData creature) {
            Optional<CreatureDetailData> detail = loadCreature(creature.creatureId());
            if (detail.isPresent()) {
                CreatureDetailData current = detail.orElseThrow();
                return new EncounterCreatureData(
                        "monster-" + current.id(),
                        current.id(),
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
            return new EncounterCreatureData(
                    "monster-" + creature.creatureId(),
                    creature.creatureId(),
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

        private List<String> advisoryMessages(boolean autoResolved, boolean fallbackUsed) {
            List<String> messages = new java.util.ArrayList<>();
            if (autoResolved) {
                messages.add(AUTO_RESOLVED_MESSAGE);
            }
            if (fallbackUsed) {
                messages.add(FALLBACK_MESSAGE);
            }
            return List.copyOf(messages);
        }

        private String normalizeRole(String role) {
            return role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role;
        }

        private static Optional<GenerationDiagnosticsData> toDiagnostics(
                @Nullable EncounterGenerationDiagnosticsData diagnostics
        ) {
            if (diagnostics == null) {
                return Optional.empty();
            }
            return Optional.of(new GenerationDiagnosticsData(
                    difficultyLabel(diagnostics.resolvedDifficulty()),
                    tuningLabel(diagnostics.resolvedTuning())));
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

        private static String defaultMessage(@Nullable String message, String fallback) {
            return message == null || message.isBlank() ? fallback : message;
        }
    }

    private static BudgetData toSessionBudget(EncounterDifficultyMathHelper.BudgetSummary budget) {
        return new BudgetData(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold());
    }

    private static String difficultyLabel(EncounterDifficultyIntent band) {
        EncounterDifficultyIntent effective = band == null ? EncounterDifficultyIntent.MEDIUM : band;
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
