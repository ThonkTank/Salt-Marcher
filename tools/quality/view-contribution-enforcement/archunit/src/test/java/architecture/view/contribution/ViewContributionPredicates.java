package architecture.view.contribution;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;

final class ViewContributionPredicates {

    private ViewContributionPredicates() {
    }

    static DescribedPredicate<JavaClass> areContributions() {
        return new DescribedPredicate<>("view contribution role classes") {
            @Override
            public boolean test(JavaClass input) {
                return !input.getName().contains("$")
                        && input.getPackageName().matches("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$")
                        && input.getSimpleName().endsWith("Contribution");
            }
        };
    }
}
