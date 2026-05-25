package src.domain.party;

import java.util.List;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.model.PartyCharacterProgress;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.usecase.LoadActivePartyCompositionUseCase;
import src.domain.party.model.roster.usecase.LoadPartySnapshotUseCase;
import src.domain.party.published.ActivePartyComposition;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.MembershipState;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.ReadStatus;

final class PartySnapshotProjectionServiceAssembly {

    private PartySnapshotProjectionServiceAssembly() {
    }

    static PartySnapshotResult failedSnapshotResult() {
        return new PartySnapshotResult(
                ReadStatus.STORAGE_ERROR,
                new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1)));
    }

    static ActivePartyResult failedActivePartyResult() {
        return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
    }

    static ActivePartyCompositionResult failedActivePartyCompositionResult() {
        return new ActivePartyCompositionResult(
                ReadStatus.STORAGE_ERROR,
                new ActivePartyComposition(List.of(), 1));
    }

    static PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
        return new PartySnapshot(
                projection.activeMembers().stream().map(PartySnapshotProjectionServiceAssembly::mapDetails).toList(),
                projection.reserveMembers().stream().map(PartySnapshotProjectionServiceAssembly::mapDetails).toList(),
                new PartySummary(
                        projection.activeMembers().size(),
                        projection.reserveMembers().size(),
                        projection.averageLevel()));
    }

    static ActivePartyResult mapActivePartyResult(List<PartyCharacter> activeMembers) {
        return new ActivePartyResult(
                ReadStatus.SUCCESS,
                activeMembers.stream().map(PartySnapshotProjectionServiceAssembly::mapSummary).toList());
    }

    static ActivePartyCompositionResult mapActivePartyCompositionResult(
            LoadActivePartyCompositionUseCase.ActiveComposition composition
    ) {
        return new ActivePartyCompositionResult(
                ReadStatus.SUCCESS,
                new ActivePartyComposition(composition.activePartyLevels(), composition.averageActiveLevel()));
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

    private static MembershipState toMembershipState(PartyMembership membership) {
        return PartyMembership.ACTIVE.equals(membership) ? MembershipState.ACTIVE : MembershipState.RESERVE;
    }
}
