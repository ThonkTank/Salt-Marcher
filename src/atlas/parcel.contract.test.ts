import { expect, test } from "vitest";
import type { EditorContext, GridPose, ParcelSource, Placement } from "./model";

// @ts-expect-error Bound placement must name its sole authoritative owner.
const missingOwner: Placement = {
  kind: "parcel",
  gridPose: { xCells: 0, yCells: 0, quarterTurns: 0 },
};
// @ts-expect-error Free placement cannot smuggle an owner into a header.
const mixedPlacement: Placement = { kind: "free", parcelId: "parcel-1" };
// @ts-expect-error Rotations are exactly four discrete states.
const arbitraryRotation: GridPose = { xCells: -1, yCells: 2, quarterTurns: 4 };
// @ts-expect-error Detached geometry cannot carry a competing road binding.
const mixedSource: ParcelSource = { kind: "detached", roadId: "road-1" };
// @ts-expect-error House context requires identity independently of viewport contents.
const missingContext: EditorContext = { kind: "house" };

test("parcel wire unions keep owner, source and context identities explicit", () => {
  const placement: Placement = {
    kind: "parcel",
    parcelId: "parcel-1",
    gridPose: { xCells: -2, yCells: 3, quarterTurns: 3 },
  };
  expect(JSON.parse(JSON.stringify(placement))).toEqual(placement);
  expect([
    missingOwner,
    mixedPlacement,
    arbitraryRotation,
    mixedSource,
    missingContext,
  ]).toHaveLength(5);
});
