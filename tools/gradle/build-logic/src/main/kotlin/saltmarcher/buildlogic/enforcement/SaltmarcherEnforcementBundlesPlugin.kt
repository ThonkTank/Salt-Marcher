package saltmarcher.buildlogic.enforcement

import org.gradle.api.Plugin
import org.gradle.api.Project

class SaltmarcherEnforcementBundlesPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.extensions.add(
            EnforcementBundlesExtension::class.java,
            "saltmarcherEnforcementBundles",
            loadEnforcementBundlesExtension(project.rootDir)
        )
    }
}
