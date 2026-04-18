package src.view.orders.interactor;

import src.domain.orders.ordersAPI;
import src.domain.orders.api.OrderSnapshot;

public final class OrdersInteractor {
    private final ordersAPI api = new ordersAPI();
    private final OrderSnapshot snapshot = new OrderSnapshot("ok");
}
