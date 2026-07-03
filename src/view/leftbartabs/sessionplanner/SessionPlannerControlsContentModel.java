package src.view.leftbartabs.sessionplanner;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;

public final class SessionPlannerControlsContentModel {

    private static final long NO_SESSION_ID = 0L;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private SessionPlannerSessionSnapshot sessionSnapshot = SessionPlannerSessionSnapshot.empty("");

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applySession(SessionPlannerSessionSnapshot snapshot) {
        sessionSnapshot = snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
        refreshProjection();
    }

    boolean hasCurrentSession() {
        return projection.get().session().hasCurrentSession();
    }

    private void refreshProjection() {
        projection.set(Projection.from(sessionSnapshot));
    }

    record Projection(
            String statusText,
            Projection.SessionModel session,
            List<Projection.AvailablePlanModel> availablePlans
    ) {

        Projection {
            statusText = safeText(statusText);
            session = session == null ? SessionModel.empty() : session;
            availablePlans = safeCopy(availablePlans);
        }

        static Projection empty() {
            return new Projection("", SessionModel.empty(), List.of());
        }

        static Projection from(SessionPlannerSessionSnapshot snapshot) {
            SessionPlannerSessionSnapshot safeSnapshot =
                    snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
            boolean hasCurrentSession = safeSnapshot.session().sessionId() > NO_SESSION_ID;
            return new Projection(
                    safeSnapshot.status(),
                    new SessionModel(safeSnapshot.session().sessionId()),
                    safeSnapshot.availableEncounterPlans().stream()
                            .map(plan -> mapAvailablePlan(plan, hasCurrentSession))
                            .toList());
        }

        private static AvailablePlanModel mapAvailablePlan(
                SessionPlannerSessionSnapshot.AvailableEncounterPlan plan,
                boolean hasCurrentSession
        ) {
            boolean importEnabled = hasCurrentSession && plan.importEnabled();
            return new AvailablePlanModel(
                    plan.planId(),
                    plan.name(),
                    plan.summaryText(),
                    plan.statusText(),
                    "An Session anhaengen",
                    "accent",
                    !importEnabled);
        }

        record SessionModel(long sessionId) {

            SessionModel {
                sessionId = Math.max(0L, sessionId);
            }

            boolean hasCurrentSession() {
                return sessionId > NO_SESSION_ID;
            }

            static SessionModel empty() {
                return new SessionModel(0L);
            }
        }

        record AvailablePlanModel(
                long planId,
                String name,
                String summaryText,
                String statusText,
                String actionText,
                String actionStyleClass,
                boolean actionDisabled
        ) {

            AvailablePlanModel {
                planId = Math.max(0L, planId);
                name = safeText(name);
                summaryText = safeText(summaryText);
                statusText = safeText(statusText);
                actionText = safeText(actionText);
                actionStyleClass = safeText(actionStyleClass);
            }
        }

        private static <T> List<T> safeCopy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }

        private static String safeText(String text) {
            return text == null ? "" : text;
        }
    }
}
