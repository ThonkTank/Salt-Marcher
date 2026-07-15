package saltmarcher.buildlogic.settings

import org.gradle.api.Plugin
import org.gradle.api.initialization.Settings

class SaltmarcherRootSettingsPlugin : Plugin<Settings> {
    override fun apply(settings: Settings) {
        includeSaltmarcherBuild(settings, "tools/quality/rules/quality-rules")
    }
}

private fun includeSaltmarcherBuild(settings: Settings, relativePath: String) = settings.includeBuild(relativePath)
