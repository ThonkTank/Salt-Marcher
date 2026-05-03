pluginManagement {
    fun includeSaltmarcherBuild(relativePath: String) {
        val includedBuildRoot = System.getenv("SALTMARCHER_INCLUDED_BUILD_ROOT")
            ?.trim()
            ?.takeIf(String::isNotEmpty)
        includeBuild(
            includedBuildRoot?.let { root -> java.io.File(root, relativePath).absolutePath }
                ?: relativePath
        )
    }
    includeSaltmarcherBuild("tools/gradle/build-logic-settings")
    includeSaltmarcherBuild("tools/gradle/build-logic")
}

plugins {
    id("saltmarcher.settings")
}

rootProject.name = "SaltMarcher"
