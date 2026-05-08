package architecture.view;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;

public final class ViewRolePredicates {

    private static final String ACTIVE_ROOT_PACKAGE =
            "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$";
    private static final String REUSABLE_SLOTCONTENT_PACKAGE =
            "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$";

    private ViewRolePredicates() {
    }

    public static DescribedPredicate<JavaClass> arePassiveViews() {
        return new DescribedPredicate<>("passive view role classes") {
            @Override
            public boolean test(JavaClass input) {
                if (!isTopLevelRole(input, ACTIVE_ROOT_PACKAGE, "View")
                        && !isTopLevelRole(input, REUSABLE_SLOTCONTENT_PACKAGE, "View")) {
                    return false;
                }
                String simpleName = input.getSimpleName();
                return !simpleName.endsWith("ViewModel")
                        && !simpleName.endsWith("PresentationModel")
                        && !simpleName.endsWith("ContributionModel")
                        && !simpleName.endsWith("ContentModel");
            }
        };
    }

    public static DescribedPredicate<JavaClass> areContributions() {
        return rolePredicate("view contribution role classes", ACTIVE_ROOT_PACKAGE, "Contribution");
    }

    public static DescribedPredicate<JavaClass> areBinders() {
        return rolePredicate("view binder role classes", ACTIVE_ROOT_PACKAGE, "Binder");
    }

    public static DescribedPredicate<JavaClass> areContributionModels() {
        return rolePredicate("view contribution model role classes", ACTIVE_ROOT_PACKAGE, "ContributionModel");
    }

    public static DescribedPredicate<JavaClass> areContentModels() {
        return rolePredicate("view content model role classes", REUSABLE_SLOTCONTENT_PACKAGE, "ContentModel");
    }

    public static DescribedPredicate<JavaClass> areIntentHandlers() {
        return rolePredicate("view intent handler role classes", ACTIVE_ROOT_PACKAGE, "IntentHandler");
    }

    public static DescribedPredicate<JavaClass> areViewInputEvents() {
        return new DescribedPredicate<>("view input event role classes") {
            @Override
            public boolean test(JavaClass input) {
                return isTopLevelRole(input, ACTIVE_ROOT_PACKAGE, "ViewInputEvent")
                        || isTopLevelRole(input, REUSABLE_SLOTCONTENT_PACKAGE, "ViewInputEvent");
            }
        };
    }

    public static DescribedPredicate<JavaClass> arePublishedEvents() {
        return rolePredicate("view published event role classes", ACTIVE_ROOT_PACKAGE, "PublishedEvent");
    }

    private static DescribedPredicate<JavaClass> rolePredicate(
            String description,
            String packageRegex,
            String suffix
    ) {
        return new DescribedPredicate<>(description) {
            @Override
            public boolean test(JavaClass input) {
                return isTopLevelRole(input, packageRegex, suffix);
            }
        };
    }

    private static boolean isTopLevelRole(JavaClass input, String packageRegex, String suffix) {
        return !input.getName().contains("$")
                && input.getPackageName().matches(packageRegex)
                && input.getSimpleName().endsWith(suffix);
    }
}
