package src.domain.sessionplanner.model.session.port;

import java.util.List;
import src.domain.sessionplanner.model.session.SessionLocationReference;

public interface SessionLocationReferencePort {

    List<SessionLocationReference> availableLocations();

    boolean locationExists(long locationId);
}
