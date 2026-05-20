package src.domain.party;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import shell.api.ServiceRegistry;
import src.domain.dungeon.model.travel.repository.TravelPartyStateRepository;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CalculateAdventuringDayUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.LoadActivePartyCompositionUseCase;
import src.domain.party.application.LoadActivePartyUseCase;
import src.domain.party.application.LoadAdventuringDaySummaryUseCase;
import src.domain.party.application.LoadPartySnapshotUseCase;
import src.domain.party.application.LoadPartyTravelPositionsUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.model.roster.model.PartyAdventuringDayCalculation;
import src.domain.party.model.roster.model.PartyAdventuringDayLevelProgress;
import src.domain.party.model.roster.model.PartyAdventuringDayPlan;
import src.domain.party.model.roster.model.PartyAdventuringDayProgress;
import src.domain.party.model.roster.model.PartyAdventuringDayProgressEvent;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.model.PartyCharacterProgress;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyTravelLocation;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.model.roster.repository.ApplicationTravelPartyStateRepository;
import src.domain.party.published.ActivePartyComposition;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayBudget;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayLevelProgress;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.AdventuringDayProgress;
import src.domain.party.published.AdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestMilestone;

final class PartyServiceAssembly {

    private final java.util.concurrent.atomic.AtomicReference<PartyPublishedStateRepositoryAdapter> publishedState =
            new java.util.concurrent.atomic.AtomicReference<>();

    PartyApplicationService createApplicationService(ServiceRegistry services) {
        PartyRosterRepository repository = services.require(PartyRosterRepository.class);
        PartyPublishedStateRepositoryAdapter state = publishedState(services);
        PartyPublishedStateRepository publishedStateRepository = state;
        return new PartyApplicationService(
                new CreateCharacterUseCase(repository, publishedStateRepository),
                new UpdateCharacterUseCase(repository, publishedStateRepository),
                new DeleteCharacterUseCase(repository, publishedStateRepository),
                new SetPartyMembershipUseCase(repository, publishedStateRepository),
                new AdjustPartyXpUseCase(repository, publishedStateRepository),
                new AwardPartyXpUseCase(repository, publishedStateRepository),
                new PerformPartyRestUseCase(repository, publishedStateRepository),
                new MovePartyCharactersUseCase(repository, publishedStateRepository),
                new CalculateAdventuringDayUseCase(publishedStateRepository));
    }

    PartySnapshotModel partySnapshotModel(ServiceRegistry services) {
        return publishedState(services).partySnapshotModel;
    }

    ActivePartyModel activePartyModel(ServiceRegistry services) {
        return publishedState(services).activePartyModel;
    }

    ActivePartyCompositionModel activePartyCompositionModel(ServiceRegistry services) {
        return publishedState(services).activePartyCompositionModel;
    }

    AdventuringDaySummaryModel adventuringDaySummaryModel(ServiceRegistry services) {
        return publishedState(services).adventuringDaySummaryModel;
    }

    PartyTravelPositionsModel partyTravelPositionsModel(ServiceRegistry services) {
        return publishedState(services).partyTravelPositionsModel;
    }

    PartyMutationModel partyMutationModel(ServiceRegistry services) {
        return publishedState(services).partyMutationModel;
    }

    AdventuringDayCalculationModel adventuringDayCalculationModel(ServiceRegistry services) {
        return publishedState(services).adventuringDayCalculationModel;
    }

    TravelPartyStateRepository travelPartyStateRepository(ServiceRegistry services) {
        return new ApplicationTravelPartyStateRepository(
                services.require(PartyApplicationService.class),
                activePartyModel(services),
                partyTravelPositionsModel(services),
                partyMutationModel(services));
    }

