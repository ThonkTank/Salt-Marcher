package features.encounter.combat.model;

/**
 * Combat-local payload for adding an active party member to a running combat without
 * leaking the party feature's read DTOs into combat UI/state internals.
 */
public record PartyCombatantCandidate(
        Long partyMemberId,
        String displayName,
        int level
) {}
