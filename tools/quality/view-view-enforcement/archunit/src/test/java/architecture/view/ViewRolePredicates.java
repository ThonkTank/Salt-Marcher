package architecture.view;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;

public final class ViewRolePredicates {

    private ViewRolePredicates() {
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

    private static boolean isTopLevelRole(JavaClass input, String packageRegex, String suffix) {
        return !input.getName().contains("$")
                && input.getPackageName().matches(packageRegex)
                && input.getSimpleName().endsWith(suffix);
    }
}
