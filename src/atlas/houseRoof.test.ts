import { describe, expect, it, vi } from "vitest";
import { paintHouseRoof, rectangularRoof } from "./houseRoof";
import type { House, LocalPoint } from "./model";
const rectangle: LocalPoint[] = [
  [-3, -2],
  [5, -2],
  [5, 4],
  [-3, 4],
];
describe("decorative house roofs", () => {
  it("accepts both windings and explicit closure at negative local coordinates", () => {
    for (const ring of [
      rectangle,
      [...rectangle].reverse(),
      [...rectangle, rectangle[0]],
    ])
      expect(rectangularRoof([ring])).toEqual({ x: -3, y: -2, X: 5, Y: 4 });
  });
  it("does not invent ridges across courtyards, disconnected roofs or concave contours", () => {
    expect(rectangularRoof([rectangle, rectangle])).toBeNull();
    expect(
      rectangularRoof([
        [
          [0, 0],
          [3, 0],
          [3, 1],
          [1, 1],
          [1, 3],
          [0, 3],
        ],
      ]),
    ).toBeNull();
    expect(
      rectangularRoof([
        [
          [0, 0],
          [3, 3],
          [0, 3],
          [3, 0],
        ],
      ]),
    ).toBeNull();
    expect(
      rectangularRoof([
        [
          [0, 0],
          [3, 0],
          [0, 0],
          [0, 3],
        ],
      ]),
    ).toBeNull();
    expect(
      rectangularRoof([
        [
          [0, 0],
          [Infinity, 0],
          [Infinity, 3],
          [0, 3],
        ],
      ]),
    ).toBeNull();
  });
  it("skips overview and subpixel details before touching the canvas", () => {
    const c = {} as CanvasRenderingContext2D;
    const house = { contours: [rectangle] } as House;
    paintHouseRoof(c, house, {} as Path2D, 0.1);
    paintHouseRoof(
      c,
      {
        ...house,
        contours: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      },
      {} as Path2D,
      1,
    );
    paintHouseRoof(
      c,
      { ...house, contours: [rectangle, rectangle] },
      {} as Path2D,
      10,
    );
  });
  it("uses the exact existing even-odd clip and building pose with bounded drawing work", () => {
    const c = Object.fromEntries(
      [
        "save",
        "restore",
        "clip",
        "translate",
        "rotate",
        "scale",
        "beginPath",
        "moveTo",
        "lineTo",
        "closePath",
        "fill",
        "stroke",
      ].map((k) => [k, vi.fn()]),
    ) as unknown as CanvasRenderingContext2D;
    c.globalAlpha = 1;
    const house = {
      contours: [rectangle],
      transform: { x: 100, y: -80, angle: 0.7 },
    } as House;
    const path = {} as Path2D;
    paintHouseRoof(c, house, path, 2);
    expect(c.clip).toHaveBeenCalledWith(path, "evenodd");
    expect(c.translate).toHaveBeenCalledWith(100, -80);
    expect(c.rotate).toHaveBeenCalledWith(0.7);
    expect(c.fill).toHaveBeenCalledTimes(4);
    expect(c.stroke).toHaveBeenCalledTimes(1);
    expect(c.restore).toHaveBeenCalledTimes(1);
  });
});
