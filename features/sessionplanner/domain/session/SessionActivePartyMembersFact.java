package features.sessionplanner.domain.session;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

public final class SessionActivePartyMembersFact {

    private final boolean available;
    private final List<SessionPartyMemberProfile> members;
    private final Map<Long, SessionPartyMemberProfile> membersByCharacterId;
    private final String statusText;

    public SessionActivePartyMembersFact(
            boolean available,
            List<SessionPartyMemberProfile> members,
            String statusText
    ) {
        this.available = available;
        this.members = members == null ? List.of() : List.copyOf(members);
        this.statusText = statusText == null ? "" : statusText.trim();
        Map<Long, SessionPartyMemberProfile> indexed = new LinkedHashMap<>();
        for (SessionPartyMemberProfile member : this.members) {
            indexed.put(member.characterId(), member);
        }
        this.membersByCharacterId = Map.copyOf(indexed);
    }

    public boolean available() {
        return available;
    }

    public List<SessionPartyMemberProfile> members() {
        return members;
    }

    public String statusText() {
        return statusText;
    }

    public @Nullable SessionPartyMemberProfile resolve(long characterId) {
        return membersByCharacterId.get(characterId);
    }
}
