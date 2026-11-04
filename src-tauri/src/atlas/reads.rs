//! Typed read orchestration and owner closure without direct database access.
use crate::atlas::application::AtlasApplication;
use crate::atlas::errors::ensure;
use crate::atlas::model::{
    DetailArgs, DetailResponse, EditorContext, InteriorMetadataArgs, InteriorMetadataResponse,
    InteriorTileArgs, InteriorTileResponse, OwnerState, Placement, SceneArgs, SceneObject,
    SceneResponse,
};
use crate::atlas::Result;
pub(in crate::atlas) fn scene(app: &AtlasApplication, input: SceneArgs) -> Result<SceneResponse> {
    let b = input.bounds;
    ensure(
        b.iter().all(|x| x.is_finite() && x.abs() <= 5_000_100.0) && b[0] <= b[2] && b[1] <= b[3],
        "Ungültiger Ausschnitt",
    )?;
    let mut objects = app.query(b)?;
    let context_id = match &input.context {
        EditorContext::Exterior {} => None,
        EditorContext::House { house_id } => Some(house_id.as_str()),
        EditorContext::Parcel { parcel_id } => Some(parcel_id.as_str()),
    };
    let context_state = resolve_owner(app, context_id, &mut objects)?;
    let selection_state = resolve_owner(app, input.selected_id.as_deref(), &mut objects)?;
    Ok(SceneResponse {
        status: app.status(),
        objects,
        context_state,
        selection_state,
    })
}
pub(in crate::atlas) fn interior_metadata(
    app: &AtlasApplication,
    input: InteriorMetadataArgs,
) -> Result<InteriorMetadataResponse> {
    let meta = app.interior_metadata(&input.building_id)?;
    Ok(InteriorMetadataResponse {
        status: app.status(),
        building_id: input.building_id,
        rooms: meta.rooms,
        connections: meta.connections,
    })
}
pub(in crate::atlas) fn detail(
    app: &AtlasApplication,
    input: DetailArgs,
) -> Result<DetailResponse> {
    let tile = interior_tile(
        app,
        InteriorTileArgs {
            building_id: input.building_id.clone(),
            floor: input.floor,
            bounds: input.bounds,
            include_lower: true,
        },
    )?;
    let meta = interior_metadata(
        app,
        InteriorMetadataArgs {
            building_id: input.building_id,
        },
    )?;
    Ok(DetailResponse {
        tile,
        rooms: meta.rooms,
        connections: meta.connections,
    })
}
pub(in crate::atlas) fn interior_tile(
    app: &AtlasApplication,
    input: InteriorTileArgs,
) -> Result<InteriorTileResponse> {
    ensure(i32::try_from(input.floor).is_ok(), "Ungültiges Geschoss")?;
    let exists = app.house_exists(&input.building_id)?;
    ensure(exists, "Gebäude fehlt")?;
    let b = input.bounds;
    ensure(
        b.iter().all(|v| v.is_finite() && v.abs() <= 1_000_001.0)
            && b[0] <= b[2]
            && b[1] <= b[3]
            && (b[2] - b[0] + 3.0) * (b[3] - b[1] + 3.0) <= 100000.0,
        "Ungültiger Innenausschnitt",
    )?;
    let cells = app.local_cells(&input.building_id, input.floor, b, false)?;
    let lower = if input.include_lower {
        app.local_cells(&input.building_id, input.floor, b, true)?
    } else {
        Vec::new()
    };
    Ok(InteriorTileResponse {
        status: app.status(),
        building_id: input.building_id,
        floor: input.floor,
        bounds: b,
        include_lower: input.include_lower,
        cells,
        lower,
    })
}

pub(in crate::atlas) fn resolve_owner(
    app: &AtlasApplication,
    id: Option<&str>,
    objects: &mut Vec<SceneObject>,
) -> Result<OwnerState> {
    let Some(id) = id else {
        return Ok(OwnerState {
            exists: true,
            parcel_id: None,
            house_id: None,
        });
    };
    let Some(object) = app.scene_header(id)? else {
        return Ok(OwnerState {
            exists: false,
            parcel_id: None,
            house_id: None,
        });
    };
    let mut state = OwnerState {
        exists: true,
        parcel_id: None,
        house_id: None,
    };
    let mut related = vec![];
    match &object {
        SceneObject::House(h) => {
            state.house_id = Some(h.id.clone());
            if let Placement::Parcel { parcel_id, .. } = &h.placement {
                state.parcel_id = Some(parcel_id.clone());
                if let Some(p) = app.scene_header(parcel_id)? {
                    related.push(p);
                }
            }
        }
        SceneObject::Parcel(p) => {
            state.parcel_id = Some(p.id.clone());
            if let Some(h) = app.house_header_for_parcel(&p.id)? {
                state.house_id = Some(h.id.clone());
                related.push(SceneObject::House(h));
            }
        }
        SceneObject::Road(r) => {
            for p in app.parcel_headers_for_road(&r.id)? {
                related.push(SceneObject::Parcel(p));
            }
        }
        _ => {}
    }
    related.push(object);
    for object in related {
        if !objects.iter().any(|o| o.id() == object.id()) {
            objects.push(object);
        }
    }
    Ok(state)
}