    private PartyPublishedStateRepositoryAdapter publishedState(ServiceRegistry services) {
        PartyPublishedStateRepositoryAdapter existing = publishedState.get();
        if (existing != null) {
            return existing;
        }
        PartyPublishedStateRepositoryAdapter candidate =
                new PartyPublishedStateRepositoryAdapter(services.require(PartyRosterRepository.class));
        return publishedState.compareAndSet(null, candidate)
                ? candidate
                : java.util.Objects.requireNonNull(publishedState.get(), "publishedState");
    }
}

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
final class PartyPublishedStateRepositoryAdapter implements PartyPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

    private final LoadPartySnapshotUseCase loadPartySnapshotUseCase;
    private final LoadActivePartyUseCase loadActivePartyUseCase;
    private final LoadActivePartyCompositionUseCase loadActivePartyCompositionUseCase;
    private final LoadAdventuringDaySummaryUseCase loadAdventuringDaySummaryUseCase;
    private final LoadPartyTravelPositionsUseCase loadPartyTravelPositionsUseCase;
    private final CalculateAdventuringDayUseCase calculateAdventuringDayUseCase;
    private final List<Consumer<PartySnapshotResult>> partySnapshotListeners = new ArrayList<>();
    private final List<Consumer<ActivePartyResult>> activePartyListeners = new ArrayList<>();
    private final List<Consumer<ActivePartyCompositionResult>> activePartyCompositionListeners = new ArrayList<>();
    private final List<Consumer<AdventuringDayResult>> adventuringDaySummaryListeners = new ArrayList<>();
    private final List<Consumer<PartyTravelPositionsResult>> partyTravelPositionsListeners = new ArrayList<>();
    private final List<Consumer<MutationResult>> partyMutationListeners = new ArrayList<>();
    private final List<Consumer<AdventuringDayCalculationResult>> adventuringDayCalculationListeners = new ArrayList<>();
    public final PartySnapshotModel partySnapshotModel = new PartySnapshotModel(
            this::currentPartySnapshot,
            this::subscribePartySnapshotListener);
    public final ActivePartyModel activePartyModel = new ActivePartyModel(
            this::currentActiveParty,
            this::subscribeActivePartyListener);
    public final ActivePartyCompositionModel activePartyCompositionModel = new ActivePartyCompositionModel(
            this::currentActivePartyComposition,
            this::subscribeActivePartyCompositionListener);
    public final AdventuringDaySummaryModel adventuringDaySummaryModel = new AdventuringDaySummaryModel(
            this::currentAdventuringDaySummary,
            this::subscribeAdventuringDaySummaryListener);
    public final PartyTravelPositionsModel partyTravelPositionsModel = new PartyTravelPositionsModel(
            this::currentPartyTravelPositions,
            this::subscribePartyTravelPositionsListener);
    public final PartyMutationModel partyMutationModel = new PartyMutationModel(
            this::currentPartyMutation,
            this::subscribePartyMutationListener);
    public final AdventuringDayCalculationModel adventuringDayCalculationModel = new AdventuringDayCalculationModel(
            this::currentAdventuringDayCalculation,
            this::subscribeAdventuringDayCalculationListener);
    private PartySnapshotResult currentPartySnapshot = PartyBoundaryProjector.failedSnapshotResult();
    private ActivePartyResult currentActiveParty = PartyBoundaryProjector.failedActivePartyResult();
    private ActivePartyCompositionResult currentActivePartyComposition =
            PartyBoundaryProjector.failedActivePartyCompositionResult();
    private AdventuringDayResult currentAdventuringDaySummary = PartyBoundaryProjector.failedAdventuringDaySummaryResult();
    private PartyTravelPositionsResult currentPartyTravelPositions = PartyBoundaryProjector.failedPartyTravelPositionsResult();
    private MutationResult currentPartyMutation = PartyBoundaryProjector.defaultMutationResult();
    private AdventuringDayCalculationResult currentAdventuringDayCalculation =
            PartyBoundaryProjector.failedAdventuringDayCalculationResult();

    public PartyPublishedStateRepositoryAdapter(PartyRosterRepository delegate) {
        PartyRosterRepository repository = Objects.requireNonNull(delegate, "delegate");
        this.loadPartySnapshotUseCase = new LoadPartySnapshotUseCase(repository);
        this.loadActivePartyUseCase = new LoadActivePartyUseCase(repository);
        this.loadActivePartyCompositionUseCase = new LoadActivePartyCompositionUseCase(repository);
        this.loadAdventuringDaySummaryUseCase = new LoadAdventuringDaySummaryUseCase(repository);
        this.loadPartyTravelPositionsUseCase = new LoadPartyTravelPositionsUseCase(repository);
        this.calculateAdventuringDayUseCase = new CalculateAdventuringDayUseCase();
        refreshRepositoryBackedState(false);
    }

    @Override
    public void publishRepositoryBackedState() {
        refreshRepositoryBackedState(true);
    }

    @Override
    public void publishMutationStatus(PartyMutationStatus status) {
        currentPartyMutation = new MutationResult(PartyBoundaryProjector.mapMutationStatus(status));
        notifyPartyMutationListeners(currentPartyMutation);
    }

    @Override
    public void publishStorageErrorMutation() {
        currentPartyMutation = PartyBoundaryProjector.storageErrorMutationResult();
        notifyPartyMutationListeners(currentPartyMutation);
    }

    @Override
    public void publishAdventuringDayCalculation(List<Integer> levels, int totalGroupXp) {
        currentAdventuringDayCalculation = readAdventuringDayCalculationResult(levels, totalGroupXp);
        notifyAdventuringDayCalculationListeners(currentAdventuringDayCalculation);
    }

    private void refreshRepositoryBackedState(boolean notify) {
        currentPartySnapshot = readSnapshotResult();
        currentActiveParty = readActivePartyResult();
        currentActivePartyComposition = readActivePartyCompositionResult();
        currentAdventuringDaySummary = readAdventuringDaySummaryResult();
        currentPartyTravelPositions = readPartyTravelPositionsResult();
        if (notify) {
            notifyPartySnapshotListeners(currentPartySnapshot);
            notifyActivePartyListeners(currentActiveParty);
            notifyActivePartyCompositionListeners(currentActivePartyComposition);
            notifyAdventuringDaySummaryListeners(currentAdventuringDaySummary);
            notifyPartyTravelPositionsListeners(currentPartyTravelPositions);
        }
    }

    private PartySnapshotResult readSnapshotResult() {
        try {
            return new PartySnapshotResult(
                    src.domain.party.published.ReadStatus.SUCCESS,
                    PartyBoundaryProjector.mapSnapshot(loadPartySnapshotUseCase.execute()));
        } catch (IllegalStateException exception) {
            return PartyBoundaryProjector.failedSnapshotResult();
        }
    }

    private ActivePartyResult readActivePartyResult() {
        try {
            return PartyBoundaryProjector.mapActivePartyResult(loadActivePartyUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartyBoundaryProjector.failedActivePartyResult();
        }
    }

    private ActivePartyCompositionResult readActivePartyCompositionResult() {
        try {
            return PartyBoundaryProjector.mapActivePartyCompositionResult(loadActivePartyCompositionUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartyBoundaryProjector.failedActivePartyCompositionResult();
        }
    }

    private AdventuringDayResult readAdventuringDaySummaryResult() {
        try {
            return PartyBoundaryProjector.mapAdventuringDaySummaryResult(loadAdventuringDaySummaryUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartyBoundaryProjector.failedAdventuringDaySummaryResult();
        }
    }

    private PartyTravelPositionsResult readPartyTravelPositionsResult() {
        try {
            return PartyBoundaryProjector.mapTravelPositionsResult(loadPartyTravelPositionsUseCase.execute(List.of()));
        } catch (IllegalStateException exception) {
            return PartyBoundaryProjector.failedPartyTravelPositionsResult();
        }
    }

    private AdventuringDayCalculationResult readAdventuringDayCalculationResult(
            List<Integer> levels,
            int totalGroupXp
    ) {
        try {
            return PartyBoundaryProjector.mapAdventuringDayCalculationResult(calculateAdventuringDayUseCase.execute(
                    levels == null ? List.of() : levels,
                    totalGroupXp));
        } catch (IllegalStateException exception) {
            return PartyBoundaryProjector.mapAdventuringDayCalculationResult(
                    calculateAdventuringDayUseCase.execute(List.of(), 0));
        }
    }

    private PartySnapshotResult currentPartySnapshot() {
        return currentPartySnapshot;
    }

    private ActivePartyResult currentActiveParty() {
        return currentActiveParty;
    }

    private ActivePartyCompositionResult currentActivePartyComposition() {
        return currentActivePartyComposition;
    }

    private AdventuringDayResult currentAdventuringDaySummary() {
        return currentAdventuringDaySummary;
    }

    private PartyTravelPositionsResult currentPartyTravelPositions() {
        return currentPartyTravelPositions;
    }

    private MutationResult currentPartyMutation() {
        return currentPartyMutation;
    }

    private AdventuringDayCalculationResult currentAdventuringDayCalculation() {
        return currentAdventuringDayCalculation;
    }

    private Runnable subscribePartySnapshotListener(Consumer<PartySnapshotResult> listener) {
        Consumer<PartySnapshotResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        partySnapshotListeners.add(safeListener);
        return () -> partySnapshotListeners.remove(safeListener);
    }

    private Runnable subscribeActivePartyListener(Consumer<ActivePartyResult> listener) {
        Consumer<ActivePartyResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        activePartyListeners.add(safeListener);
        return () -> activePartyListeners.remove(safeListener);
    }

    private Runnable subscribeActivePartyCompositionListener(Consumer<ActivePartyCompositionResult> listener) {
        Consumer<ActivePartyCompositionResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        activePartyCompositionListeners.add(safeListener);
        return () -> activePartyCompositionListeners.remove(safeListener);
    }

    private Runnable subscribeAdventuringDaySummaryListener(Consumer<AdventuringDayResult> listener) {
        Consumer<AdventuringDayResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        adventuringDaySummaryListeners.add(safeListener);
        return () -> adventuringDaySummaryListeners.remove(safeListener);
    }

    private Runnable subscribePartyTravelPositionsListener(Consumer<PartyTravelPositionsResult> listener) {
        Consumer<PartyTravelPositionsResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        partyTravelPositionsListeners.add(safeListener);
        return () -> partyTravelPositionsListeners.remove(safeListener);
    }

    private Runnable subscribePartyMutationListener(Consumer<MutationResult> listener) {
        Consumer<MutationResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        partyMutationListeners.add(safeListener);
        return () -> partyMutationListeners.remove(safeListener);
    }

    private Runnable subscribeAdventuringDayCalculationListener(Consumer<AdventuringDayCalculationResult> listener) {
        Consumer<AdventuringDayCalculationResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        adventuringDayCalculationListeners.add(safeListener);
        return () -> adventuringDayCalculationListeners.remove(safeListener);
    }

    private void notifyPartySnapshotListeners(PartySnapshotResult snapshot) {
        for (Consumer<PartySnapshotResult> listener : List.copyOf(partySnapshotListeners)) {
            listener.accept(snapshot);
        }
    }

    private void notifyActivePartyListeners(ActivePartyResult result) {
        for (Consumer<ActivePartyResult> listener : List.copyOf(activePartyListeners)) {
            listener.accept(result);
        }
    }

    private void notifyActivePartyCompositionListeners(ActivePartyCompositionResult result) {
        for (Consumer<ActivePartyCompositionResult> listener : List.copyOf(activePartyCompositionListeners)) {
            listener.accept(result);
        }
    }

    private void notifyAdventuringDaySummaryListeners(AdventuringDayResult result) {
        for (Consumer<AdventuringDayResult> listener : List.copyOf(adventuringDaySummaryListeners)) {
            listener.accept(result);
        }
    }

    private void notifyPartyTravelPositionsListeners(PartyTravelPositionsResult result) {
        for (Consumer<PartyTravelPositionsResult> listener : List.copyOf(partyTravelPositionsListeners)) {
            listener.accept(result);
        }
    }

    private void notifyPartyMutationListeners(MutationResult result) {
        for (Consumer<MutationResult> listener : List.copyOf(partyMutationListeners)) {
            listener.accept(result);
        }
    }

    private void notifyAdventuringDayCalculationListeners(AdventuringDayCalculationResult result) {
        for (Consumer<AdventuringDayCalculationResult> listener : List.copyOf(adventuringDayCalculationListeners)) {
            listener.accept(result);
        }
    }
}

@SuppressWarnings({
        "PMD.ExcessiveImports",
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
final class PartyBoundaryProjector {

    private PartyBoundaryProjector() {
    }

    public static PartySnapshotResult failedSnapshotResult() {
        return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
    }

    public static ActivePartyResult failedActivePartyResult() {
        return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
    }

    public static ActivePartyCompositionResult failedActivePartyCompositionResult() {
        return new ActivePartyCompositionResult(
                ReadStatus.STORAGE_ERROR,
                new ActivePartyComposition(List.of(), 1));
    }

    public static AdventuringDayResult failedAdventuringDaySummaryResult() {
        return new AdventuringDayResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
    }

    public static PartyTravelPositionsResult failedPartyTravelPositionsResult() {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null);
    }

    public static MutationResult defaultMutationResult() {
        return new MutationResult(MutationStatus.SUCCESS);
    }

    public static MutationResult storageErrorMutationResult() {
        return new MutationResult(MutationStatus.STORAGE_ERROR);
    }

    public static AdventuringDayCalculationResult failedAdventuringDayCalculationResult() {
        return new AdventuringDayCalculationResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDayCalculation(
                        new AdventuringDayBudget(0, 0, 0, 0, 0),
                        new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())),
                AdventuringDayPlanningSummary.empty());
    }

    public static PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
        return new PartySnapshot(
                projection.activeMembers().stream().map(PartyBoundaryProjector::mapDetails).toList(),
                projection.reserveMembers().stream().map(PartyBoundaryProjector::mapDetails).toList(),
                new PartySummary(
                        projection.activeMembers().size(),
                        projection.reserveMembers().size(),
                        projection.averageLevel()));
    }

    public static ActivePartyResult mapActivePartyResult(List<PartyCharacter> activeMembers) {
        return new ActivePartyResult(
                ReadStatus.SUCCESS,
                activeMembers.stream().map(PartyBoundaryProjector::mapSummary).toList());
    }

    public static ActivePartyCompositionResult mapActivePartyCompositionResult(
            LoadActivePartyCompositionUseCase.ActiveComposition composition
    ) {
        return new ActivePartyCompositionResult(
                ReadStatus.SUCCESS,
                new ActivePartyComposition(composition.activePartyLevels(), composition.averageActiveLevel()));
    }

    public static AdventuringDayResult mapAdventuringDaySummaryResult(
            LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus
    ) {
        return new AdventuringDayResult(
                ReadStatus.SUCCESS,
                new AdventuringDaySummary(
                        dayStatus.activeLevels(),
                        dayStatus.remainingToShortRest(),
                        dayStatus.remainingToLongRest(),
                        dayStatus.consumedXp(),
                        dayStatus.totalBudgetXp(),
                        dayStatus.consumedPercent(),
                        dayStatus.restCadenceStatuses().stream()
                                .map(PartyBoundaryProjector::mapRestCadenceStatus)
                                .toList()));
    }

    public static PartyTravelPositionsResult mapTravelPositionsResult(LoadPartyTravelPositionsUseCase.Result result) {
        return new PartyTravelPositionsResult(
                ReadStatus.SUCCESS,
                result.positions().stream()
                        .map(PartyBoundaryProjector::mapTravelPosition)
                        .toList(),
                mapTravelLocation(result.partyTokenLocation()));
    }

    public static AdventuringDayCalculationResult mapAdventuringDayCalculationResult(
            PartyAdventuringDayCalculation calculation
    ) {
        AdventuringDayCalculation publishedCalculation = new AdventuringDayCalculation(
                mapAdventuringDayBudget(calculation.plan()),
                mapAdventuringDayProgress(calculation.progress()));
        return new AdventuringDayCalculationResult(
                ReadStatus.SUCCESS,
                publishedCalculation,
                new AdventuringDayPlanningSummary(
                        calculation.plan().totalBudgetXp(),
                        calculation.plan().firstShortRestXp(),
                        calculation.plan().secondShortRestXp(),
                        calculation.plannedShortRests(),
                        calculation.plannedLongRests()));
    }

    public static MutationStatus mapMutationStatus(PartyMutationStatus status) {
        if (status == null) {
            return MutationStatus.STORAGE_ERROR;
        }
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            return MutationStatus.SUCCESS;
        }
        if (PartyMutationStatus.NOT_FOUND.equals(status)) {
            return MutationStatus.NOT_FOUND;
        }
        if (PartyMutationStatus.INVALID_INPUT.equals(status)) {
            return MutationStatus.INVALID_INPUT;
        }
        return MutationStatus.STORAGE_ERROR;
    }

    private static PartyMemberSummary mapSummary(PartyCharacter character) {
        return new PartyMemberSummary(
                character.id(),
                character.identity().name(),
                character.progress().level());
    }

    private static PartyMemberDetails mapDetails(PartyCharacter character) {
        return new PartyMemberDetails(
                character.id(),
                character.identity().name(),
                character.identity().playerName(),
                character.progress().level(),
                character.progress().currentXp(),
                PartyCharacterProgress.minimumXpForLevel(character.progress().level()),
                PartyCharacterProgress.nextLevelXp(character.progress().level()),
                PartyCharacterProgress.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                PartyCharacterProgress.readyToLevel(character.progress().level(), character.progress().currentXp()),
                character.combat().passivePerception(),
                character.combat().armorClass(),
                character.progress().xpSinceShortRest(),
                character.progress().xpSinceLongRest(),
                character.progress().shortRestsTakenSinceLongRest(),
                toMembershipState(character.membership()));
    }

    private static PartyTravelPositionSnapshot mapTravelPosition(LoadPartyTravelPositionsUseCase.TravelPosition position) {
        return new PartyTravelPositionSnapshot(
                position.characterId(),
                position.attachedToPartyToken(),
                mapTravelLocation(position.location()));
    }

    private static @Nullable PartyTravelLocationSnapshot mapTravelLocation(@Nullable PartyTravelLocation location) {
        if (location != null && location.isDungeon()) {
            return new PartyDungeonTravelLocationSnapshot(
                    location.mapId(),
                    toPublishedDungeonLocationKind(location.dungeonLocationKind()),
                    location.dungeonOwnerId(),
                    new PartyTravelTile(
                            location.dungeonTile().q(),
                            location.dungeonTile().r(),
                            location.dungeonTile().level()),
                    toPublishedHeading(location.dungeonHeading()));
        }
        if (location != null && location.isOverworld()) {
            return new PartyOverworldTravelLocationSnapshot(location.mapId(), location.overworldTileId());
        }
        return null;
    }

    private static RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadence status) {
        if (status == null) {
            return new RestCadenceStatus(
                    null,
                    RestMilestone.valueOf("LONG_REST"),
                    0,
                    RestCadenceUrgency.valueOf("NORMAL"));
        }
        return new RestCadenceStatus(
                status.characterId(),
                toPublishedRestMilestone(status.nextMilestone()),
                status.xpDelta(),
                toPublishedRestCadenceUrgency(status.urgency()));
    }

    private static AdventuringDayBudget mapAdventuringDayBudget(PartyAdventuringDayPlan plan) {
        return new AdventuringDayBudget(
                plan.totalBudgetXp(),
                plan.perThirdXp(),
                plan.firstShortRestXp(),
                plan.secondShortRestXp(),
                plan.characterCount());
    }

    private static AdventuringDayProgress mapAdventuringDayProgress(PartyAdventuringDayProgress progress) {
        return new AdventuringDayProgress(
                progress.totals().totalGroupXp(),
                progress.totals().perCharacterAwardedXp(),
                progress.totals().partySize(),
                progress.longRests(),
                progress.totals().totalDays(),
                progress.shortRests(),
                progress.longRests(),
                progress.levelProgressions().stream()
                        .map(PartyBoundaryProjector::mapLevelProgress)
                        .toList(),
                progress.events().stream()
                        .map(PartyBoundaryProjector::mapProgressEvent)
                        .toList());
    }

    private static AdventuringDayLevelProgress mapLevelProgress(PartyAdventuringDayLevelProgress progress) {
        return new AdventuringDayLevelProgress(
                progress.startLevel(),
                progress.endLevel(),
                progress.characterCount(),
                progress.levelUps());
    }

    private static AdventuringDayProgressEvent mapProgressEvent(PartyAdventuringDayProgressEvent event) {
        return new AdventuringDayProgressEvent(
                event.groupXp(),
                toPublishedProgressEventType(event),
                event.dayNumber(),
                event.newLevel(),
                event.affectedCharacters(),
                event.partialDay());
    }

    private static AdventuringDayProgressEventType toPublishedProgressEventType(
            PartyAdventuringDayProgressEvent event
    ) {
        if (event.isLevelUp()) {
            return AdventuringDayProgressEventType.LEVEL_UP;
        }
        if (event.isShortRest()) {
            return AdventuringDayProgressEventType.SHORT_REST;
        }
        return AdventuringDayProgressEventType.LONG_REST;
    }

    private static PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private static MembershipState toMembershipState(PartyMembership membership) {
        return PartyMembership.ACTIVE.equals(membership) ? MembershipState.ACTIVE : MembershipState.RESERVE;
    }

    private static PartyDungeonTravelLocationKind toPublishedDungeonLocationKind(
            src.domain.party.model.roster.model.PartyDungeonTravelLocationKind locationKind
    ) {
        return PartyDungeonTravelLocationKind.valueOf(locationKind.name());
    }

    private static PartyTravelHeading toPublishedHeading(
            src.domain.party.model.roster.model.PartyTravelHeading heading
    ) {
        return PartyTravelHeading.valueOf(heading.name());
    }

    private static RestMilestone toPublishedRestMilestone(
            int milestone
    ) {
        if (milestone == LoadAdventuringDaySummaryUseCase.RestCadence.SHORT_REST_ONE) {
            return RestMilestone.SHORT_REST_ONE;
        }
        if (milestone == LoadAdventuringDaySummaryUseCase.RestCadence.SHORT_REST_TWO) {
            return RestMilestone.SHORT_REST_TWO;
        }
        return RestMilestone.LONG_REST;
    }

    private static RestCadenceUrgency toPublishedRestCadenceUrgency(
            int urgency
    ) {
        if (urgency == LoadAdventuringDaySummaryUseCase.RestCadence.OVERDUE) {
            return RestCadenceUrgency.OVERDUE;
        }
        if (urgency == LoadAdventuringDaySummaryUseCase.RestCadence.SOON) {
            return RestCadenceUrgency.SOON;
        }
        return RestCadenceUrgency.NORMAL;
    }
}
