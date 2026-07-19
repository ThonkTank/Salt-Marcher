package features.sessionplanner.adapter.javafx;

import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

public final class SessionPlannerContribution implements ShellContribution {

    private final SessionPlannerApi planner;
    private final SessionPlannerWorkspaceModel workspace;
    private final java.util.function.Consumer<SessionPlannerWorkspaceApplyObservation> workspaceApplied;

    public SessionPlannerContribution(
            SessionPlannerApi planner,
            SessionPlannerWorkspaceModel workspace,
            java.util.function.Consumer<SessionPlannerWorkspaceApplyObservation> workspaceApplied
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.workspaceApplied = Objects.requireNonNull(workspaceApplied, "workspaceApplied");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("session-planner"),
                new NavigationGroupSpec("planning", "Planning", 10),
                15,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/sessionplanner/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        return new SessionPlannerBinder(planner, workspace, workspaceApplied).bind();
    }
}
