import { ByteReader, ByteWriter } from "@axiom/bytes";
import { assert } from "@axiom/utils";
import World, { type WorldMeta } from "./world";
import { SAVE_FORMAT, SAVE_SECTION } from "./saveFormat";
import type { DecoLayer } from "@sandbox/content/decos";

export interface SaveInfo {
  name: string;
}

// kind: which actor (GameScene knows them), data: what the actor wrote about itself
export interface ActorSave {
  kind: number;
  data: ArrayBuffer;
}

// what lives outside the World: the player and every actor worth keeping
export interface GameState {
  resources: [number, number][];
  actors: ActorSave[];
}

export interface SaveData {
  world: World;
  info: SaveInfo;
  state: GameState;
}

// what the sections fill while reading, the World is built once all of them are in
interface Decoded {
  info?: SaveInfo;
  meta?: WorldMeta;
  solid?: Uint16Array;
  damage?: Map<number, number>;
  discovered?: Uint8Array;
  biomes?: Uint8Array;
  decos?: Record<DecoLayer, Map<number, number>>;
  state: GameState;
}

interface Section {
  id: number;
  version: number;
  write(writer: ByteWriter, save: SaveData): void;
  read(reader: ByteReader, version: number, decoded: Decoded): void;
}

// the order they are written in, part of the decos section
const DECO_LAYERS: readonly DecoLayer[] = ["back", "front"];

// meta first: the menu reads only the header and the name
const SECTIONS: Section[] = [
  {
    id: SAVE_SECTION.meta,
    version: 1,
    write(writer, save) {
      const meta = save.world.meta;
      writer.string(save.info.name);
      writer.f64(meta.seed);
      writer.f64(meta.origin.x);
      writer.f64(meta.origin.y);
      writer.u16(meta.tileInPixels.width);
      writer.u16(meta.tileInPixels.height);
      writer.u16(meta.chunkInTiles.width);
      writer.u16(meta.chunkInTiles.height);
      writer.u16(meta.mapInChunks.width);
      writer.u16(meta.mapInChunks.height);
      writer.u16(meta.biomeCellInTiles);
      writer.u16(meta.border);
    },
    read(reader, _version, decoded) {
      decoded.info = { name: reader.string() };
      decoded.meta = {
        seed: reader.f64(),
        origin: { x: reader.f64(), y: reader.f64() },
        tileInPixels: { width: reader.u16(), height: reader.u16() },
        chunkInTiles: { width: reader.u16(), height: reader.u16() },
        mapInChunks: { width: reader.u16(), height: reader.u16() },
        biomeCellInTiles: reader.u16(),
        border: reader.u16(),
      };
    },
  },
  {
    id: SAVE_SECTION.terrain,
    version: 1,
    write(writer, save) {
      writer.u32(save.world.solid.length);
      writer.array(save.world.solid);
    },
    read(reader, _version, decoded) {
      decoded.solid = reader.u16Array(reader.u32());
    },
  },
  {
    // sparse: [tile index (row-major), damage] only for damaged tiles
    id: SAVE_SECTION.damage,
    version: 1,
    write(writer, save) {
      writer.u32(save.world.damage.size);
      for (const [index, value] of save.world.damage) {
        writer.u32(index);
        writer.u16(value);
      }
    },
    read(reader, _version, decoded) {
      const count = reader.u32();
      const damage = new Map<number, number>();
      for (let pair = 0; pair < count; pair++) damage.set(reader.u32(), reader.u16());
      decoded.damage = damage;
    },
  },
  {
    id: SAVE_SECTION.discovered,
    version: 1,
    write(writer, save) {
      writer.u32(save.world.discovered.length);
      writer.array(save.world.discovered);
    },
    read(reader, _version, decoded) {
      decoded.discovered = reader.u8Array(reader.u32());
    },
  },
  {
    id: SAVE_SECTION.biomes,
    version: 1,
    write(writer, save) {
      writer.u32(save.world.biomes.length);
      writer.array(save.world.biomes);
    },
    read(reader, _version, decoded) {
      decoded.biomes = reader.u8Array(reader.u32());
    },
  },
  {
    // sparse per layer: [tile index (row-major), deco type + variant]
    id: SAVE_SECTION.decos,
    version: 1,
    write(writer, save) {
      for (const layer of DECO_LAYERS) {
        const decos = save.world.decos[layer];
        writer.u32(decos.size);
        for (const [index, deco] of decos) {
          writer.u32(index);
          writer.u16(deco);
        }
      }
    },
    read(reader, _version, decoded) {
      const decos: Record<DecoLayer, Map<number, number>> = { back: new Map(), front: new Map() };
      for (const layer of DECO_LAYERS) {
        const count = reader.u32();
        for (let pair = 0; pair < count; pair++) decos[layer].set(reader.u32(), reader.u16());
      }
      decoded.decos = decos;
    },
  },
  {
    // [resource id, amount]: a renumbered or new resource does not shift the others
    id: SAVE_SECTION.resources,
    version: 1,
    write(writer, save) {
      writer.u16(save.state.resources.length);
      for (const [id, amount] of save.state.resources) {
        writer.u16(id);
        writer.u32(amount);
      }
    },
    read(reader, _version, decoded) {
      const count = reader.u16();
      for (let pair = 0; pair < count; pair++)
        decoded.state.resources.push([reader.u16(), reader.u32()]);
    },
  },
  {
    // length before the data, so a kind this game no longer knows can be skipped
    id: SAVE_SECTION.actors,
    version: 1,
    write(writer, save) {
      writer.u32(save.state.actors.length);
      for (const actor of save.state.actors) {
        writer.u16(actor.kind);
        writer.u32(actor.data.byteLength);
        writer.array(new Uint8Array(actor.data));
      }
    },
    read(reader, _version, decoded) {
      const count = reader.u32();
      for (let index = 0; index < count; index++) {
        const kind = reader.u16();
        decoded.state.actors.push({ kind, data: reader.u8Array(reader.u32()).buffer });
      }
    },
  },
];

