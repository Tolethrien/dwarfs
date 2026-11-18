import Effect, { type FlightModifiers } from "./effect";

interface PenetrateProps {
  ratio: number;
}

export default class Penetrate extends Effect {
  constructor(private readonly props: PenetrateProps) {
    super();
  }

  public describe() {
    return `Goes through blocks ${this.props.ratio}× weaker than its hit`;
  }

  public modifyFlight(flight: FlightModifiers) {
    flight.penetrateRatio = Math.min(flight.penetrateRatio, this.props.ratio);
  }
}
