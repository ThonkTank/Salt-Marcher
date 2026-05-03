package architecture.view.viewlayer;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.junit.ArchTest;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.stream.Stream;

@AnalyzeMainClasses
public final class ViewLayerArchitectureTest {

    private static final ConcurrentHashMap<String, Set<String>> PACKAGE_TOP_LEVEL_CLASS_CACHE = new ConcurrentHashMap<>();

    private ViewLayerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule interactiveSlotcontentViewsMustOwnExactlyOneContentModel =
            classes()
                    .that(arePassiveViews())
                    .should(defineExactlyOneContentModelWhenExposingOnViewInputEvent());

    private static DescribedPredicate<JavaClass> arePassiveViews() {
        return new DescribedPredicate<>("view-layer passive view role classes") {
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

    private static ArchCondition<JavaClass> defineExactlyOneContentModelWhenExposingOnViewInputEvent() {
        return new ArchCondition<>("define exactly one local ContentModel when exposing onViewInputEvent from slotcontent") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String packageName = item.getPackageName();
                if (!packageName.startsWith("src.view.slotcontent.") || !declaresInteractiveViewInputSeam(item.getName())) {
                    return;
                }
                Set<String> packageClassNames = topLevelClassNamesInPackage(packageName);
                long contentModelCount = packageClassNames.stream()
                        .filter(className -> className.endsWith("ContentModel"))
                        .count();
                if (contentModelCount != 1) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " exposes onViewInputEvent(...) but its reusable slotcontent package must define exactly one *ContentModel"));
                }
            }
        };
    }

    private static boolean declaresInteractiveViewInputSeam(String className) {
        Class<?> reflectedClass = loadClass(className);
        String expectedViewInputEvent = reflectedClass.getSimpleName() + "InputEvent";
        for (Method method : reflectedClass.getDeclaredMethods()) {
            if (!"onViewInputEvent".equals(method.getName())) {
                continue;
            }
            if (method.getParameterCount() != 1
                    || method.getReturnType() != void.class
                    || method.getParameterTypes()[0] != Consumer.class) {
                continue;
            }
            Type genericParameter = method.getGenericParameterTypes()[0];
            if (!(genericParameter instanceof ParameterizedType parameterizedType)
                    || parameterizedType.getRawType() != Consumer.class
                    || parameterizedType.getActualTypeArguments().length != 1) {
                continue;
            }
            Type eventType = parameterizedType.getActualTypeArguments()[0];
            if (!(eventType instanceof Class<?> eventClass)) {
                continue;
            }
            if (eventClass.getPackageName().equals(reflectedClass.getPackageName())
                    && eventClass.getSimpleName().equals(expectedViewInputEvent)) {
                return true;
            }
        }
        return false;
    }

    private static Class<?> loadClass(String className) {
        try {
            return Class.forName(className, false, Thread.currentThread().getContextClassLoader());
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load compiled class " + className, exception);
        }
    }

    private static Set<String> topLevelClassNamesInPackage(String packageName) {
        return PACKAGE_TOP_LEVEL_CLASS_CACHE.computeIfAbsent(packageName, ViewLayerArchitectureTest::scanTopLevelClassNames);
    }

    private static Set<String> scanTopLevelClassNames(String packageName) {
        Path packageDirectory = mainClassesDir().resolve(packageName.replace('.', '/'));
        if (!Files.isDirectory(packageDirectory)) {
            return Set.of();
        }
        try (Stream<Path> files = Files.list(packageDirectory)) {
            Set<String> classNames = new LinkedHashSet<>();
            files.filter(path -> path.getFileName().toString().endsWith(".class"))
                    .map(path -> path.getFileName().toString())
                    .filter(fileName -> !fileName.contains("$"))
                    .map(fileName -> fileName.substring(0, fileName.length() - ".class".length()))
                    .forEach(classNames::add);
            return Set.copyOf(classNames);
        } catch (java.io.IOException exception) {
            throw new java.io.UncheckedIOException("Could not scan compiled classes for package " + packageName, exception);
        }
    }

    private static Path mainClassesDir() {
        String mainClassesDir = System.getProperty("saltmarcher.mainClassesDir");
        if (mainClassesDir == null || mainClassesDir.isBlank()) {
            throw new IllegalStateException("saltmarcher.mainClassesDir is not set");
        }
        return Path.of(mainClassesDir);
    }

    private static boolean isTopLevelRole(JavaClass input, String packageRegex, String suffix) {
        return !input.getName().contains("$")
                && input.getPackageName().matches(packageRegex)
                && input.getSimpleName().endsWith(suffix);
    }
}