const SECTION_BY_ID = new Map(SECTIONS.map((section) => [section.id, section]));

export function encodeSave(save: SaveData): ArrayBuffer {
  const writer = new ByteWriter(save.world.solid.byteLength + 4096);
  for (let char = 0; char < SAVE_FORMAT.magic.length; char++)
    writer.u8(SAVE_FORMAT.magic.charCodeAt(char));
  writer.u16(SAVE_FORMAT.version);

  for (const section of SECTIONS) {
    writer.u16(section.id);
    writer.u16(section.version);
    const length = writer.reserveU32();
    const start = writer.offset;
    section.write(writer, save);
    writer.patchU32(length, writer.offset - start);
  }
  return writer.finish();
}

export function decodeSave(buffer: ArrayBuffer): SaveData {
  const reader = new ByteReader(buffer);
  let magic = "";
  for (let char = 0; char < SAVE_FORMAT.magic.length; char++)
    magic += String.fromCharCode(reader.u8());
  assert(magic === SAVE_FORMAT.magic, `save: not a save file (magic "${magic}")`);
  const format = reader.u16();
  assert(
    format <= SAVE_FORMAT.version,
    `save: format ${format} is newer than this game (${SAVE_FORMAT.version})`,
  );

  // a save without the state sections (older) starts with nothing
  const decoded: Decoded = { state: { resources: [], actors: [] } };
  while (reader.remaining > 0) {
    const id = reader.u16();
    const version = reader.u16();
    const length = reader.u32();
    assert(
      length <= reader.remaining,
      `save: section ${id} is cut off (${length} bytes, ${reader.remaining} left)`,
    );
    const section = SECTION_BY_ID.get(id);
    // a section from a newer game, not needed here
    if (!section) {
      reader.skip(length);
      continue;
    }
    assert(
      version <= section.version,
      `save: section ${id} version ${version} is newer than this game (${section.version})`,
    );
    const start = reader.offset;
    section.read(reader, version, decoded);
    assert(
      reader.offset - start === length,
      `save: section ${id} read ${reader.offset - start} bytes, header says ${length}`,
    );
  }

  assert(decoded.meta !== undefined && decoded.info !== undefined, "save: no meta section");
  assert(decoded.solid !== undefined, "save: no terrain section");
  const world = new World({
    meta: decoded.meta,
    solid: decoded.solid,
    damage: decoded.damage,
    discovered: decoded.discovered,
    biomes: decoded.biomes,
    decos: decoded.decos,
  });
  return { world, info: decoded.info, state: decoded.state };
}
