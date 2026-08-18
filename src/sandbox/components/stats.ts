import PragmaComponent from "@/core/pragma/component";
type StatsProps = DwarfStats | DepositStats;
interface DwarfStats {
  kind: "dwarf";
  baseSpeed: number;
  baseDmg: number;
  beerLeft: number;
  beerPerMinute: number;
}
interface DepositStats {
  kind: "deposit";
  strength: number;
  currentHP: number;
  maxHP: number;
}
export default class Stats extends PragmaComponent {
  public data: StatsProps;
  constructor(internal: InternalPCProps, props: StatsProps) {
    super(internal);
    this.data = props;
  }
}
