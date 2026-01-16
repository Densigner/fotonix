// Minimal registry for section plugins
const MapStore = new Map();

export function registerSection(type, plugin) {
  if (!type) throw new Error("type required");
  MapStore.set(type, plugin);
}

export function getSection(type) {
  return MapStore.get(type);
}

export function entries() {
  return MapStore.entries();
}

export const registry = { register: registerSection, get: getSection, entries };

// default export for convenience
export default registry;
