package src.domain.party.usecase;

import src.domain.party.entity.PartyCharacter;
import src.domain.party.partyAPI;
import src.domain.party.repository.PartyRosterRepository;

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
                            dayStatus.remainingToLongRest()));
        } catch (RuntimeException exception) {
            return new partyAPI.AdventuringDayResult(
                    partyAPI.ReadStatus.STORAGE_ERROR,
                    new partyAPI.AdventuringDaySummary(List.of(), 0, 0));
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
        return new partyAPI.PartyMemberSummary(character.id(), character.name(), character.level());
    }

    private partyAPI.PartyMemberDetails mapDetails(PartyCharacter character) {
        return new partyAPI.PartyMemberDetails(
                character.id(),
                character.name(),
                character.playerName(),
                character.level(),
                character.currentXp(),
                character.xpToNextLevel(),
                character.readyToLevel(),
                character.passivePerception(),
                character.armorClass(),
                character.xpSinceShortRest(),
                character.xpSinceLongRest(),
                character.membership().toApi());
    }

    private partyAPI.PartySnapshot emptySnapshot() {
        return new partyAPI.PartySnapshot(List.of(), List.of(), new partyAPI.PartySummary(0, 0, 1));
    }
}
