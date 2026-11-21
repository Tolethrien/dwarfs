import type Effect from "./effect";

interface PierceProps {
  untilSpeed: number;
  overSpeedPower: number;
}

export function pierce(props: PierceProps): Effect {
  return {
    name: "Pierce",
    props: props,
    describe() {
      return "Pierces blocks while faster than normal";
    },
    modifyFlight(flight) {
      flight.pierceAbove = Math.min(flight.pierceAbove, props.untilSpeed);
      flight.overSpeedPower = Math.max(flight.overSpeedPower, props.overSpeedPower);
    },
  };
}
