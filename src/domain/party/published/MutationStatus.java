package src.domain.party.published;

import src.domain.party.roster.value.PartyMutationStatus;

public final class MutationStatus {

    public static final MutationStatus SUCCESS = new MutationStatus(PartyMutationStatus.SUCCESS);
    public static final MutationStatus NOT_FOUND = new MutationStatus(PartyMutationStatus.NOT_FOUND);
    public static final MutationStatus INVALID_INPUT = new MutationStatus(PartyMutationStatus.INVALID_INPUT);
    public static final MutationStatus STORAGE_ERROR = new MutationStatus(PartyMutationStatus.STORAGE_ERROR);

    private final PartyMutationStatus status;

    private MutationStatus(PartyMutationStatus status) {
        this.status = status;
    }

    public static MutationStatus fromInternal(PartyMutationStatus status) {
        if (status == null) {
            return STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> SUCCESS;
            case NOT_FOUND -> NOT_FOUND;
            case INVALID_INPUT -> INVALID_INPUT;
            case STORAGE_ERROR -> STORAGE_ERROR;
        };
    }

    public PartyMutationStatus toInternal() {
        return status;
    }

    public String name() {
        return status.name();
    }

    public static MutationStatus valueOf(String value) {
        return switch (value) {
            case "SUCCESS" -> SUCCESS;
            case "NOT_FOUND" -> NOT_FOUND;
            case "INVALID_INPUT" -> INVALID_INPUT;
            case "STORAGE_ERROR" -> STORAGE_ERROR;
            default -> throw new IllegalArgumentException("Unknown MutationStatus: " + value);
        };
    }

    @Override
    public String toString() {
        return status.name();
    }
}
