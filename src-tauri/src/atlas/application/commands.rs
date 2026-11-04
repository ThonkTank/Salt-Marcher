//! One local command list binds decoding, typed execution and development exports.
use super::map_tiles::{MapTilesArgs, MapTilesResponse};
use super::AtlasApplication;
use crate::atlas::errors::storage_error;
use crate::atlas::model::*;
use crate::atlas::{reads, Result};
use serde::Deserialize;
use serde_json::Value;
use std::path::Path;

// This is only the Atlas command list: no dynamic registry or additional queue.
macro_rules! commands {
    ($($variant:ident, $name:literal, $args:ty, $output:ty, $handler:path, $access:ident;)*) => {
        #[derive(Deserialize)]
        #[serde(tag = "cmd", content = "args")]
        pub(in crate::atlas) enum Request {
            $(#[serde(rename = $name)] $variant($args),)*
        }
        impl Request {
            pub(in crate::atlas) fn dispatch(self, app: &mut AtlasApplication) -> Result<Value> {
                match self {
                    $(Self::$variant(args) => $handler(app, args).and_then(|value: $output|
                        serde_json::to_value(value).map_err(storage_error)
                    ),)*
                }
            }
        }
        #[cfg(test)]
        #[allow(non_snake_case, dead_code)]
        #[derive(ts_rs::TS)]
        struct AllCommands {
            $(#[ts(rename = $name)] $variant: CommandContract<$args, $output>,)*
        }
        #[cfg(test)]
        pub(in crate::atlas) fn export(cfg: &ts_rs::Config) {
            use ts_rs::TS;
            AllCommands::export_all(cfg).unwrap();
            let classifications = [$(($name, Access::$access),)*];
            let keys = |access: Access| classifications.iter()
                .filter(|(_, kind)| match access {
                    Access::Client => *kind != Access::Adapter,
                    other => *kind == other,
                })
                .map(|(name, _)| format!("{name:?}"))
                .collect::<Vec<_>>().join(" | ");
            std::fs::write(cfg.out_dir().join("Commands.ts"), format!(
                "// Generated from the Atlas Rust command list. Do not edit.\nimport type {{ AllCommands }} from './AllCommands';\nexport type Commands = Pick<AllCommands, {}>;\nexport type ReadCommands = Pick<Commands, {}>;\nexport type AdapterCommands = Pick<AllCommands, {}>;\n",
                keys(Access::Client), keys(Access::Read), keys(Access::Adapter)
            )).unwrap();
        }
    };
}
#[cfg(test)]
#[derive(ts_rs::TS)]
#[allow(dead_code)]
struct CommandContract<A, O> {
    args: A,
    result: O,
}

#[cfg(test)]
#[derive(Clone, Copy, PartialEq, Eq)]
enum Access {
    Client,
    Read,
    Adapter,
}

commands! {
    Status, "status", EmptyArgs, Status, status, Client;
    New, "new", EmptyArgs, Status, new, Client;
    Extent, "extent", EmptyArgs, Option<Bounds>, extent, Client;
    MapTiles, "mapTiles", MapTilesArgs, MapTilesResponse, map_tiles, Read;
    Scene, "scene", SceneArgs, SceneResponse, scene, Read;
    InteriorMetadata, "interiorMetadata", InteriorMetadataArgs, InteriorMetadataResponse, interior_metadata, Read;
    InteriorTile, "interiorTile", InteriorTileArgs, InteriorTileResponse, interior_tile, Read;
    Preview, "preview", EditArgs, PreviewWire, preview, Client;
    Commit, "commit", EditArgs, ValidPreviewWire, commit, Client;
    History, "history", HistoryArgs, Status, history, Client;
    Detail, "detail", DetailArgs, DetailResponse, detail, Adapter;
    Save, "save", PathArgs, Status, save, Adapter;
    Open, "open", PathArgs, Status, open, Adapter;
}
fn status(app: &mut AtlasApplication, _: EmptyArgs) -> Result<Status> {
    Ok(app.status())
}
fn new(app: &mut AtlasApplication, _: EmptyArgs) -> Result<Status> {
    *app = AtlasApplication::new()?;
    Ok(app.status())
}
fn extent(app: &mut AtlasApplication, _: EmptyArgs) -> Result<Option<Bounds>> {
    app.extent()
}
fn scene(app: &mut AtlasApplication, input: SceneArgs) -> Result<SceneResponse> {
    reads::scene(app, input)
}
fn interior_metadata(
    app: &mut AtlasApplication,
    input: InteriorMetadataArgs,
) -> Result<InteriorMetadataResponse> {
    reads::interior_metadata(app, input)
}
fn interior_tile(
    app: &mut AtlasApplication,
    input: InteriorTileArgs,
) -> Result<InteriorTileResponse> {
    reads::interior_tile(app, input)
}
fn detail(app: &mut AtlasApplication, input: DetailArgs) -> Result<DetailResponse> {
    reads::detail(app, input)
}
fn preview(app: &mut AtlasApplication, input: EditArgs) -> Result<PreviewWire> {
    app.preview(input)
}
fn commit(app: &mut AtlasApplication, input: EditArgs) -> Result<ValidPreviewWire> {
    app.commit(input)
}
fn history(app: &mut AtlasApplication, input: HistoryArgs) -> Result<Status> {
    app.check(&input.version)?;
    app.history(input.redo)?;
    Ok(app.status())
}
fn save(app: &mut AtlasApplication, input: PathArgs) -> Result<Status> {
    app.save(Path::new(&input.path))
}
fn open(app: &mut AtlasApplication, input: PathArgs) -> Result<Status> {
    app.open(Path::new(&input.path))
}

fn map_tiles(app: &mut AtlasApplication, input: MapTilesArgs) -> Result<MapTilesResponse> {
    app.map_tiles(input)
}
