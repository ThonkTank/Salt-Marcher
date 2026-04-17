package src.view.orders.View;

public final class OrdersView {
    public OrdersView() {
        label().setStyle("-fx-font-weight: bold;");
    }

    private FakeLabel label() {
        return new FakeLabel();
    }

    private static final class FakeLabel {
        void setStyle(String style) {
        }
    }
}
