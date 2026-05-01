package architecture.view.contributionmodel;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;

final class ViewContributionModelPredicates {

    private ViewContributionModelPredicates() {
    }

    static DescribedPredicate<JavaClass> areContributionModels() {
        return new DescribedPredicate<>("view contribution model role classes") {
            @Override
            public boolean test(JavaClass input) {
                return !input.getName().contains("$")
                        && input.getPackageName().matches("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$")
                        && input.getSimpleName().endsWith("ContributionModel");
            }
        };
    }
}
