package src.domain.party;

import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;

final class PartyMutationProjectionServiceAssembly {

    private PartyMutationProjectionServiceAssembly() {
    }

    static MutationResult defaultMutationResult() {
        return new MutationResult(MutationStatus.SUCCESS);
    }

    static MutationResult storageErrorMutationResult() {
        return new MutationResult(MutationStatus.STORAGE_ERROR);
    }

    static MutationStatus mapMutationStatus(PartyMutationStatus status) {
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
}
