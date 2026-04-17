package src.view.party.interactor;

import src.domain.party.partyAPI;

final class PartyMutationMessages {

    String errorFor(partyAPI.MutationStatus status) {
        if (status == null) {
            return "Party update failed.";
        }
        return switch (status) {
            case SUCCESS -> "Party updated.";
            case NOT_FOUND -> "Character not found.";
            case INVALID_INPUT -> "Invalid party change.";
            case STORAGE_ERROR -> "Party storage is unavailable.";
        };
    }
}
