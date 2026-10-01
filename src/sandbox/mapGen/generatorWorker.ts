import { serveWorker } from "@axiom/worker";
import { generateJob, type GenerateRequest, type GenerateResult } from "./generateJob";

serveWorker<GenerateRequest, GenerateResult>((request) => {
  const result = generateJob(request);
  return {
    result,
    transfer: [result.solid.buffer, result.discovered.buffer, result.biomes.buffer],
  };
});
