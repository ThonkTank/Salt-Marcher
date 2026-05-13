package src.view.slotcontent.primitives.progressmeter;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;

public final class ProgressMeterContentModel {

    private final ReadOnlyObjectWrapper<MeterState> meterState =
            new ReadOnlyObjectWrapper<>(MeterState.initial());

    public ReadOnlyObjectProperty<MeterState> meterStateProperty() {
        return meterState.getReadOnlyProperty();
    }

    public MeterState currentMeterState() {
        return meterState.get();
    }

    public void showMeter(MeterDisplay meterDisplay) {
        MeterDisplay safeDisplay = meterDisplay == null ? MeterDisplay.initial() : meterDisplay;
        MeterState current = meterState.get();
        meterState.set(new MeterState(
                normalizeFraction(safeDisplay.fraction()),
                safeDisplay.text(),
                safeDisplay.accessibleText(),
                safeDisplay.fillStyleClass(),
                safeDisplay.sizeStyleClass(),
                current.tooltipText(),
                current.initialAmount(),
                current.amountDraft(),
                current.popupOpen(),
                current.popupActions()));
    }

    public void configurePopup(@Nullable String tooltipText, int initialAmount, List<PopupActionModel> popupActions) {
        MeterState current = meterState.get();
        List<PopupActionModel> safeActions = popupActions == null ? List.of() : List.copyOf(popupActions);
        int safeInitialAmount = Math.max(1, initialAmount);
        meterState.set(new MeterState(
                current.fraction(),
                current.text(),
                current.accessibleText(),
                current.fillStyleClass(),
                current.sizeStyleClass(),
                safe(tooltipText),
                safeInitialAmount,
                safeInitialAmount,
                current.popupOpen() && !safeActions.isEmpty(),
                safeActions));
    }

    public void hidePopupActions() {
        configurePopup("", 1, List.of());
    }

    public void applyPopupInteraction(PopupInteraction interaction) {
        PopupInteraction safeInteraction = interaction == null
                ? PopupInteraction.hide()
                : interaction;
        MeterState current = meterState.get();
        meterState.set(safeInteraction.apply(current));
    }

    public record MeterDisplay(
            double fraction,
            String text,
            String accessibleText,
            String fillStyleClass,
            String sizeStyleClass
    ) {

        public MeterDisplay {
            fraction = normalizeFraction(fraction);
            text = safe(text);
            accessibleText = safe(accessibleText).isBlank() ? text : safe(accessibleText);
            fillStyleClass = safe(fillStyleClass);
            sizeStyleClass = safe(sizeStyleClass);
        }

        public static MeterDisplay initial() {
            return new MeterDisplay(0.0, "", "", "", "");
        }
    }

    private static double normalizeFraction(double fraction) {
        return Math.max(0.0, Math.min(1.0, fraction));
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

    public record PopupInteraction(
            Kind kind,
            String rawAmount
    ) {

        public PopupInteraction {
            kind = kind == null ? Kind.HIDE : kind;
            rawAmount = safe(rawAmount);
        }

        public static PopupInteraction show() {
            return new PopupInteraction(Kind.SHOW, "");
        }

        public static PopupInteraction hide() {
            return new PopupInteraction(Kind.HIDE, "");
        }

        public static PopupInteraction decrease() {
            return new PopupInteraction(Kind.DECREASE, "");
        }

        public static PopupInteraction increase() {
            return new PopupInteraction(Kind.INCREASE, "");
        }

        public static PopupInteraction amountDraft(@Nullable String rawAmount) {
            return new PopupInteraction(Kind.AMOUNT_DRAFT, rawAmount);
        }

        private MeterState apply(MeterState current) {
            return switch (kind) {
                case SHOW -> current.popupActions().isEmpty()
                        ? current
                        : current.withPopupState(true, current.initialAmount());
                case HIDE -> current.withPopupState(false, current.amountDraft());
                case DECREASE -> current.withPopupState(current.popupOpen(), Math.max(1, current.amountDraft() - 1));
                case INCREASE -> current.withPopupState(current.popupOpen(), current.amountDraft() + 1);
                case AMOUNT_DRAFT -> current.withPopupState(current.popupOpen(), parse(rawAmount, current.amountDraft()));
            };
        }

        private static int parse(@Nullable String rawAmount, int fallback) {
            try {
                return Math.max(1, Integer.parseInt(safe(rawAmount)));
            } catch (NumberFormatException exception) {
                return Math.max(1, fallback);
            }
        }

        public enum Kind {
            SHOW,
            HIDE,
            DECREASE,
            INCREASE,
            AMOUNT_DRAFT
        }
    }

    public record MeterState(
            double fraction,
            String text,
            String accessibleText,
            String fillStyleClass,
            String sizeStyleClass,
            String tooltipText,
            int initialAmount,
            int amountDraft,
            boolean popupOpen,
            List<PopupActionModel> popupActions
    ) {

        public MeterState {
            fraction = normalizeFraction(fraction);
            text = safe(text);
            accessibleText = safe(accessibleText).isBlank() ? text : safe(accessibleText);
            fillStyleClass = safe(fillStyleClass);
            sizeStyleClass = safe(sizeStyleClass);
            tooltipText = safe(tooltipText);
            initialAmount = Math.max(1, initialAmount);
            amountDraft = Math.max(1, amountDraft);
            popupActions = popupActions == null ? List.of() : List.copyOf(popupActions);
        }

        static MeterState initial() {
            return new MeterState(0.0, "", "", "", "", "", 1, 1, false, List.of());
        }

        private MeterState withPopupState(boolean popupOpen, int amountDraft) {
            return new MeterState(
                    fraction,
                    text,
                    accessibleText,
                    fillStyleClass,
                    sizeStyleClass,
                    tooltipText,
                    initialAmount,
                    amountDraft,
                    popupOpen,
                    popupActions);
        }

        public boolean hasPopupActions() {
            return !popupActions.isEmpty();
        }

        public boolean popupVisible() {
            return popupOpen && hasPopupActions();
        }

        public boolean hasTooltip() {
            return !tooltipText.isBlank();
        }

        public boolean hasFillStyle() {
            return !fillStyleClass.isBlank();
        }

        public boolean hasSizeStyle() {
            return !sizeStyleClass.isBlank();
        }
    }

    public record PopupActionModel(
            String actionId,
            String label,
            String styleClass,
            boolean defaultButton
    ) {

        public PopupActionModel {
            actionId = safe(actionId);
            label = safe(label);
            styleClass = safe(styleClass);
        }
    }
}
