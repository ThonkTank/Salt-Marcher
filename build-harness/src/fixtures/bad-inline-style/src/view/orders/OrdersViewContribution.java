package src.view.orders;

import shell.host.ShellScreen;
import shell.host.ShellViewContribution;
import src.view.orders.View.OrdersView;

public final class OrdersViewContribution implements ShellViewContribution {
    @Override
    public ShellScreen createScreen() {
        return new OrdersView();
    }
}
