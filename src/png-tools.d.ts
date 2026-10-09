declare module "png-tools" {
  export function decode(
    bytes: Uint8Array,
    inflate: (bytes: Uint8Array) => Uint8Array,
  ): {
    width: number;
    height: number;
    depth: number;
    data: Uint8Array | Uint16Array;
  };
}
