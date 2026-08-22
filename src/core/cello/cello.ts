interface Sound {
  name: string;
  url: string;
}
interface categoryGain {
  name: string;
  initValue: number;
}
interface CelloConfig {
  masterVolume: number;
  preloadSounds?: Sound[];
  volumeCategories?: categoryGain[];
}
interface PlayObject {
  loop?: boolean;
  // effects: [];
  categories: string[];
}
export default class Cello {
  private static buffers: Map<string, AudioBuffer> = new Map();
  private static categories: Map<string, GainNode> = new Map();
  private static effects: Map<string, []> = new Map();
  declare static ctx: AudioContext;
  declare static masterGain: GainNode;
  public static async initialize(config: CelloConfig) {
    this.ctx = new window.AudioContext();
    if (config.preloadSounds) {
      for (const { name, url } of config.preloadSounds) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decodedData = await this.ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(name, decodedData);
      }
    }
    this.setMasterCategory(1);
    if (config.volumeCategories) {
      for (const { name, initValue } of config.volumeCategories) {
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = initValue;
        this.categories.set(name, gainNode);
      }
    }
    window.API.WINDOW.onFocusChanged((value) => {
      value ? this.ctx.resume() : this.ctx.suspend();
    });
  }

  public static play(name: string, props: PlayObject) {
    const buffer = this.buffers.get(name);
    if (!buffer) {
      console.warn(`No sound with name: ${name}`);
      return null;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    source.loop = props.loop ?? false;

    for (const cat of props.categories) {
      //TODO: to nie zadziala, to musi byc graph zaleznosci
      const node = this.categories.get(cat);
      if (!node) {
        console.warn(`there is no gain node category with name: ${cat}`);
        continue;
      }
      console.log(node);
      source.connect(node);
    }

    source.start(0);

    // return {
    //   stop: () => source.stop(),
    //   setVolume: (val: number) => {
    //     // gainNode.gain.value = val;
    //   },
    //   sourceNode: source,
    // };
  }

  public static setMasterVolume(volume: number) {
    this.categories.get("master")!.gain.value = volume;
  }
  public static getMasterVolumeValue() {
    return this.categories.get("master")!.gain.value;
  }
  public static getMasterVolumeNode() {
    return this.categories.get("master")!;
  }
  public static setCategoryVolume(category: string, volume: number) {
    const node = this.categories.get(category);
    if (!node) {
      console.warn(`there is no gain node category with name: ${category}`);
      return;
    }
    node.gain.value = volume;
  }
  public static getCategoryVolumeValue(category: string) {
    const node = this.categories.get(category);
    if (!node) {
      console.warn(`there is no gain node category with name: ${category}`);
      return;
    }
    return node.gain.value;
  }
  public static getCategoryVolumeNode(category: string) {
    const node = this.categories.get(category);
    if (!node) {
      console.warn(`there is no gain node category with name: ${category}`);
      return;
    }
    return node;
  }
  public static setMasterCategory(initVol: number) {
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = initVol;
    this.categories.set("master", gainNode);
    gainNode.connect(this.ctx.destination);
    this.masterGain = gainNode;
  }
  public static addCategory(name: string, initVol: number) {
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = initVol;
    this.categories.set(name, gainNode);
    gainNode.connect(this.masterGain);
  }
  public static getCategoryNames() {
    return this.categories.keys();
  }
  public static addEffect() {}
}
