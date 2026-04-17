package src.domain.party.usecase;

import src.domain.party.entity.PartyCharacter;
import src.domain.party.partyAPI;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyLevelProgression;

import java.util.List;

/**
 * Internal query coordinator for the public party API facade.
 */
public final class PartyQueryOperations {

    private final LoadPartySnapshotUseCase loadPartySnapshotUseCase;
    private final LoadActivePartyUseCase loadActivePartyUseCase;
    private final LoadActivePartyCompositionUseCase loadActivePartyCompositionUseCase;
    private final LoadAdventuringDaySummaryUseCase loadAdventuringDaySummaryUseCase;

    public PartyQueryOperations(PartyRosterRepository repository) {
        this.loadPartySnapshotUseCase = new LoadPartySnapshotUseCase(repository);
        this.loadActivePartyUseCase = new LoadActivePartyUseCase(repository);
        this.loadActivePartyCompositionUseCase = new LoadActivePartyCompositionUseCase(repository);
        this.loadAdventuringDaySummaryUseCase = new LoadAdventuringDaySummaryUseCase(repository);
    }

    public partyAPI.PartySnapshotResult loadSnapshot() {
        try {
            return new partyAPI.PartySnapshotResult(partyAPI.ReadStatus.SUCCESS, mapSnapshot(loadPartySnapshotUseCase.execute()));
        } catch (RuntimeException exception) {
            return new partyAPI.PartySnapshotResult(partyAPI.ReadStatus.STORAGE_ERROR, emptySnapshot());
        }
    }

    public partyAPI.ActivePartyResult loadActiveParty() {
        try {
            return new partyAPI.ActivePartyResult(
                    partyAPI.ReadStatus.SUCCESS,
                    loadActivePartyUseCase.execute().stream().map(this::mapSummary).toList());
        } catch (RuntimeException exception) {
            return new partyAPI.ActivePartyResult(partyAPI.ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public partyAPI.ActivePartyCompositionResult loadActivePartyComposition() {
        try {
            return new partyAPI.ActivePartyCompositionResult(
                    partyAPI.ReadStatus.SUCCESS,
                    loadActivePartyCompositionUseCase.execute());
        } catch (RuntimeException exception) {
            return new partyAPI.ActivePartyCompositionResult(
                    partyAPI.ReadStatus.STORAGE_ERROR,
                    new partyAPI.ActivePartyComposition(List.of(), 1));
        }
    }

    public partyAPI.AdventuringDayResult loadAdventuringDaySummary() {
        try {
            LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus = loadAdventuringDaySummaryUseCase.execute();
            return new partyAPI.AdventuringDayResult(
                    partyAPI.ReadStatus.SUCCESS,
                    new partyAPI.AdventuringDaySummary(
                            dayStatus.activeLevels(),
                            dayStatus.remainingToShortRest(),
                            dayStatus.remainingToLongRest(),
                            dayStatus.consumedXp(),
                            dayStatus.totalBudgetXp(),
                            dayStatus.consumedPercent(),
                            dayStatus.restCadenceStatuses().stream().map(this::mapRestCadenceStatus).toList()));
        } catch (RuntimeException exception) {
            return new partyAPI.AdventuringDayResult(
                    partyAPI.ReadStatus.STORAGE_ERROR,
                    new partyAPI.AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
        }
    }

    private partyAPI.PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
        return new partyAPI.PartySnapshot(
                projection.activeMembers().stream().map(this::mapDetails).toList(),
                projection.reserveMembers().stream().map(this::mapDetails).toList(),
                new partyAPI.PartySummary(
                        projection.activeMembers().size(),
                        projection.reserveMembers().size(),
                        projection.averageLevel()));
    }

    private partyAPI.PartyMemberSummary mapSummary(PartyCharacter character) {
        return new partyAPI.PartyMemberSummary(
                character.id(),
                character.identity().name(),
                character.progress().level());
    }

    private partyAPI.PartyMemberDetails mapDetails(PartyCharacter character) {
        return new partyAPI.PartyMemberDetails(
                character.id(),
                character.identity().name(),
                character.identity().playerName(),
                character.progress().level(),
                character.progress().currentXp(),
                PartyLevelProgression.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                PartyLevelProgression.readyToLevel(character.progress().level(), character.progress().currentXp()),
                character.combat().passivePerception(),
                character.combat().armorClass(),
                character.progress().xpSinceShortRest(),
                character.progress().xpSinceLongRest(),
                character.progress().shortRestsTakenSinceLongRest(),
                character.membership().toApi());
    }

    private partyAPI.RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        return new partyAPI.RestCadenceStatus(
                status.characterId(),
                switch (status.nextMilestone()) {
                    case SHORT_REST_ONE -> partyAPI.RestMilestone.SHORT_REST_ONE;
                    case SHORT_REST_TWO -> partyAPI.RestMilestone.SHORT_REST_TWO;
                    case LONG_REST -> partyAPI.RestMilestone.LONG_REST;
                },
                status.xpDelta(),
                switch (status.urgency()) {
                    case NORMAL -> partyAPI.RestCadenceUrgency.NORMAL;
                    case SOON -> partyAPI.RestCadenceUrgency.SOON;
                    case OVERDUE -> partyAPI.RestCadenceUrgency.OVERDUE;
                });
    }

    private partyAPI.PartySnapshot emptySnapshot() {
        return new partyAPI.PartySnapshot(List.of(), List.of(), new partyAPI.PartySummary(0, 0, 1));
    }
}
