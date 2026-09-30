import { assert } from "./utils";

type TypedArrayConstructor<T> = {
  new (buffer: ArrayBuffer): T;
  BYTES_PER_ELEMENT: number;
};

const TEXT = {
  encoder: new TextEncoder(),
  decoder: new TextDecoder(),
  maxBytes: 0xffff,
};

// DataView calls write little-endian explicitly, typed arrays are copied raw in the platform order
assert(
  new Uint8Array(new Uint16Array([1]).buffer)[0] === 1,
  "ByteWriter/ByteReader: big-endian platform is not supported",
);

export class ByteWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private bytes: Uint8Array;
  public offset = 0;

  constructor(capacity = 1024) {
    this.buffer = new ArrayBuffer(capacity);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
  }

  u8(value: number) {
    this.ensure(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  u16(value: number) {
    this.ensure(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  u32(value: number) {
    this.ensure(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  i32(value: number) {
    this.ensure(4);
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  f32(value: number) {
    this.ensure(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  f64(value: number) {
    this.ensure(8);
    this.view.setFloat64(this.offset, value, true);
    this.offset += 8;
  }

  string(value: string) {
    const encoded = TEXT.encoder.encode(value);
    assert(
      encoded.byteLength <= TEXT.maxBytes,
      `ByteWriter.string: ${encoded.byteLength} bytes, max ${TEXT.maxBytes}`,
    );
    this.u16(encoded.byteLength);
    this.array(encoded);
  }

  // one block copy, no per element loop: a map layer is millions of elements
  array(data: ArrayBufferView) {
    this.ensure(data.byteLength);
    this.bytes.set(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      this.offset,
    );
    this.offset += data.byteLength;
  }

  // a length known only after its content is written (a section)
  reserveU32() {
    const at = this.offset;
    this.u32(0);
    return at;
  }

  patchU32(at: number, value: number) {
    assert(at + 4 <= this.offset, `ByteWriter.patchU32: ${at} not written yet`);
    this.view.setUint32(at, value, true);
  }

  finish(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }

  private ensure(size: number) {
    const needed = this.offset + size;
    if (needed <= this.buffer.byteLength) return;

    let capacity = this.buffer.byteLength * 2;
    while (capacity < needed) capacity *= 2;
    const grown = new ArrayBuffer(capacity);
    new Uint8Array(grown).set(this.bytes.subarray(0, this.offset));

    this.buffer = grown;
    this.view = new DataView(grown);
    this.bytes = new Uint8Array(grown);
  }
}

export class ByteReader {
  private view: DataView;
  private bytes: Uint8Array;
  public offset = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  get remaining() {
    return this.bytes.byteLength - this.offset;
  }

  u8() {
    return this.view.getUint8(this.take(1));
  }

  u16() {
    return this.view.getUint16(this.take(2), true);
  }

  u32() {
    return this.view.getUint32(this.take(4), true);
  }

  i32() {
    return this.view.getInt32(this.take(4), true);
  }

  f32() {
    return this.view.getFloat32(this.take(4), true);
  }

  f64() {
    return this.view.getFloat64(this.take(8), true);
  }

  string() {
    const length = this.u16();
    const start = this.take(length);
    return TEXT.decoder.decode(this.bytes.subarray(start, start + length));
  }

  // copies: a view would need the offset aligned to the element size, sections start anywhere
  u8Array(count: number) {
    return this.typed(Uint8Array, count);
  }

  u16Array(count: number) {
    return this.typed(Uint16Array, count);
  }

  u32Array(count: number) {
    return this.typed(Uint32Array, count);
  }

  i32Array(count: number) {
    return this.typed(Int32Array, count);
  }

  f32Array(count: number) {
    return this.typed(Float32Array, count);
  }

  skip(size: number) {
    this.take(size);
  }

  private typed<T>(type: TypedArrayConstructor<T>, count: number): T {
    const size = count * type.BYTES_PER_ELEMENT;
    const start = this.take(size);
    return new type(this.bytes.slice(start, start + size).buffer);
  }

  private take(size: number) {
    assert(
      size >= 0 && this.offset + size <= this.bytes.byteLength,
      `ByteReader: read of ${size} bytes at ${this.offset} past the end (${this.bytes.byteLength})`,
    );
    const start = this.offset;
    this.offset += size;
    return start;
  }
}
