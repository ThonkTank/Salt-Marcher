package src.domain.party.published;

public record UpdateCharacterCommand(long id, CharacterDraft draft) {
}
