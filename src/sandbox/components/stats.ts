import PragmaComponent from "@pragma/component";
type StatsProps = DwarfStats;
interface DwarfStats {
  kind: "dwarf";
  baseSpeed: number;
  baseDmg: number;
  beerLeft: number;
  beerPerMinute: number;
}

export default class Stats extends PragmaComponent {
  public data: StatsProps;
  constructor(internal: InternalPCProps, props: StatsProps) {
    super(internal);
    this.data = props;
  }
}
