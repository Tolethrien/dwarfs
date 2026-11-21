import PragmaComponent from "@pragma/component";
import Discovery from "../../systems/world/discovery";

interface RevealerProps {
  radius: number;
  onStart?: boolean;
}

export default class Revealer extends PragmaComponent {
  public radius: number;
  private readonly onStart: boolean;
  private discovery: Discovery | undefined;

  constructor(internal: InternalPCProps, props: RevealerProps) {
    super(internal);
    this.radius = props.radius;
    this.onStart = props.onStart ?? true;
  }

  awake(): void {
    if (this.onStart) this.discovery = this.scene.getSystem(Discovery);
  }

  start(): void {
    this.discovery?.revealAround(this.actor.transform.getPosition(), this.radius);
  }
}
