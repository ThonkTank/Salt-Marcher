package architecture.view.intenthandler;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
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
public final class ViewIntentHandlerArchitectureTest {

    private static final ConcurrentHashMap<String, Set<String>> PACKAGE_TOP_LEVEL_CLASS_CACHE = new ConcurrentHashMap<>();

    private ViewIntentHandlerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule intentHandlersMustStayShellDomainAndDataFree =
            noClasses()
                    .that(ViewRolePredicates.areIntentHandlers())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.domain..", "src.data..", "bootstrap..");

    @ArchTest
    static final ArchRule intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents =
            classes()
                    .that(ViewRolePredicates.areIntentHandlers())
                    .should(ownMatchingPublishedEventForPublishedEventSink());

    private static ArchCondition<JavaClass> ownMatchingPublishedEventForPublishedEventSink() {
        return new ArchCondition<>("own a same-package PublishedEvent when exposing onPublishedEventRequested(Consumer<PublishedEvent>)") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String publishedEventSimpleName = publishedEventSimpleNameConsumedByHandler(item.getName());
                if (publishedEventSimpleName == null) {
                    return;
                }
                String packageName = item.getPackageName();
                Set<String> packageClassNames = topLevelClassNamesInPackage(packageName);
                if (!packageClassNames.contains(publishedEventSimpleName)) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " exposes onPublishedEventRequested(...) for "
                                    + packageName + "." + publishedEventSimpleName
                                    + " but the package defines no matching local PublishedEvent"));
                }
            }
        };
    }

    private static String publishedEventSimpleNameConsumedByHandler(String className) {
        Class<?> reflectedClass = loadClass(className);
        for (Method method : reflectedClass.getDeclaredMethods()) {
            if (!"onPublishedEventRequested".equals(method.getName())) {
                continue;
            }
            int modifiers = method.getModifiers();
            if (Modifier.isPrivate(modifiers)) {
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
            if (eventType instanceof Class<?> eventClass
                    && eventClass.getPackageName().equals(reflectedClass.getPackageName())
                    && eventClass.getSimpleName().endsWith("PublishedEvent")) {
                return eventClass.getSimpleName();
            }
        }
        return null;
    }

    private static Class<?> loadClass(String className) {
        try {
            return Class.forName(className, false, Thread.currentThread().getContextClassLoader());
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load compiled class " + className, exception);
        }
    }

    private static Set<String> topLevelClassNamesInPackage(String packageName) {
        return PACKAGE_TOP_LEVEL_CLASS_CACHE.computeIfAbsent(packageName, ViewIntentHandlerArchitectureTest::scanTopLevelClassNames);
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
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not scan compiled classes for package " + packageName, exception);
        }
    }

    private static Path mainClassesDir() {
        String mainClassesDir = System.getProperty("saltmarcher.mainClassesDir");
        if (mainClassesDir == null || mainClassesDir.isBlank()) {
            throw new IllegalStateException("saltmarcher.mainClassesDir is not set");
        }
        return Path.of(mainClassesDir);
    }
}
