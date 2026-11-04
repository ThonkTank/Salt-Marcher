//! Proof of the exceptional wire shapes before migrating the TypeScript client.
use super::model::*;
use super::{generation::GenerationResponse, AppError, AtlasApplication, DomainIssue, IssueCode};
use crate::interior::{ConnectionIntent, InteriorConnection};
use serde_json::json;
use ts_rs::{Config, TS};

fn config() -> Config {
    // JSON.stringify/serde_json transport represents all integer fields as numbers.
    Config::new().with_large_int("number")
}

#[test]
fn generated_contract_exceptional_shapes() {
    let cfg = config();
    assert_eq!(QuarterTurns::inline(&cfg), "0 | 1 | 2 | 3");
    assert_eq!(AlgorithmVersion::inline(&cfg), "3");
    assert_eq!(True::inline(&cfg), "true");
    assert_eq!(False::inline(&cfg), "false");
    assert!(SceneArgs::decl(&cfg).contains("selectedId?: string | null"));
    assert!(HistoryArgs::decl(&cfg).contains("redo?: boolean"));
    assert!(ConnectionIntent::decl(&cfg).contains("length?: number"));
    assert!(ExistingNodeInput::decl(&cfg).contains("incoming: [number, number] | null"));
    assert!(!ExistingNodeInput::decl(&cfg).contains("incoming?"));
    assert!(Status::decl(&cfg).contains("changes: ChangeHints | null"));
    assert!(DomainIssue::decl(&cfg).contains("geometry?: IssueGeometry"));
    assert!(!DomainIssue::decl(&cfg).contains("geometry?: IssueGeometry | null"));
    assert!(AppError::decl(&cfg).contains("issue?: DomainIssue"));
    // The raw wire connection truth includes nullable toRoom for either shape.
    assert!(InteriorConnection::decl(&cfg).contains("toRoom: string | null"));
    assert!(ValidPreviewWire::decl(&cfg).contains("valid: True"));
    assert!(InvalidPreviewWire::decl(&cfg).contains("valid: False"));
    assert!(!Intent::decl(&cfg).contains("bigint"));
}

#[test]
fn preview_projections_preserve_json_contract() {
    let status = AtlasApplication::new().unwrap().status();
    let version = Version {
        session_id: status.session_id.clone(),
        revision: status.revision,
    };
    let success = ValidPreviewWire {
        terrain: None,
        valid: True,
        version: version.clone(),
        status: Box::new(status.clone()),
        objects: vec![],
        removed: vec!["old".into()],
        deleted_ids: vec!["old".into()],
        cascade_counts: CascadeCounts::default(),
        generation: GenerationResponse::default(),
        removed_connections: vec![],
        changed: true,
    };
    assert_eq!(
        serde_json::to_value(success).unwrap(),
        json!({
            "valid": true, "version": version, "status": status, "objects": [],
            "removed": ["old"], "deletedIds": ["old"],
            "cascadeCounts": {"roads":0,"parcels":0,"houses":0,"rooms":0,"connections":0},
            "generationSummary": {"createdParcels":0,"createdHouses":0,"emptyParcels":0,"skippedParcels":0,"unplacedHouses":0,"limited":false},
            "generationDiagnostics": [], "generationLimit": null,
            "removedConnections": [], "changed": true,
        })
    );
    let issue = DomainIssue {
        code: IssueCode::InvalidInput,
        object_ids: vec![],
        message: "invalid".into(),
        geometry: None,
    };
    let invalid = InvalidPreviewWire {
        valid: False,
        objects: [],
        removed: [],
        changed: False,
        proposed_objects: vec![],
        generation: GenerationResponse::default(),
        version: version.clone(),
        reason: "invalid".into(),
        issues: [issue.clone()],
    };
    assert_eq!(
        serde_json::to_value(invalid).unwrap(),
        json!({
            "valid": false, "version": version, "reason":"invalid", "proposedObjects":[],
            "issues":[issue], "objects":[], "removed":[], "changed":false,
            "generationSummary": {"createdParcels":0,"createdHouses":0,"emptyParcels":0,"skippedParcels":0,"unplacedHouses":0,"limited":false},
            "generationDiagnostics":[],"generationLimit":null,
        })
    );
}

#[test]
fn defaults_nullability_and_literal_serialization_match() {
    for value in 0..=3 {
        assert_eq!(
            serde_json::to_value(QuarterTurns(value)).unwrap(),
            json!(value)
        );
    }
    assert!(serde_json::from_value::<QuarterTurns>(json!(4)).is_err());
    assert_eq!(serde_json::to_value(AlgorithmVersion).unwrap(), json!(3));
    assert!(serde_json::from_value::<AlgorithmVersion>(json!(1)).is_err());
    let missing = json!({"id":"n", "point":[0,0], "outgoing":null});
    assert!(serde_json::from_value::<ExistingNodeInput>(missing.clone()).is_err());
    let mut present = missing;
    present["incoming"] = json!(null);
    assert!(serde_json::from_value::<ExistingNodeInput>(present).is_ok());
    let args = json!({"bounds":[0,0,1,1],"context":{"kind":"exterior"}});
    assert!(serde_json::from_value::<SceneArgs>(args)
        .unwrap()
        .selected_id
        .is_none());
    let stairs: ConnectionIntent = serde_json::from_value(
        json!({"action":"createStairs","floor":0,"x":0,"y":0,"direction":"north"}),
    )
    .unwrap();
    assert_eq!(serde_json::to_value(stairs).unwrap()["length"], json!(3));
}

