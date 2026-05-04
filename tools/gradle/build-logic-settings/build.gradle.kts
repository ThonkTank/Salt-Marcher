import org.gradle.jvm.tasks.Jar

plugins {
    `kotlin-dsl`
    `java-gradle-plugin`
}

repositories {
    gradlePluginPortal()
    mavenCentral()
}

group = "saltmarcher.tooling"
version = providers.systemProperty("saltmarcher.toolingPluginVersion")
    .orElse(providers.environmentVariable("SALTMARCHER_TOOLING_PLUGIN_VERSION"))
    .orElse("1.0-SNAPSHOT")
    .get()

kotlin {
    jvmToolchain(21)
}

gradlePlugin {
    plugins {
        register("saltmarcherSettings") {
            id = "saltmarcher.settings"
            implementationClass = "saltmarcher.buildlogic.settings.SaltmarcherRootSettingsPlugin"
        }
    }
}

tasks.named<Jar>("jar") {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
