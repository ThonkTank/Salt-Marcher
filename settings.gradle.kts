import java.io.File

pluginManagement {
    val saltmarcherToolingPluginRepo = System.getenv("SALTMARCHER_TOOLING_PLUGIN_REPO")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.let(::File)
    val saltmarcherToolingPluginVersion = System.getenv("SALTMARCHER_TOOLING_PLUGIN_VERSION")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
    val saltmarcherUseBinaryToolingPlugins = saltmarcherToolingPluginRepo != null &&
        saltmarcherToolingPluginVersion != null

    repositories {
        if (saltmarcherUseBinaryToolingPlugins) {
            maven(url = uri(saltmarcherToolingPluginRepo!!.absolutePath))
        }
        gradlePluginPortal()
        mavenCentral()
    }

    resolutionStrategy {
        eachPlugin {
            if (
                saltmarcherUseBinaryToolingPlugins &&
                requested.id.id.startsWith("saltmarcher.")
            ) {
                useVersion(saltmarcherToolingPluginVersion!!)
            }
        }
    }

    fun includeSaltmarcherBuild(relativePath: String) {
        val includedBuildRoot = System.getenv("SALTMARCHER_INCLUDED_BUILD_ROOT")
            ?.trim()
            ?.takeIf(String::isNotEmpty)
        includeBuild(
            includedBuildRoot?.let { root -> java.io.File(root, relativePath).absolutePath }
                ?: relativePath
        )
    }
    if (!saltmarcherUseBinaryToolingPlugins) {
        includeSaltmarcherBuild("tools/gradle/build-logic-settings")
        includeSaltmarcherBuild("tools/gradle/build-logic")
    }
}

plugins {
    id("saltmarcher.settings")
}

rootProject.name = "SaltMarcher"
