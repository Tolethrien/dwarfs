import type Effect from "./effect";

interface BlastProps {
  radius: number;
  edge: number;
}

export function blast(props: BlastProps): Effect {
  return {
    name: "Blast",
    props: props,
    describe() {
      return `Hits explode, ${props.radius} tiles around`;
    },
    modifyFlight(flight) {
      if (props.radius <= flight.blastRadius) return;
      flight.blastRadius = props.radius;
      flight.blastEdge = props.edge;
    },
  };
}
