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

    if (!saltmarcherUseBinaryToolingPlugins) {
        includeBuild("../build-logic")
    }
}

rootProject.name = "build-harness"
