/**
 * GGUF header reader (ported from Acacia m16 GGUFManager). Reads metadata only, never the tensor data.
 * Works on a File/Blob slice, so a multi-gigabyte model is inspected by reading its first few megabytes.
 */
export type GGUFValue = string | number | boolean | bigint | GGUFValue[];
export interface GGUFInfo {
  version: number;
  tensorCount: number;
  metadata: Record<string, GGUFValue>;
  architecture?: string;
  name?: string;
  contextLength?: number;
  quant?: string;
}

const VALUE_TYPES = { U8: 0, I8: 1, U16: 2, I16: 3, U32: 4, I32: 5, F32: 6, BOOL: 7, STRING: 8, ARRAY: 9, U64: 10, I64: 11, F64: 12 } as const;

/** general.file_type -> quant name (llama.cpp llama_ftype). Unknown values are reported as "ftype N". */
const FILE_TYPE: Record<number, string> = {
  0: "F32", 1: "F16", 2: "Q4_0", 3: "Q4_1", 7: "Q8_0", 8: "Q5_0", 9: "Q5_1", 10: "Q2_K", 11: "Q3_K_S", 12: "Q3_K_M",
  13: "Q3_K_L", 14: "Q4_K_S", 15: "Q4_K_M", 16: "Q5_K_S", 17: "Q5_K_M", 18: "Q6_K", 19: "IQ2_XXS", 20: "IQ2_XS",
};

class Reader {
  private dv: DataView;
  private pos = 0;
  constructor(buf: ArrayBuffer) { this.dv = new DataView(buf); }
  private need(n: number): void {
    if (this.pos + n > this.dv.byteLength) throw new Error("GGUF header is truncated; read more bytes");
  }
  u8(): number { this.need(1); return this.dv.getUint8(this.pos++); }
  i8(): number { this.need(1); return this.dv.getInt8(this.pos++); }
  u16(): number { this.need(2); const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i16(): number { this.need(2); const v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; }
  u32(): number { this.need(4); const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  i32(): number { this.need(4); const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  f32(): number { this.need(4); const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }
  f64(): number { this.need(8); const v = this.dv.getFloat64(this.pos, true); this.pos += 8; return v; }
  u64(): bigint { this.need(8); const v = this.dv.getBigUint64(this.pos, true); this.pos += 8; return v; }
  i64(): bigint { this.need(8); const v = this.dv.getBigInt64(this.pos, true); this.pos += 8; return v; }
  str(): string {
    const len = Number(this.u64());
    this.need(len);
    const out = new TextDecoder().decode(new Uint8Array(this.dv.buffer, this.dv.byteOffset + this.pos, len));
    this.pos += len;
    return out;
  }
  value(type: number): GGUFValue {
    switch (type) {
      case VALUE_TYPES.U8: return this.u8();
      case VALUE_TYPES.I8: return this.i8();
      case VALUE_TYPES.U16: return this.u16();
      case VALUE_TYPES.I16: return this.i16();
      case VALUE_TYPES.U32: return this.u32();
      case VALUE_TYPES.I32: return this.i32();
      case VALUE_TYPES.F32: return this.f32();
      case VALUE_TYPES.BOOL: return this.u8() !== 0;
      case VALUE_TYPES.STRING: return this.str();
      case VALUE_TYPES.U64: return this.u64();
      case VALUE_TYPES.I64: return this.i64();
      case VALUE_TYPES.F64: return this.f64();
      case VALUE_TYPES.ARRAY: {
        const elem = this.u32();
        const count = Number(this.u64());
        if (count > 10_000_000) throw new Error("GGUF array too large for a metadata read");
        const out: GGUFValue[] = [];
        for (let i = 0; i < count; i++) out.push(this.value(elem));
        return out;
      }
      default: throw new Error(`unknown GGUF value type ${type}`);
    }
  }
}

/** Parse a GGUF header from its first bytes. */
export function parseGGUFHeader(buf: ArrayBuffer): GGUFInfo {
  const r = new Reader(buf);
  const magic = [r.u8(), r.u8(), r.u8(), r.u8()].map((b) => String.fromCharCode(b)).join("");
  if (magic !== "GGUF") throw new Error("not a GGUF file");
  const version = r.u32();
  if (version < 1 || version > 3) throw new Error(`unsupported GGUF version ${version}`);
  const tensorCount = Number(r.u64());
  const kvCount = Number(r.u64());
  const metadata: Record<string, GGUFValue> = {};
  for (let i = 0; i < kvCount; i++) {
    const key = r.str();
    metadata[key] = r.value(r.u32());
  }
  const ft = metadata["general.file_type"];
  const quant = typeof ft === "number" ? FILE_TYPE[ft] ?? `ftype ${ft}` : undefined;
  const arch = typeof metadata["general.architecture"] === "string" ? (metadata["general.architecture"] as string) : undefined;
  const ctx = arch ? metadata[`${arch}.context_length`] : undefined;
  return {
    version, tensorCount, metadata,
    architecture: arch,
    name: typeof metadata["general.name"] === "string" ? (metadata["general.name"] as string) : undefined,
    contextLength: typeof ctx === "number" ? ctx : undefined,
    quant,
  };
}

/** Read only the header of a file (default 16 MB cap) and parse it. */
export async function readGGUF(file: Blob, cap = 16 * 1024 * 1024): Promise<GGUFInfo> {
  const buf = await file.slice(0, Math.min(file.size, cap)).arrayBuffer();
  return parseGGUFHeader(buf);
}
