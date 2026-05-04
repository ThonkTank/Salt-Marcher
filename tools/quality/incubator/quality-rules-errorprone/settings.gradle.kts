pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    includeBuild("../../../gradle/build-logic")
}

rootProject.name = "quality-rules-errorprone"
