package saltmarcher.architecture;

import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class ArchitectureRuleLoader {

    private ArchitectureRuleLoader() {
    }

    public static List<ArchitectureRule> instantiateRules(List<String> classNames, String taskName) {
        Set<String> uniqueClassNames = new LinkedHashSet<>(classNames);
        List<ArchitectureRule> rules = new ArrayList<>(uniqueClassNames.size());
        for (String className : uniqueClassNames) {
            rules.add(instantiateRule(className, taskName));
        }
        return List.copyOf(rules);
    }

    private static ArchitectureRule instantiateRule(String className, String taskName) {
        try {
            Class<?> ruleClass = Class.forName(className);
            Object candidate = ruleClass.getDeclaredConstructor().newInstance();
            if (candidate instanceof ArchitectureRule architectureRule) {
                return architectureRule;
            }
            throw new IllegalStateException(
                    taskName + " declared rule " + className + " but it does not implement ArchitectureRule.");
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException(
                    taskName + " declared rule " + className + " but it is missing from the active build-harness classpath.",
                    exception);
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException(
                    taskName + " failed to instantiate declared rule " + className + ".",
                    exception);
        }
    }
}
