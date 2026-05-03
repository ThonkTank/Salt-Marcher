plugins {
    `kotlin-dsl`
    `java-gradle-plugin`
}

repositories {
    gradlePluginPortal()
    mavenCentral()
}

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
