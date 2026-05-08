package src.domain.encounter.application;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.reference.port.EncounterCreatureLookup;
import src.domain.encounter.reference.value.EncounterCreatureReference;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class EncounterSessionRuntimeAdapter implements EncounterSession.RuntimeAccess {

    private static final String DEFAULT_CREATURE_ROLE = "Creature";

    private final EncounterPartyFactsRepository party;
    private final EncounterCreatureLookup creatures;
    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable SaveEncounterPlanUseCase savePlanUseCase;
    private final @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;

    public EncounterSessionRuntimeAdapter(
            EncounterPartyFactsRepository party,
            EncounterCreatureLookup creatures,
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
            return result.status() == EncounterPartyFactsRepository.Status.SUCCESS && result.budget() != null
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
                    result.success(),
                    result.encounters().stream()
                            .map(encounter -> toSessionGeneratedEncounter(
                                    encounter,
                                    advisoryMessages(result.autoResolved(), result.fallbackUsed())))
                            .toList(),
                    result.message(),
                    toSessionDiagnostics(result.diagnostics()),
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
        return creatures.loadCreature(creatureId).map(EncounterSessionRuntimeAdapter::toSessionCreatureDetail);
    }

    @Override
    public AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        return new AwardXpOutcome(party.awardXp(partyMemberIds, xpPerCharacter));
    }

    private GeneratedEncounterData toSessionGeneratedEncounter(
            EncounterGenerationUseCase.GeneratedAlternative encounter,
            List<String> advisoryMessages
    ) {
        return new GeneratedEncounterData(
                encounter.title(),
                EncounterSessionRuntimeProjector.difficultyLabel(encounter.achievedDifficulty()),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(this::toSessionCreature).toList(),
                advisoryMessages);
    }

    private EncounterCreatureData toSessionCreature(EncounterGenerationUseCase.GeneratedCreature creature) {
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
            @Nullable EncounterGenerationDiagnosticsData diagnostics
    ) {
        if (diagnostics == null) {
            return Optional.empty();
        }
        return Optional.of(new GenerationDiagnosticsData(
                EncounterSessionRuntimeProjector.difficultyLabel(diagnostics.resolvedDifficulty()),
                EncounterSessionRuntimeProjector.tuningLabel(diagnostics.resolvedTuning())));
    }

    private static List<String> advisoryMessages(boolean autoResolved, boolean fallbackUsed) {
        java.util.ArrayList<String> messages = new java.util.ArrayList<>();
        if (autoResolved) {
            messages.add("Auto-Einstellungen wurden fuer diese Generierung auf konkrete Zielwerte aufgeloest.");
        }
        if (fallbackUsed) {
            messages.add("Kein exakter Treffer war verfuegbar. Die beste gefundene Alternative wurde uebernommen.");
        }
        return List.copyOf(messages);
    }

    private static String defaultMessage(@Nullable String message, String fallback) {
        return message == null || message.isBlank() ? fallback : message;
    }

    private static String normalizeRole(String role) {
        return role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role;
    }

    private static CreatureDetailData toSessionCreatureDetail(EncounterCreatureReference creature) {
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
}
