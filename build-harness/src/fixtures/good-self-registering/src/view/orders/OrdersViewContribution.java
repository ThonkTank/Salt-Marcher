package src.view.orders;

import shell.host.NavigationGroupSpec;
import shell.host.ShellScreen;
import shell.host.ShellViewContribution;
import shell.host.ViewKey;
import shell.host.ViewRegistrationSpec;
import src.view.orders.View.OrdersView;

public final class OrdersViewContribution implements ShellViewContribution {
    @Override
    public ViewRegistrationSpec registrationSpec() {
        return new ViewRegistrationSpec(
                new ViewKey("orders"),
                new NavigationGroupSpec("session", "Session", 10),
                20,
                true);
    }

    @Override
    public ShellScreen createScreen() {
        return new OrdersView();
    }
}
