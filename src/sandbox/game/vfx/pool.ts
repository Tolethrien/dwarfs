export type ParticleData<K extends string> = Record<K, Float32Array>;

export default class ParticlePool<K extends string> {
  public readonly data: ParticleData<K>;
  public count = 0;
  private readonly columns: Float32Array[];
  private replace = 0;

  constructor(
    public readonly capacity: number,
    fields: readonly K[],
  ) {
    const data = {} as ParticleData<K>;
    for (const field of fields) data[field] = new Float32Array(capacity);
    this.data = data;
    this.columns = Object.values(data);
  }

  public alloc() {
    if (this.count < this.capacity) return this.count++;
    const index = this.replace;
    this.replace = (this.replace + 1) % this.capacity;
    return index;
  }

  public remove(index: number) {
    const last = --this.count;
    if (index !== last) for (const column of this.columns) column[index] = column[last];
    if (this.replace >= this.count) this.replace = 0;
  }

  public clear() {
    this.count = 0;
    this.replace = 0;
  }
}
