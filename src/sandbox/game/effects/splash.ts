import Effect, { type FlightModifiers } from "./effect";

interface SplashProps {
  radius: number;
  damage: number;
}

export default class Splash extends Effect {
  constructor(private readonly props: SplashProps) {
    super();
  }

  public describe() {
    return `Hits also strike every block ${this.props.radius} around for ${this.props.damage}`;
  }

  public modifyFlight(flight: FlightModifiers) {
    if (this.props.radius <= flight.splashRadius) return;
    flight.splashRadius = this.props.radius;
    flight.splashDamage = this.props.damage;
  }
}
