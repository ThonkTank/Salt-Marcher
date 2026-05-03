package architecture.view;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;

public final class ViewRolePredicates {

    private ViewRolePredicates() {
    }

    public static DescribedPredicate<JavaClass> areBinders() {
        return rolePredicate(
                "view binder role classes",
                "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$",
                "Binder");
    }

    public static DescribedPredicate<JavaClass> areIntentHandlers() {
        return new DescribedPredicate<>("view intent handler role classes") {
            @Override
            public boolean test(JavaClass input) {
                return isTopLevelRole(input, "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$", "IntentHandler")
                        || isTopLevelRole(input, "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$", "IntentHandler");
            }
        };
    }

    public static DescribedPredicate<JavaClass> areContentModels() {
        return rolePredicate(
                "view content model role classes",
                "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$",
                "ContentModel");
    }

    public static DescribedPredicate<JavaClass> arePassiveViews() {
        return new DescribedPredicate<>("passive view role classes") {
            @Override
            public boolean test(JavaClass input) {
                if (!isTopLevelRole(input, "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$", "View")
                        && !isTopLevelRole(input, "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$", "View")) {
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

    public static DescribedPredicate<JavaClass> areViewInputEvents() {
        return new DescribedPredicate<>("view input event role classes") {
            @Override
            public boolean test(JavaClass input) {
                return isTopLevelRole(input, "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$", "ViewInputEvent")
                        || isTopLevelRole(input, "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$", "ViewInputEvent");
            }
        };
    }

    public static DescribedPredicate<JavaClass> arePublishedEvents() {
        return new DescribedPredicate<>("published event role classes") {
            @Override
            public boolean test(JavaClass input) {
                return isTopLevelRole(input, "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$", "PublishedEvent")
                        || isTopLevelRole(input, "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$", "PublishedEvent");
            }
        };
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
