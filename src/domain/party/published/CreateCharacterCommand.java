package src.domain.party.published;

public record CreateCharacterCommand(CharacterDraft draft, MembershipState membership) {
}
