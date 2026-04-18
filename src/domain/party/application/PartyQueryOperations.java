package src.domain.party.application;

import src.domain.party.api.ActivePartyComposition;
import src.domain.party.api.ActivePartyCompositionResult;
import src.domain.party.api.ActivePartyResult;
import src.domain.party.api.AdventuringDayResult;
import src.domain.party.api.AdventuringDaySummary;
import src.domain.party.api.PartyMemberDetails;
import src.domain.party.api.PartyMemberSummary;
import src.domain.party.api.PartySnapshot;
import src.domain.party.api.PartySnapshotResult;
import src.domain.party.api.PartySummary;
import src.domain.party.api.ReadStatus;
import src.domain.party.api.RestCadenceStatus;
import src.domain.party.api.RestCadenceUrgency;
import src.domain.party.api.RestMilestone;
import src.domain.party.entity.PartyCharacter;
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

    public PartySnapshotResult loadSnapshot() {
        try {
            return new PartySnapshotResult(ReadStatus.SUCCESS, mapSnapshot(loadPartySnapshotUseCase.execute()));
        } catch (RuntimeException exception) {
            return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
        }
    }

    public ActivePartyResult loadActiveParty() {
        try {
            return new ActivePartyResult(
                    ReadStatus.SUCCESS,
                    loadActivePartyUseCase.execute().stream().map(this::mapSummary).toList());
        } catch (RuntimeException exception) {
            return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public ActivePartyCompositionResult loadActivePartyComposition() {
        try {
            return new ActivePartyCompositionResult(
                    ReadStatus.SUCCESS,
                    loadActivePartyCompositionUseCase.execute());
        } catch (RuntimeException exception) {
            return new ActivePartyCompositionResult(
                    ReadStatus.STORAGE_ERROR,
                    new ActivePartyComposition(List.of(), 1));
        }
    }

    public AdventuringDayResult loadAdventuringDaySummary() {
        try {
            LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus = loadAdventuringDaySummaryUseCase.execute();
            return new AdventuringDayResult(
                    ReadStatus.SUCCESS,
                    new AdventuringDaySummary(
                            dayStatus.activeLevels(),
                            dayStatus.remainingToShortRest(),
                            dayStatus.remainingToLongRest(),
                            dayStatus.consumedXp(),
                            dayStatus.totalBudgetXp(),
                            dayStatus.consumedPercent(),
                            dayStatus.restCadenceStatuses().stream().map(this::mapRestCadenceStatus).toList()));
        } catch (RuntimeException exception) {
            return new AdventuringDayResult(
                    ReadStatus.STORAGE_ERROR,
                    new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
        }
    }

    private PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
        return new PartySnapshot(
                projection.activeMembers().stream().map(this::mapDetails).toList(),
                projection.reserveMembers().stream().map(this::mapDetails).toList(),
                new PartySummary(
                        projection.activeMembers().size(),
                        projection.reserveMembers().size(),
                        projection.averageLevel()));
    }

    private PartyMemberSummary mapSummary(PartyCharacter character) {
        return new PartyMemberSummary(
                character.id(),
                character.identity().name(),
                character.progress().level());
    }

    private PartyMemberDetails mapDetails(PartyCharacter character) {
        return new PartyMemberDetails(
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

    private RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        return new RestCadenceStatus(
                status.characterId(),
                switch (status.nextMilestone()) {
                    case SHORT_REST_ONE -> RestMilestone.SHORT_REST_ONE;
                    case SHORT_REST_TWO -> RestMilestone.SHORT_REST_TWO;
                    case LONG_REST -> RestMilestone.LONG_REST;
                },
                status.xpDelta(),
                switch (status.urgency()) {
                    case NORMAL -> RestCadenceUrgency.NORMAL;
                    case SOON -> RestCadenceUrgency.SOON;
                    case OVERDUE -> RestCadenceUrgency.OVERDUE;
                });
    }

    private PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }
}
