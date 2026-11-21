import type Effect from "./effect";

interface BounceBoostProps {
  speed: number;
  cooldown: number;
}

export function bounceBoost(props: BounceBoostProps): Effect {
  return {
    name: "BounceBoost",
    props: props,
    describe() {
      return `A bounce speeds it up to ×${props.speed}, every ${props.cooldown} s`;
    },
    modifyFlight(flight) {
      if (props.speed <= flight.bounceBoost) return;
      flight.bounceBoost = props.speed;
      flight.bounceCooldown = props.cooldown;
    },
  };
}
