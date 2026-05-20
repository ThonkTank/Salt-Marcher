package src.domain.party.model.roster.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.party.application.CalculateAdventuringDayUseCase;
import src.domain.party.application.LoadActivePartyCompositionUseCase;
import src.domain.party.application.LoadActivePartyUseCase;
import src.domain.party.application.LoadAdventuringDaySummaryUseCase;
import src.domain.party.application.LoadPartySnapshotUseCase;
import src.domain.party.application.LoadPartyTravelPositionsUseCase;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.MutationResult;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.ReadStatus;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
public final class ApplicationPartyPublishedStateRepository implements PartyPublishedStateRepository {

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
    private PartySnapshotResult currentPartySnapshot = PartyPublishedStateProjection.failedSnapshotResult();
    private ActivePartyResult currentActiveParty = PartyPublishedStateProjection.failedActivePartyResult();
    private ActivePartyCompositionResult currentActivePartyComposition =
            PartyPublishedStateProjection.failedActivePartyCompositionResult();
    private AdventuringDayResult currentAdventuringDaySummary =
            PartyPublishedStateProjection.failedAdventuringDaySummaryResult();
    private PartyTravelPositionsResult currentPartyTravelPositions =
            PartyPublishedStateProjection.failedPartyTravelPositionsResult();
    private MutationResult currentPartyMutation = PartyPublishedStateProjection.defaultMutationResult();
    private AdventuringDayCalculationResult currentAdventuringDayCalculation =
            PartyPublishedStateProjection.failedAdventuringDayCalculationResult();

    public ApplicationPartyPublishedStateRepository(PartyRosterRepository delegate) {
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
        currentPartyMutation = new MutationResult(PartyPublishedStateProjection.mapMutationStatus(status));
        notifyPartyMutationListeners(currentPartyMutation);
    }

    @Override
    public void publishStorageErrorMutation() {
        currentPartyMutation = PartyPublishedStateProjection.storageErrorMutationResult();
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
                    ReadStatus.SUCCESS,
                    PartyPublishedStateProjection.mapSnapshot(loadPartySnapshotUseCase.execute()));
        } catch (IllegalStateException exception) {
            return PartyPublishedStateProjection.failedSnapshotResult();
        }
    }

    private ActivePartyResult readActivePartyResult() {
        try {
            return PartyPublishedStateProjection.mapActivePartyResult(loadActivePartyUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartyPublishedStateProjection.failedActivePartyResult();
        }
    }

    private ActivePartyCompositionResult readActivePartyCompositionResult() {
        try {
            return PartyPublishedStateProjection.mapActivePartyCompositionResult(
                    loadActivePartyCompositionUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartyPublishedStateProjection.failedActivePartyCompositionResult();
        }
    }

    private AdventuringDayResult readAdventuringDaySummaryResult() {
        try {
            return PartyPublishedStateProjection.mapAdventuringDaySummaryResult(
                    loadAdventuringDaySummaryUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartyPublishedStateProjection.failedAdventuringDaySummaryResult();
        }
    }

    private PartyTravelPositionsResult readPartyTravelPositionsResult() {
        try {
            return PartyPublishedStateProjection.mapTravelPositionsResult(
                    loadPartyTravelPositionsUseCase.execute(List.of()));
        } catch (IllegalStateException exception) {
            return PartyPublishedStateProjection.failedPartyTravelPositionsResult();
        }
    }

    private AdventuringDayCalculationResult readAdventuringDayCalculationResult(
            List<Integer> levels,
            int totalGroupXp
    ) {
        try {
            return PartyPublishedStateProjection.mapAdventuringDayCalculationResult(calculateAdventuringDayUseCase.execute(
                    levels == null ? List.of() : levels,
                    totalGroupXp));
        } catch (IllegalStateException exception) {
            return PartyPublishedStateProjection.mapAdventuringDayCalculationResult(
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
