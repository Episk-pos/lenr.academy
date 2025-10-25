import type { Core } from 'cytoscape';

/**
 * Cycle Detection Result
 */
export interface CycleDetectionResult {
  /** Nuclides participating in at least one cycle */
  cycleNuclides: Set<string>;
  /** Strongly connected components (each component is a set of node IDs) */
  stronglyConnectedComponents: string[][];
  /** Number of feedback loops detected */
  cycleCount: number;
}

/**
 * Detect cycles and feedback loops in a Cytoscape graph
 *
 * Uses Cytoscape's built-in graph algorithms to find:
 * 1. Strongly connected components (SCCs) - groups of nodes that can reach each other
 * 2. Individual cycles - circular reaction pathways
 *
 * @param cy - Cytoscape instance with graph data
 * @returns CycleDetectionResult with cycle information
 */
export function detectCycles(cy: Core): CycleDetectionResult {
  const cycleNuclides = new Set<string>();
  const stronglyConnectedComponents: string[][] = [];
  let cycleCount = 0;

  // Get all nodes
  const nodes = cy.nodes();

  // Find strongly connected components using Tarjan's algorithm
  // A strongly connected component (SCC) is a maximal set of vertices
  // where every vertex can reach every other vertex
  const visited = new Set<string>();
  const stack: string[] = [];
  const lowLink = new Map<string, number>();
  const disc = new Map<string, number>();
  let time = 0;

  function strongConnect(nodeId: string) {
    // Set the depth index for this node to the smallest unused index
    disc.set(nodeId, time);
    lowLink.set(nodeId, time);
    time++;
    stack.push(nodeId);
    visited.add(nodeId);

    // Consider successors (outgoing edges)
    const node = cy.getElementById(nodeId);
    const outgoers = node.outgoers('node');

    outgoers.forEach((successor) => {
      const successorId = successor.id();

      if (!disc.has(successorId)) {
        // Successor has not yet been visited; recurse on it
        strongConnect(successorId);
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, lowLink.get(successorId)!));
      } else if (stack.includes(successorId)) {
        // Successor is in stack and hence in the current SCC
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, disc.get(successorId)!));
      }
    });

    // If nodeId is a root node, pop the stack and generate an SCC
    if (lowLink.get(nodeId) === disc.get(nodeId)) {
      const scc: string[] = [];
      let w: string;

      do {
        w = stack.pop()!;
        scc.push(w);
      } while (w !== nodeId);

      // Only consider SCCs with more than one node (or self-loops) as cycles
      if (scc.length > 1) {
        stronglyConnectedComponents.push(scc);
        scc.forEach((id) => cycleNuclides.add(id));
        cycleCount++;
      } else {
        // Check for self-loop
        const selfLoops = cy.getElementById(nodeId).connectedEdges(`[source = "${nodeId}"][target = "${nodeId}"]`);
        if (selfLoops.length > 0) {
          stronglyConnectedComponents.push(scc);
          cycleNuclides.add(nodeId);
          cycleCount++;
        }
      }
    }
  }

  // Run Tarjan's algorithm on all unvisited nodes
  nodes.forEach((node) => {
    const nodeId = node.id();
    if (!disc.has(nodeId)) {
      strongConnect(nodeId);
    }
  });

  return {
    cycleNuclides,
    stronglyConnectedComponents,
    cycleCount,
  };
}

/**
 * Check if a specific nuclide participates in any reaction cycle
 *
 * @param cy - Cytoscape instance
 * @param nuclideId - Nuclide node ID to check
 * @returns true if nuclide is part of a cycle
 */
export function isInCycle(cy: Core, nuclideId: string): boolean {
  const node = cy.getElementById(nuclideId);
  if (!node.length) return false;

  // Check if node can reach itself via any path
  // Use BFS to find path back to self
  const visited = new Set<string>();
  const queue: string[] = [];

  // Start from all direct successors
  node.outgoers('node').forEach((successor) => {
    queue.push(successor.id());
  });

  while (queue.length > 0) {
    const current = queue.shift()!;

    // If we reached back to the starting node, it's a cycle
    if (current === nuclideId) {
      return true;
    }

    if (visited.has(current)) continue;
    visited.add(current);

    // Add successors to queue
    const currentNode = cy.getElementById(current);
    currentNode.outgoers('node').forEach((successor) => {
      const successorId = successor.id();
      if (!visited.has(successorId)) {
        queue.push(successorId);
      }
    });
  }

  return false;
}

/**
 * Find all simple cycles starting from a given nuclide
 * (A simple cycle visits each node at most once)
 *
 * @param cy - Cytoscape instance
 * @param startNuclideId - Starting nuclide
 * @param maxDepth - Maximum cycle length to search (default: 10)
 * @returns Array of cycles, where each cycle is an array of node IDs
 */
export function findSimpleCycles(
  cy: Core,
  startNuclideId: string,
  maxDepth: number = 10
): string[][] {
  const cycles: string[][] = [];
  const startNode = cy.getElementById(startNuclideId);

  if (!startNode.length) return cycles;

  // DFS to find all paths back to start
  function dfs(current: string, path: string[], depth: number) {
    if (depth > maxDepth) return;

    // If we've returned to start and have a non-trivial path, we found a cycle
    if (current === startNuclideId && path.length > 0) {
      cycles.push([...path]);
      return;
    }

    // Don't revisit nodes (simple cycle constraint)
    if (path.includes(current)) return;

    path.push(current);

    // Explore successors
    const node = cy.getElementById(current);
    node.outgoers('node').forEach((successor) => {
      dfs(successor.id(), [...path], depth + 1);
    });
  }

  // Start DFS from all direct successors of the start node
  startNode.outgoers('node').forEach((successor) => {
    dfs(successor.id(), [], 0);
  });

  return cycles;
}
