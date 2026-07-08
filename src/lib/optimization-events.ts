/**
 * Tiny pub/sub for the "Optimize Warehouse" cinematic.
 * Components subscribe to react when a full optimization pass completes
 * (e.g. the insights feed prepends new detections, the Copilot fires an
 * executive summary, etc.).
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onOptimizationComplete(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitOptimizationComplete() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error("[optimization-events] listener failed", e);
    }
  });
}
