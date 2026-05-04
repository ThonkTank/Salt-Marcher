pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    includeBuild("tools/gradle/build-logic-settings")
    includeBuild("tools/gradle/build-logic")
}

plugins {
    id("saltmarcher.settings")
}

rootProject.name = "SaltMarcher"
