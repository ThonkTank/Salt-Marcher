val repoRootDir = file("../../../..").canonicalFile
if (System.getProperty("saltmarcher.repoRootDir").isNullOrBlank()) {
    System.setProperty("saltmarcher.repoRootDir", repoRootDir.absolutePath)
}

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    includeBuild("../../../gradle/build-logic")
}

rootProject.name = "quality-rules-errorprone"
