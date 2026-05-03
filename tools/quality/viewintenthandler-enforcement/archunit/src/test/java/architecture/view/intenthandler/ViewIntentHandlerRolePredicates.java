package architecture.view.intenthandler;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;

final class ViewIntentHandlerRolePredicates {

    private ViewIntentHandlerRolePredicates() {
    }

    static DescribedPredicate<JavaClass> areIntentHandlers() {
        return new DescribedPredicate<>("view intent handler role classes") {
            @Override
            public boolean test(JavaClass input) {
                return isTopLevelRole(input, "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$", "IntentHandler")
                        || isTopLevelRole(input, "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$", "IntentHandler");
            }
        };
    }

    private static boolean isTopLevelRole(JavaClass input, String packageRegex, String suffix) {
        return !input.getName().contains("$")
                && input.getPackageName().matches(packageRegex)
                && input.getSimpleName().endsWith(suffix);
    }
}
