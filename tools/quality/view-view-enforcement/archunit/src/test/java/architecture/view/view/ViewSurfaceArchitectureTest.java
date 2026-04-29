package architecture.view.view;

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
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.stream.Stream;
import javafx.scene.Node;

@AnalyzeMainClasses
public final class ViewSurfaceArchitectureTest {

    private static final ConcurrentHashMap<String, Set<String>> PACKAGE_TOP_LEVEL_CLASS_CACHE = new ConcurrentHashMap<>();

    private ViewSurfaceArchitectureTest() {
    }

    @ArchTest
    static final ArchRule passiveViewsMustNotReachShellDomainDataOrBootstrap =
            noClasses()
                    .that(ViewRolePredicates.arePassiveViews())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.domain..", "src.data..", "bootstrap..");

    @ArchTest
    static final ArchRule passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams =
            classes()
                    .that(ViewRolePredicates.arePassiveViews())
                    .should(notExposeCallbackSeamsWithoutLocalIntentHandlerOrViewInputEvent());

    private static ArchCondition<JavaClass> notExposeCallbackSeamsWithoutLocalIntentHandlerOrViewInputEvent() {
        return new ArchCondition<>("avoid outward callback seams when no local IntentHandler or ViewInputEvent exists") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!isCallbackEligiblePassiveView(item) || declaresInteractiveViewInputSeam(item.getName())) {
                    return;
                }
                String packageName = item.getPackageName();
                Set<String> packageClassNames = topLevelClassNamesInPackage(packageName);
                if (countClassesEndingWith(packageClassNames, "IntentHandler") != 0) {
                    return;
                }
                if (packageClassNames.contains(expectedViewInputEventSimpleName(item.getSimpleName()))) {
                    return;
                }
                Set<String> callbackSeams = outwardCallbackSeams(item.getName());
                if (callbackSeams.isEmpty()) {
                    return;
                }
                events.add(SimpleConditionEvent.violated(
                        item,
                        item.getName() + " defines outward callback seams despite having no local *IntentHandler or same-stem *ViewInputEvent: "
                                + String.join(", ", callbackSeams)));
            }
        };
    }

    private static boolean isCallbackEligiblePassiveView(JavaClass javaClass) {
        if (isExcludedReusableCallbackSurface(javaClass.getPackageName())) {
            return false;
        }
        return Node.class.isAssignableFrom(loadClass(javaClass.getName()));
    }

    private static boolean isExcludedReusableCallbackSurface(String packageName) {
        return packageName.startsWith("src.view.slotcontent.primitives.")
                || packageName.startsWith("src.view.slotcontent.controls.");
    }

    private static boolean declaresInteractiveViewInputSeam(String className) {
        Class<?> reflectedClass = loadClass(className);
        String expectedViewInputEvent = expectedViewInputEventSimpleName(reflectedClass.getSimpleName());
        for (Method method : reflectedClass.getDeclaredMethods()) {
            if (!"onViewInputEvent".equals(method.getName())) {
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

    private static Set<String> outwardCallbackSeams(String className) {
        Class<?> reflectedClass = loadClass(className);
        Set<String> seams = new LinkedHashSet<>();
        for (Constructor<?> constructor : reflectedClass.getDeclaredConstructors()) {
            if (Modifier.isPrivate(constructor.getModifiers()) || !containsCallbackSurface(constructor.getGenericParameterTypes())) {
                continue;
            }
            seams.add(reflectedClass.getSimpleName() + "(" + constructor.getParameterCount() + ")");
        }
        for (Method method : reflectedClass.getDeclaredMethods()) {
            if (Modifier.isPrivate(method.getModifiers())) {
                continue;
            }
            if ("onViewInputEvent".equals(method.getName())) {
                seams.add(method.getName() + "(" + method.getParameterCount() + ")");
                continue;
            }
            if (containsCallbackSurface(method.getGenericParameterTypes())
                    || isCallbackSurface(method.getGenericReturnType())) {
                seams.add(method.getName() + "(" + method.getParameterCount() + ")");
            }
        }
        for (Field field : reflectedClass.getDeclaredFields()) {
            if (Modifier.isPrivate(field.getModifiers()) || !isCallbackSurface(field.getGenericType())) {
                continue;
            }
            seams.add(field.getName() + " field");
        }
        return Set.copyOf(seams);
    }

    private static boolean containsCallbackSurface(Type[] parameterTypes) {
        for (Type parameterType : parameterTypes) {
            if (isCallbackSurface(parameterType)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isCallbackSurface(Type type) {
        if (type instanceof ParameterizedType parameterizedType) {
            return isCallbackSurface(parameterizedType.getRawType());
        }
        if (!(type instanceof Class<?> callbackType)) {
            return false;
        }
        return isFunctionalInterface(callbackType)
                || callbackType.getName().startsWith("javafx.event.")
                || callbackType.getName().equals("javafx.beans.InvalidationListener")
                || callbackType.getName().equals("javafx.beans.value.ChangeListener")
                || callbackType.getName().equals("javafx.collections.ListChangeListener")
                || callbackType.getName().equals("javafx.collections.MapChangeListener")
                || callbackType.getName().equals("javafx.collections.SetChangeListener");
    }

    private static boolean isFunctionalInterface(Class<?> type) {
        if (type == null || !type.isInterface()) {
            return false;
        }
        long abstractMethodCount = Arrays.stream(type.getMethods())
                .filter(method -> Modifier.isAbstract(method.getModifiers()))
                .filter(method -> method.getDeclaringClass() != Object.class)
                .count();
        return abstractMethodCount == 1;
    }

    private static Class<?> loadClass(String className) {
        try {
            return Class.forName(className, false, Thread.currentThread().getContextClassLoader());
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load compiled class " + className, exception);
        }
    }

    private static Set<String> topLevelClassNamesInPackage(String packageName) {
        return PACKAGE_TOP_LEVEL_CLASS_CACHE.computeIfAbsent(packageName, ViewSurfaceArchitectureTest::scanTopLevelClassNames);
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

    private static int countClassesEndingWith(Set<String> classNames, String suffix) {
        int count = 0;
        for (String className : classNames) {
            if (className.endsWith(suffix)) {
                count++;
            }
        }
        return count;
    }

    private static String expectedViewInputEventSimpleName(String viewSimpleName) {
        return viewSimpleName + "InputEvent";
    }

    private static Path mainClassesDir() {
        String mainClassesDir = System.getProperty("saltmarcher.mainClassesDir");
        if (mainClassesDir == null || mainClassesDir.isBlank()) {
            throw new IllegalStateException("saltmarcher.mainClassesDir is not set");
        }
        return Path.of(mainClassesDir);
    }
}
