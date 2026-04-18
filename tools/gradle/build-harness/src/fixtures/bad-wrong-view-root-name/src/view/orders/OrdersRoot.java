package src.view.orders;

import shell.host.AppView;
import shell.host.NavigationGroupSpec;
import shell.host.ShellServices;
import shell.host.ShellViewContribution;
import shell.host.ViewKey;
import shell.host.ViewRegistrationSpec;

public final class OrdersRoot implements ShellViewContribution {
    @Override
    public ViewRegistrationSpec registrationSpec() {
        return new ViewRegistrationSpec(
                new ViewKey("orders"),
                new NavigationGroupSpec("session", "Session", 10),
                20,
                false);
    }

    @Override
    public AppView createView(ShellServices shellServices) {
        return null;
    }
}
