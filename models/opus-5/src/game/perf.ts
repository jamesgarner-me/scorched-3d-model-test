/** Live performance counters. Mutated in the render loop, polled by the debug panel. */
export interface PerfCounters {
  fps: number;
  frameMillis: number;
  generationMillis: number;
  aiSolveMillis: number;
  craterMillis: number;
  terrainUploadMillis: number;
  guideMillis: number;
  triangles: number;
}

export const perf: PerfCounters = {
  fps: 0,
  frameMillis: 0,
  generationMillis: 0,
  aiSolveMillis: 0,
  craterMillis: 0,
  terrainUploadMillis: 0,
  guideMillis: 0,
  triangles: 0,
};
