package src.domain.sessionplanner.session.value;

public record SessionRestPlacement(
        SessionEncounterId leftEncounterId,
        SessionEncounterId rightEncounterId,
        SessionRestKind restKind
) {

    public SessionRestPlacement {
        leftEncounterId = leftEncounterId == null ? new SessionEncounterId(1L) : leftEncounterId;
        rightEncounterId = rightEncounterId == null ? new SessionEncounterId(1L) : rightEncounterId;
        restKind = restKind == null ? SessionRestKind.NONE : restKind;
    }
}
