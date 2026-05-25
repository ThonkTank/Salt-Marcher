package src.domain.party;

import java.util.List;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.model.roster.usecase.CalculateAdventuringDayUseCase;
import src.domain.party.model.roster.usecase.LoadActivePartyCompositionUseCase;
import src.domain.party.model.roster.usecase.LoadActivePartyUseCase;
import src.domain.party.model.roster.usecase.LoadAdventuringDaySummaryUseCase;
import src.domain.party.model.roster.usecase.LoadPartySnapshotUseCase;
import src.domain.party.model.roster.usecase.LoadPartyTravelPositionsUseCase;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.ReadStatus;

final class PartyPublishedReadbackServiceAssembly {

    private final LoadPartySnapshotUseCase loadPartySnapshotUseCase;
    private final LoadActivePartyUseCase loadActivePartyUseCase;
    private final LoadActivePartyCompositionUseCase loadActivePartyCompositionUseCase;
    private final LoadAdventuringDaySummaryUseCase loadAdventuringDaySummaryUseCase;
    private final LoadPartyTravelPositionsUseCase loadPartyTravelPositionsUseCase;
    private final CalculateAdventuringDayUseCase calculateAdventuringDayUseCase;

    PartyPublishedReadbackServiceAssembly(PartyRosterRepository repository) {
        this.loadPartySnapshotUseCase = new LoadPartySnapshotUseCase(repository);
        this.loadActivePartyUseCase = new LoadActivePartyUseCase(repository);
        this.loadActivePartyCompositionUseCase = new LoadActivePartyCompositionUseCase(repository);
        this.loadAdventuringDaySummaryUseCase = new LoadAdventuringDaySummaryUseCase(repository);
        this.loadPartyTravelPositionsUseCase = new LoadPartyTravelPositionsUseCase(repository);
        this.calculateAdventuringDayUseCase = new CalculateAdventuringDayUseCase();
    }

    PartySnapshotResult readSnapshotResult() {
        try {
            return new PartySnapshotResult(
                    ReadStatus.SUCCESS,
                    PartySnapshotProjectionServiceAssembly.mapSnapshot(loadPartySnapshotUseCase.execute()));
        } catch (IllegalStateException exception) {
            return PartySnapshotProjectionServiceAssembly.failedSnapshotResult();
        }
    }

    ActivePartyResult readActivePartyResult() {
        try {
            return PartySnapshotProjectionServiceAssembly.mapActivePartyResult(loadActivePartyUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartySnapshotProjectionServiceAssembly.failedActivePartyResult();
        }
    }

    ActivePartyCompositionResult readActivePartyCompositionResult() {
        try {
            return PartySnapshotProjectionServiceAssembly.mapActivePartyCompositionResult(
                    loadActivePartyCompositionUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartySnapshotProjectionServiceAssembly.failedActivePartyCompositionResult();
        }
    }

    AdventuringDayResult readAdventuringDaySummaryResult() {
        try {
            return PartyAdventuringDayProjectionServiceAssembly.mapAdventuringDaySummaryResult(
                    loadAdventuringDaySummaryUseCase.execute());
        } catch (IllegalStateException exception) {
            return PartyAdventuringDayProjectionServiceAssembly.failedAdventuringDaySummaryResult();
        }
    }

    PartyTravelPositionsResult readPartyTravelPositionsResult() {
        try {
            return PartyTravelProjectionServiceAssembly.mapTravelPositionsResult(
                    loadPartyTravelPositionsUseCase.execute(List.of()));
        } catch (IllegalStateException exception) {
            return PartyTravelProjectionServiceAssembly.failedPartyTravelPositionsResult();
        }
    }

    AdventuringDayCalculationResult readAdventuringDayCalculationResult(List<Integer> levels, int totalGroupXp) {
        try {
            return PartyAdventuringDayProjectionServiceAssembly.mapAdventuringDayCalculationResult(
                    calculateAdventuringDayUseCase.execute(levels == null ? List.of() : levels, totalGroupXp));
        } catch (IllegalStateException exception) {
            return PartyAdventuringDayProjectionServiceAssembly.mapAdventuringDayCalculationResult(
                    calculateAdventuringDayUseCase.execute(List.of(), 0));
        }
    }
}
