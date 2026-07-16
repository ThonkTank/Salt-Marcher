package platform.ui;

@FunctionalInterface
public interface UiDispatcher {

    void dispatch(Runnable update);
}
