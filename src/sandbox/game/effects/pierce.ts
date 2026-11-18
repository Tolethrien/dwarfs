import Effect, { type FlightModifiers } from "./effect";

interface PierceProps {
  untilSpeed: number;
  overSpeedPower: number;
}

export default class Pierce extends Effect {
  constructor(private readonly props: PierceProps) {
    super();
  }

  public describe() {
    return "Pierces blocks while faster than normal";
  }

  public modifyFlight(flight: FlightModifiers) {
    flight.pierceAbove = Math.min(flight.pierceAbove, this.props.untilSpeed);
    flight.overSpeedPower = Math.max(flight.overSpeedPower, this.props.overSpeedPower);
  }
}
