import Effect, { type FlightModifiers } from "./effect";

interface BlastProps {
  radius: number;
  edge: number;
}

export default class Blast extends Effect {
  constructor(private readonly props: BlastProps) {
    super();
  }

  public describe() {
    return `Hits explode, ${this.props.radius} tiles around`;
  }

  public modifyFlight(flight: FlightModifiers) {
    if (this.props.radius <= flight.blastRadius) return;
    flight.blastRadius = this.props.radius;
    flight.blastEdge = this.props.edge;
  }
}
