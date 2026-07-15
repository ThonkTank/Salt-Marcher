package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project

class SaltmarcherQualityConventionsPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.registerQualityConventionPackagingTasks(project.createQualityConventionEnvironment())
    }
}
