package saltmarcher.buildlogic.verification

import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.withType
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

class SaltmarcherQualityConventionsPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("saltmarcher.enforcement-bundles")
        project.pluginManager.apply("net.ltgt.errorprone")
        project.configureQualityConventions()
    }
}

internal fun Project.configureQualityConventions() {
    val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
    val environment = createQualityConventionEnvironment(enforcementBundles)
    val toolConfigurations = registerQualityConventionToolConfigurations()
    registerQualityConventionDependencies(toolConfigurations, environment)

    tasks.withType<JavaCompile>().configureEach {
        options.errorprone.enabled.set(false)
    }

    tasks.named<JavaCompile>("compileJava") {
        applyCommonErrorProneOptions(this)
        options.errorprone.error("UnusedLabel")
        options.errorprone.error("UnusedMethod")
        options.errorprone.error("UnusedNestedClass")
        options.errorprone.error("UnusedVariable")
        if (!environment.focusedEnforcementBundleMode) {
            options.errorprone.error("DomainApplicationServiceApiShape")
            options.errorprone.error("DomainModuleFieldPurity")
            options.errorprone.error("DomainPortBoundary")
            options.errorprone.error("DomainPortRoleShape")
            options.errorprone.error("DomainPublicBoundarySignaturePurity")
            options.errorprone.error("DomainPublicConcreteTypeShape")
            options.errorprone.error("DomainRoleShape")
            options.errorprone.error("ServiceRegistryRegistrationPlacement")
            options.errorprone.error("ViewContributionShellApiAllowlist")
            options.errorprone.error("ViewDetailsSlotBoundary")
            options.errorprone.error("ProjectionModelOwnershipNaming")
            options.errorprone.error("ViewReflectionBypass")
            options.errorprone.error("ViewRootDelegation")
        }
    }

    val jqassistantTasks = registerQualityConventionJqassistantTasks(environment, toolConfigurations)
    val lifecycleTasks = registerQualityConventionLifecycleTasks(
        environment = environment,
        toolConfigurations = toolConfigurations,
        checkViewArchitecture = jqassistantTasks.checkViewArchitecture,
        checkNoPublicDeadCode = jqassistantTasks.checkNoPublicDeadCode
    )
    registerQualityConventionHarness(
        environment = environment,
        jqassistantTasks = jqassistantTasks,
        lifecycleTasks = lifecycleTasks
    )
    registerQualityConventionPackagingTasks(environment)
}
