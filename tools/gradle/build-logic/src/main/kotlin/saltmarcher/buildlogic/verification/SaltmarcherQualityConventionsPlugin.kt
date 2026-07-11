package saltmarcher.buildlogic.verification

import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.withType

class SaltmarcherQualityConventionsPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("net.ltgt.errorprone")
        project.configureQualityConventions()
    }
}

internal fun Project.configureQualityConventions() {
    val environment = createQualityConventionEnvironment()
    val toolConfigurations = registerQualityConventionToolConfigurations()
    registerQualityConventionDependencies(toolConfigurations, environment)

    tasks.withType<JavaCompile>().configureEach {
        options.errorprone.enabled.set(false)
    }

    registerQualityConventionLifecycleTasks(
        environment = environment,
        toolConfigurations = toolConfigurations
    )
    registerQualityConventionHarness(
        environment = environment,
        toolConfigurations = toolConfigurations
    )
    registerQualityConventionPackagingTasks(environment)
}
