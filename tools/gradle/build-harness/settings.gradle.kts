pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    includeBuild("../build-logic")
}

includeBuild("../../quality/architecture-policy")

rootProject.name = "build-harness"
