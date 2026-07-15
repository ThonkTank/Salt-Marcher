package architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.CacheMode;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Tag("architecture")
@AnalyzeClasses(
        locations = MainSourceLocationProvider.class,
        importOptions = {
                ImportOption.DoNotIncludeTests.class,
                ImportOption.DoNotIncludeJars.class
        },
        cacheMode = CacheMode.PER_CLASS)
public @interface AnalyzeMainClasses {
}
