import Effect, { type FlightModifiers } from "./effect";

interface BounceBoostProps {
  speed: number;
  cooldown: number;
}

export default class BounceBoost extends Effect {
  constructor(private readonly props: BounceBoostProps) {
    super();
  }

  public describe() {
    return `A bounce speeds it up to ×${this.props.speed}, every ${this.props.cooldown} s`;
  }

  public modifyFlight(flight: FlightModifiers) {
    if (this.props.speed <= flight.bounceBoost) return;
    flight.bounceBoost = this.props.speed;
    flight.bounceCooldown = this.props.cooldown;
  }
}
