import PragmaComponent from "@pragma/component";
import Time from "@engine/time";
import type PragmaActor from "@pragma/actor";
type StatsProps = DwarfStats;
interface DwarfStats {
  kind: "dwarf";
  baseSpeed: number;
  baseDmg: number;
  beerLeft: number;
  beerPerMinute: number;
  drinking: boolean;
}

export interface DwarfExhaustedEvent {
  actor: PragmaActor;
}

export default class Stats extends PragmaComponent {
  public data: StatsProps;
  constructor(internal: InternalPCProps, props: StatsProps) {
    super(internal);
    this.data = props;
  }

  // the beer runs out as it flies; at the last drop it is done (Launcher walks it home)
  update(): void {
    if (!this.data.drinking) return;
    this.data.beerLeft -= (this.data.beerPerMinute / 60) * Time.getDeltaTime();
    if (this.data.beerLeft > 0) return;
    this.data.drinking = false;
    this.scene.events.emit("dwarfExhausted", { actor: this.actor } satisfies DwarfExhaustedEvent);
  }
}
