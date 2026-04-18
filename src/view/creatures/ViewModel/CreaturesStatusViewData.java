package src.view.creatures.ViewModel;

public record CreaturesStatusViewData(
        String text,
        boolean visible,
        boolean error
) {

    public CreaturesStatusViewData {
        text = text == null ? "" : text;
    }

    public static CreaturesStatusViewData hidden() {
        return new CreaturesStatusViewData("", false, false);
    }
}
