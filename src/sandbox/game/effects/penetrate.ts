import type Effect from "./effect";

interface PenetrateProps {
  ratio: number;
}

export function penetrate(props: PenetrateProps): Effect {
  return {
    name: "Penetrate",
    props: props,
    describe() {
      return `Goes through blocks ${props.ratio}× weaker than its hit`;
    },
    modifyFlight(flight) {
      flight.penetrateRatio = Math.min(flight.penetrateRatio, props.ratio);
    },
  };
}
