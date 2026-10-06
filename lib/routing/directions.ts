import type { PathType } from "@/db/schema";
import { bearingDegrees, bearingDelta, compassWord } from "@/lib/geo/bearing";

export type StepType =
  | "depart"
  | "continue"
  | "slight-left"
  | "slight-right"
  | "left"
  | "right"
  | "sharp-left"
  | "sharp-right"
  | "uturn"
  | "arrive";

export interface DirectionStep {
  instruction: string;
  /** Length of the segment this instruction covers (0 for the arrival step). */
  distanceM: number;
  /** Position where this instruction starts. */
  lat: number;
  lng: number;
  type: StepType;
}

export interface DirectionPathNode {
  id: number;
  lat: number;
  lng: number;
  /** Place name when the node belongs to a location, otherwise its label. */
  landmark?: string | null;
}

export interface BuildDirectionsInput {
  /** Ordered nodes of the computed path (minimum 1). */
  nodes: DirectionPathNode[];
  /** Path type of each hop: nodes.length - 1 entries. */
  edgePathTypes?: PathType[];
  /** Name used for the arrival step, e.g. "Polytechnic Library". */
  destinationName: string;
}

interface Segment {
  fromIndex: number;
  bearing: number;
  distanceM: number;
  pathType: PathType;
}

/** Turns of 120 degrees or more are reported as sharp / U-turn. */
function classify(delta: number): StepType {
  const magnitude = Math.abs(delta);
  if (magnitude <= 12) return "continue";
  if (magnitude <= 35) return delta > 0 ? "slight-right" : "slight-left";
  if (magnitude <= 110) return delta > 0 ? "right" : "left";
  if (magnitude <= 155) return delta > 0 ? "sharp-right" : "sharp-left";
  return "uturn";
}

const VERBS: Record<StepType, string> = {
  depart: "Head",
  continue: "Continue straight",
  "slight-left": "Keep left",
  "slight-right": "Keep right",
  left: "Turn left",
  right: "Turn right",
  "sharp-left": "Turn sharp left",
  "sharp-right": "Turn sharp right",
  uturn: "Make a U-turn",
  arrive: "Arrive at",
};

function round(distanceM: number): number {
  return Math.round(distanceM * 10) / 10;
}

/**
 * Converts a computed path into human turn-by-turn directions.
 *
 * Rules (see docs/ALGORITHM.md):
 * - the first instruction is "Head <compass> toward <next landmark>";
 * - bearings are compared segment by segment: |delta| <= 12 degrees is
 *   "straight" and consecutive straight segments are merged into one step
 *   ("Continue for 120 m");
 * - nodes that belong to a named location become landmarks:
 *   "Turn left at the Library";
 * - the final step is always "Arrive at <destination>".
 */
export function buildDirections(input: BuildDirectionsInput): DirectionStep[] {
  const { nodes, destinationName, edgePathTypes = [] } = input;

  if (nodes.length < 2) {
    const only = nodes[0];
    return [
      {
        instruction: `${VERBS.arrive} ${destinationName}`,
        distanceM: 0,
        lat: only?.lat ?? 0,
        lng: only?.lng ?? 0,
        type: "arrive",
      },
    ];
  }

  const segments: Segment[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const distance = Math.sqrt(
      (a.lat - b.lat) ** 2 * 111_320 ** 2 +
        (a.lng - b.lng) ** 2 * (111_320 * Math.cos((a.lat * Math.PI) / 180)) ** 2,
    );
    segments.push({
      fromIndex: i,
      bearing: bearingDegrees({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }),
      distanceM: distance,
      pathType: edgePathTypes[i] ?? "footpath",
    });
  }

  // Maneuver points: the start, plus every node where the bearing changes.
  const maneuvers: number[] = [0];
  for (let s = 1; s < segments.length; s++) {
    const delta = bearingDelta(segments[s - 1].bearing, segments[s].bearing);
    if (classify(delta) !== "continue") maneuvers.push(s);
  }

  const steps: DirectionStep[] = [];

  for (let m = 0; m < maneuvers.length; m++) {
    const segmentIndex = maneuvers[m];
    const nextBoundary = m + 1 < maneuvers.length ? maneuvers[m + 1] : segments.length;
    const distanceM = round(
      segments
        .slice(segmentIndex, nextBoundary)
        .reduce((sum, segment) => sum + segment.distanceM, 0),
    );

    const node = nodes[segmentIndex];

    if (segmentIndex === 0) {
      const toward =
        firstLandmarkAfter(nodes, 0) ?? destinationName;
      const heading = compassWord(segments[0].bearing);
      steps.push({
        instruction: `Head ${heading} toward ${toward}`,
        distanceM,
        lat: node.lat,
        lng: node.lng,
        type: "depart",
      });
      continue;
    }

    const delta = bearingDelta(
      segments[segmentIndex - 1].bearing,
      segments[segmentIndex].bearing,
    );
    const type = classify(delta);
    const landmark = nodes[segmentIndex]?.landmark;
    const verb = VERBS[type];
    steps.push({
      instruction: landmark ? `${verb} at ${landmark}` : verb,
      distanceM,
      lat: node.lat,
      lng: node.lng,
      type,
    });
  }

  const arrival = nodes[nodes.length - 1];
  steps.push({
    instruction: `${VERBS.arrive} ${destinationName}`,
    distanceM: 0,
    lat: arrival.lat,
    lng: arrival.lng,
    type: "arrive",
  });

  return steps;
}

function firstLandmarkAfter(
  nodes: DirectionPathNode[],
  startIndex: number,
): string | null {
  for (let i = startIndex + 1; i < nodes.length; i++) {
    const landmark = nodes[i]?.landmark;
    if (landmark) return landmark;
  }
  return null;
}

/** Exposed for tests and documentation. */
export function classifyTurn(delta: number): StepType {
  return classify(delta);
}
