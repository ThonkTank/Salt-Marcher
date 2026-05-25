pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    includeBuild("../../../gradle/build-logic")
}

includeBuild("../../architecture-policy")

rootProject.name = "quality-rules"
