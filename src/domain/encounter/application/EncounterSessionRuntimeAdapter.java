package src.domain.encounter.application;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.published.EncounterCreature;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterGenerationDiagnostics;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class EncounterSessionRuntimeAdapter implements EncounterSession.RuntimeAccess {

    private static final String DEFAULT_CREATURE_ROLE = "Creature";

    private final EncounterPartyFactsRepository party;
    private final CreaturesApplicationService creatures;
    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable SaveEncounterPlanUseCase savePlanUseCase;
    private final @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;

    public EncounterSessionRuntimeAdapter(
            EncounterPartyFactsRepository party,
            CreaturesApplicationService creatures,
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
            return result.status() == EncounterGenerationStatus.SUCCESS && result.budget() != null
                    ? Optional.of(EncounterSessionRuntimeProjector.toSessionBudget(result.budget()))
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
                    result.status() == EncounterGenerationStatus.SUCCESS,
                    result.encounters().stream()
                            .map(encounter -> toSessionGeneratedEncounter(encounter, advisoryMessages(result.advisories())))
                            .toList(),
                    result.message(),
                    toSessionDiagnostics(result.diagnostics()),
                    result.advisories().contains(EncounterGenerationAdvisory.FALLBACK_USED));
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
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), "Encounter plan is invalid."));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), "Encounter plan could not be saved."));
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
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), "Encounter plan id must be positive."));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), "Encounter plan could not be loaded."));
        }
    }

    @Override
    public ListPlansOutcome listPlans() {
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            return new ListPlansOutcome(false, List.of(), "Encounter plan storage is not registered.");
        }
        ListSavedEncounterPlansUseCase.Result result = useCase.execute();
        return new ListPlansOutcome(
                result.status().loadedSuccessfully(),
                result.plans(),
                result.message());
    }

    @Override
    public Optional<CreatureDetailData> loadCreature(long creatureId) {
        CreatureDetailResult result = creatures.loadCreatureDetail(new LoadCreatureDetailQuery(creatureId));
        if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
            return Optional.empty();
        }
        return Optional.of(EncounterSessionRuntimeProjector.toSessionCreatureDetail(result.detail()));
    }

    @Override
    public AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        return new AwardXpOutcome(party.awardXp(partyMemberIds, xpPerCharacter));
    }

    private GeneratedEncounterData toSessionGeneratedEncounter(
            GeneratedEncounter encounter,
            List<String> advisoryMessages
    ) {
        return new GeneratedEncounterData(
                encounter.title(),
                EncounterSessionRuntimeProjector.difficultyLabel(encounter.achievedDifficulty()),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(this::toSessionCreature).toList(),
                advisoryMessages);
    }

    private EncounterCreatureData toSessionCreature(EncounterCreature creature) {
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

    private static Optional<GenerationDiagnosticsData> toSessionDiagnostics(
            @Nullable EncounterGenerationDiagnostics diagnostics
    ) {
        if (diagnostics == null) {
            return Optional.empty();
        }
        return Optional.of(new GenerationDiagnosticsData(
                EncounterSessionRuntimeProjector.difficultyLabel(diagnostics.resolvedDifficulty()),
                EncounterSessionRuntimeProjector.tuningLabel(diagnostics.resolvedTuning())));
    }

    private static List<String> advisoryMessages(List<EncounterGenerationAdvisory> advisories) {
        if (advisories == null || advisories.isEmpty()) {
            return List.of();
        }
        return advisories.stream().map(EncounterSessionRuntimeAdapter::advisoryMessage).toList();
    }

    private static String advisoryMessage(EncounterGenerationAdvisory advisory) {
        if (advisory == EncounterGenerationAdvisory.AUTO_RESOLVED) {
            return "Auto-Einstellungen wurden fuer diese Generierung auf konkrete Zielwerte aufgeloest.";
        }
        return "Kein exakter Treffer war verfuegbar. Die beste gefundene Alternative wurde uebernommen.";
    }

    private static String defaultMessage(@Nullable String message, String fallback) {
        return message == null || message.isBlank() ? fallback : message;
    }

    private static String normalizeRole(String role) {
        return role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role;
    }
}
