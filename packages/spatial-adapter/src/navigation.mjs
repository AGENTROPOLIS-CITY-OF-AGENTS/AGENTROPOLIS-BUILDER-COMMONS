/**
 * Builder Commons -> ASDS-54 navigation adapter, DOM-free.
 * Presentation only: never grants execution authority or accesses credentials.
 */
export const COMMONS_SPATIAL_STOPS = Object.freeze([
  { id: "atrium", title: "Builder Atrium", section: "discovery" },
  { id: "forge", title: "Forge", section: "build" },
  { id: "project-rooms", title: "Project Rooms", section: "collaboration" },
  { id: "guilds", title: "Guilds", section: "community" },
  { id: "agent-dock", title: "Agent Dock", section: "presence" },
  { id: "compute-dock", title: "Compute Dock", section: "compute" },
  { id: "broadcast-tower", title: "Broadcast Tower", section: "media" },
  { id: "xr-portal", title: "XR Portal", section: "spatial" },
  { id: "opportunity-exchange", title: "Opportunity Exchange", section: "opportunities" },
]);

const LEVELS = ["globe", "city", "district", "street", "building", "interior"];
export const COMMONS_SPATIAL_MODES = Object.freeze(["FULL", "ADAPT", "LITE", "MIN"]);

export function createCommonsSpatialNavigation({ districtId = "builder-commons", defaultMode = "ADAPT" } = {}) {
  if (!COMMONS_SPATIAL_MODES.includes(defaultMode)) throw new TypeError("Invalid spatial mode");
  if (typeof districtId !== "string" || !/^[a-z0-9-]+$/.test(districtId)) throw new TypeError("Invalid district id");
  let mode = defaultMode;
  let level = "district";
  let stop = null;
  return Object.freeze({
    getSnapshot() {
      return { districtId, level, stopId: stop, mode, isSimulation: true, agentExecutionGranted: false };
    },
    destinations() { return COMMONS_SPATIAL_STOPS.map(({ id, title, section }) => ({ id, title, section })); },
    enterStop(stopId) {
      if (!COMMONS_SPATIAL_STOPS.some((x) => x.id === stopId)) throw new RangeError("Unknown Commons destination");
      stop = stopId;
      level = "building";
      return this.getSnapshot();
    },
    enterInterior() {
      if (!stop) throw new Error("Select a destination first");
      level = "interior";
      return this.getSnapshot();
    },
    returnToDistrict() { stop = null; level = "district"; return this.getSnapshot(); },
    setMode(next) {
      if (!COMMONS_SPATIAL_MODES.includes(next)) throw new TypeError("Invalid spatial mode");
      mode = next;
      return this.getSnapshot();
    },
    canNavigate(levelName) { return LEVELS.includes(levelName); },
  });
}