#[test]
#[ignore = "explicit development export; never rewrites sources during ordinary tests"]
fn export_transport_contracts() {
    let out = std::env::var_os("ATLAS_CONTRACT_OUT")
        .expect("ATLAS_CONTRACT_OUT must name an output directory");
    let cfg = config().with_out_dir(out);
    Intent::export_all(&cfg).unwrap();
    InteriorConnection::export_all(&cfg).unwrap();
    PreviewWire::export_all(&cfg).unwrap();
    super::application::commands::export(&cfg);
    SceneResponse::export_all(&cfg).unwrap();
    InteriorMetadataResponse::export_all(&cfg).unwrap();
    InteriorTileResponse::export_all(&cfg).unwrap();
    AppError::export_all(&cfg).unwrap();
}

// ts-rs deliberately ignores these runtime-only Serde attributes. Keep its
// warnings quiet only while this guard proves no unreviewed attribute is added.
#[test]
fn transport_serde_attributes_have_reviewed_mappings() {
    use syn::{punctuated::Punctuated, visit::Visit, Attribute, Meta, Token};
    fn exported(attributes: &[Attribute]) -> bool {
        attributes.iter().filter(|a| a.path().is_ident("cfg_attr")).any(|a| {
            a.parse_args_with(Punctuated::<Meta, Token![,]>::parse_terminated).unwrap()
                .iter().any(|m| matches!(m, Meta::List(list) if list.path.is_ident("derive") &&
                    list.parse_args_with(Punctuated::<syn::Path, Token![,]>::parse_terminated).unwrap()
                    .iter().any(|p| p.segments.last().is_some_and(|s| s.ident == "TS"))))
        })
    }
    struct Guard {
        owner: Option<String>,
    }
    impl<'ast> Visit<'ast> for Guard {
        fn visit_item_struct(&mut self, item: &'ast syn::ItemStruct) {
            if exported(&item.attrs) {
                self.owner = Some(item.ident.to_string());
                syn::visit::visit_item_struct(self, item);
                self.owner = None;
            }
        }
        fn visit_item_enum(&mut self, item: &'ast syn::ItemEnum) {
            if exported(&item.attrs) {
                self.owner = Some(item.ident.to_string());
                syn::visit::visit_item_enum(self, item);
                self.owner = None;
            }
        }
        fn visit_attribute(&mut self, attr: &'ast Attribute) {
            if !attr.path().is_ident("serde") {
                return;
            }
            attr.parse_nested_meta(|meta| {
                let name = meta
                    .path
                    .get_ident()
                    .expect("simple serde attribute")
                    .to_string();
                match name.as_str() {
                    "rename" | "rename_all" | "rename_all_fields" | "tag" | "content" => {
                        meta.value()?.parse::<syn::LitStr>()?;
                    }
                    "default" => {
                        if meta.input.peek(Token![=]) {
                            meta.value()?.parse::<syn::LitStr>()?;
                        }
                    }
                    "flatten" | "untagged" | "deny_unknown_fields" => {}
                    "transparent" => assert_eq!(self.owner.as_deref(), Some("LocalPoint")),
                    "deserialize_with" => assert_eq!(
                        meta.value()?.parse::<syn::LitStr>()?.value(),
                        "required_option"
                    ),
                    "skip_serializing_if" => assert_eq!(
                        meta.value()?.parse::<syn::LitStr>()?.value(),
                        "Option::is_none"
                    ),
                    _ => panic!("unreviewed serde attribute {name} on {:?}", self.owner),
                }
                Ok(())
            })
            .unwrap();
        }
    }
    for source in [
        include_str!("model.rs"),
        include_str!("errors.rs"),
        include_str!("generation.rs"),
        include_str!("population.rs"),
        include_str!("terrain.rs"),
        include_str!("scenery.rs"),
        include_str!("application/map_tiles.rs"),
        include_str!("../interior/model.rs"),
        include_str!("../interior/stair_geometry.rs"),
    ] {
        Guard { owner: None }.visit_file(&syn::parse_file(source).unwrap());
    }
}

#[test]
fn typed_adapter_detail_keeps_combined_tile_and_metadata() {
    let mut app = AtlasApplication::new().unwrap();
    let version = app.status();
    let result = app.request("commit", json!({"version":version,"intent":{
        "type":"createHouse","transform":{"x":0,"y":0,"angle":0},"width":2,"depth":2,"parcelId":null
    }})).unwrap();
    let id = result["objects"][0]["id"].as_str().unwrap();
    let args = json!({"buildingId":id,"floor":0,"bounds":[-1,-1,3,3],"includeLower":true});
    let mut expected = app.request("interiorTile", args.clone()).unwrap();
    let metadata = app
        .request("interiorMetadata", json!({"buildingId":id}))
        .unwrap();
    expected["rooms"] = metadata["rooms"].clone();
    expected["connections"] = metadata["connections"].clone();
    assert_eq!(app.request("detail", args).unwrap(), expected);
    assert_eq!(
        app.request("status", json!({})).unwrap(),
        serde_json::to_value(app.status()).unwrap()
    );
    assert!(app.request("unknown", json!({})).is_err());
}
