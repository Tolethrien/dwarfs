import type Effect from "./effect";

interface SplashProps {
  radius: number;
  damage: number;
}

export function splash(props: SplashProps): Effect {
  return {
    name: "Splash",
    props: props,
    describe() {
      return `Hits also strike every block ${props.radius} around for ${props.damage}`;
    },
    modifyFlight(flight) {
      if (props.radius <= flight.splashRadius) return;
      flight.splashRadius = props.radius;
      flight.splashDamage = props.damage;
    },
  };
}
