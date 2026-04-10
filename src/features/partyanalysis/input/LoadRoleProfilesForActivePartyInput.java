package features.partyanalysis.input;

import features.partyanalysis.model.CreatureRoleProfile;

import java.util.Map;

@SuppressWarnings("unused")
public record LoadRoleProfilesForActivePartyInput() {

    public record LoadedRoleProfilesForActivePartyInput(
            Map<Long, CreatureRoleProfile> roleProfilesByCreatureId
    ) {
    }
}
