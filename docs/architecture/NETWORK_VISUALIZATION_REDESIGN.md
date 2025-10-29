# Cascade Network Visualization - D3.js Redesign

**Status**: In Progress
**Date**: 2025-10-25
**Decision**: Migrate from Cytoscape.js to D3.js for Gource-inspired real-time force-directed visualization

---

## Why D3.js?

### Problems with Cytoscape.js
- ❌ Layouts designed to run, stabilize, and **stop** - not continuous
- ❌ Particle animations require custom canvas overlay
- ❌ Camera following requires manual `cy.animate()` calls - not smooth
- ❌ Limited visual effects (constrained by Cytoscape's styling system)
- ❌ Fighting the library's architecture with hacks and workarounds

### Benefits of D3.js
- ✅ **d3-force**: Continuous physics simulation runs at 60fps by default
- ✅ **d3-zoom**: Smooth, programmatic zoom/pan with built-in transitions
- ✅ Direct SVG/Canvas control = unlimited visual effects
- ✅ Particle systems trivial to implement
- ✅ Perfect for Gource-style visualizations (many examples exist)
- ✅ Better performance with Canvas rendering

---

## Requirements

### Core Concept
A living, breathing visualization where nuclear cascade reactions unfold in real-time with:
- 🌊 Continuous force-directed physics (never stops)
- 📹 Auto camera following active elements
- 💫 Fading history (active = bright, inactive = dim)
- ⚡ Rich visual effects (particles, glows, pulses)

### User Responses
1. **Pathway Filtering**: Support filtering but only if clean (no orphaned nodes)
2. **Inactive Elements**: Fade them out (dim/semi-transparent)
3. **Camera Following**: Yes, auto-pan and zoom to follow action
4. **Visual Effects**: All three - particle flow, node pulse/glow, energy-based brightness

---

## Technical Architecture

### Data Flow
```
Cascade Reactions
    ↓
Filter by Frequency (clean - no orphans)
    ↓
Build Activity Tracking (first/last loop, recency)
    ↓
Create D3 Nodes/Links with Metadata
    ↓
Force Simulation (continuous)
    ↓
Render Loop (60fps)
    ├─→ Update Node Positions
    ├─→ Update Edge Paths
    ├─→ Animate Particles
    ├─→ Update Opacity/Glow
    └─→ Auto-follow Camera
```

### Component Structure
```typescript
CascadeNetworkDiagram
├─ buildGraphData()        // Phase 1: Clean filtering
├─ initSimulation()        // Phase 2: Setup d3-force
├─ initParticleSystem()    // Phase 3: Particle animation
├─ renderLoop()            // Phase 4: 60fps render
├─ autoFollowCamera()      // Phase 5: Viewport tracking
└─ handleTimelineUpdate()  // Phase 6: Loop progression
```

---

## Data Structures

### Node Data
```typescript
interface GraphNode {
  // Identity
  id: string;              // e.g., "Li-7"
  label: string;

  // Activity tracking
  firstLoop: number;       // When it first appeared
  lastActiveLoop: number;  // Most recent activity
  isActive: boolean;       // Active in current loop
  recency: number;         // 1.0 = active now, decays exponentially

  // Visual properties
  size: number;            // Based on frequency
  inputCount: number;      // For color blending
  outputCount: number;
  role: NodeRole;

  // D3 physics (added by simulation)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;      // Fixed position (for pinning)
  fy?: number | null;
}
```

### Edge Data
```typescript
interface GraphLink {
  // Identity
  source: string | GraphNode;
  target: string | GraphNode;

  // Activity tracking
  firstLoop: number;
  isActive: boolean;

  // Visual properties
  type: 'fusion' | 'twotwo';
  energy: number;          // MeV
  frequency: number;       // How often this pathway occurs

  // Particle system
  particles: Particle[];   // Active particles on this edge
  showParticles: boolean;  // Based on frequency/energy
}
```

### Particle Data
```typescript
interface Particle {
  id: string;
  edge: GraphLink;
  progress: number;        // 0.0 to 1.0 along edge
  speed: number;           // Based on energy
  size: number;            // Based on energy
  color: string;           // Green=exothermic, red=endothermic
}
```

---

## Visual Effects Specification

### 1. Recency-Based Fading
```typescript
// Exponential decay function
recency = loopsSinceActive === 0
  ? 1.0
  : Math.max(0.2, Math.exp(-loopsSinceActive / 3));

// Node opacity
opacity = 0.3 + (0.7 * recency);  // 0.3 to 1.0

// Edge opacity
opacity = isActive ? 0.8 : (0.2 + 0.3 * recency);
```

### 2. Active Node Glow
```typescript
// Active nodes get golden halo
if (isActive) {
  node.attr("filter", "url(#active-glow)");
  node.select("circle")
    .attr("stroke", "#FFD700")
    .attr("stroke-width", 4);
}
```

### 3. Energy-Based Edge Brightness
```typescript
// More exothermic = brighter green, more endothermic = dimmer red
const brightness = Math.min(1.0, 0.3 + Math.abs(MeV) / 20);
const color = MeV > 0
  ? `rgba(126, 211, 33, ${brightness})`  // Green glow
  : `rgba(208, 2, 27, ${brightness * 0.5})`;  // Dim red
```

### 4. Particle Flow System
```typescript
// Create particles for high-frequency/energy pathways
if (frequency > 5 || Math.abs(energy) > 10) {
  edge.particles = createParticles(edge, count);
}

// Update particles each frame
particles.forEach(p => {
  p.progress += p.speed * deltaTime;
  if (p.progress >= 1.0) {
    // Particle reached end - recycle or remove
    resetParticle(p);
  }
});

// Render particles as small circles with trails
ctx.fillStyle = particle.color;
ctx.globalAlpha = 0.8;
ctx.beginPath();
ctx.arc(x, y, particle.size, 0, 2 * Math.PI);
ctx.fill();
```

---

## Force Simulation Configuration

### Forces
```typescript
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links)
    .id(d => d.id)
    .distance(100)
    .strength(0.5)
  )
  .force("charge", d3.forceManyBody()
    .strength(-300)  // Repulsion between nodes
  )
  .force("center", d3.forceCenter(width / 2, height / 2)
    .strength(0.05)  // Gentle pull to center
  )
  .force("collision", d3.forceCollide()
    .radius(d => d.size + 5)  // Prevent overlap
  )
  .alphaDecay(0)  // Never stop! (continuous simulation)
  .velocityDecay(0.4);  // Friction
```

### Why `alphaDecay(0)`?
- D3 simulations normally "cool down" and stop (alpha → 0)
- Setting `alphaDecay(0)` keeps alpha constant = **infinite simulation**
- Physics continues running smoothly forever (Gource-style!)

---

## Camera Following Implementation

### Track Active Elements
```typescript
function autoFollowCamera(activeNodes: GraphNode[]) {
  if (activeNodes.length === 0) return;

  // Calculate bounding box of active nodes
  const bounds = {
    minX: Math.min(...activeNodes.map(n => n.x!)),
    maxX: Math.max(...activeNodes.map(n => n.x!)),
    minY: Math.min(...activeNodes.map(n => n.y!)),
    maxY: Math.max(...activeNodes.map(n => n.y!)),
  };

  // Add padding
  const padding = 50;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  // Calculate zoom to fit
  const scale = Math.min(
    viewportWidth / width,
    viewportHeight / height,
    2.0  // Max zoom
  );

  // Smooth transition
  svg.transition()
    .duration(800)
    .ease(d3.easeCubicOut)
    .call(
      zoom.transform,
      d3.zoomIdentity
        .translate(viewportWidth / 2, viewportHeight / 2)
        .scale(scale)
        .translate(-centerX, -centerY)
    );
}
```

---

## Rendering Strategy

### SVG vs Canvas

**Use SVG for:**
- ✅ Nodes (interactive, can attach events)
- ✅ Labels (crisp text)
- ✅ Edges (SVG paths are fine for ~50-100 edges)

**Use Canvas overlay for:**
- ✅ Particles (hundreds of moving circles = much faster)
- ✅ Glow effects (blur filters expensive in SVG)
- ✅ Optional: edges if >200 edges

### Hybrid Approach
```html
<div className="network-container">
  <svg className="network-svg">
    <!-- Nodes and labels -->
  </svg>
  <canvas className="particles-canvas">
    <!-- Particles rendered here -->
  </canvas>
</div>
```

---

## Performance Considerations

### Limits
- **Nodes**: Warn if >200, force-disable particles if >300
- **Edges**: Switch to Canvas if >200
- **Particles**: Cap at 100 simultaneous particles
- **Pathway Filter**: Default to top 50 pathways

### Optimizations
1. **RequestAnimationFrame**: Sync with browser refresh (60fps)
2. **Dirty Flag**: Only update DOM when positions change significantly
3. **Particle Pooling**: Recycle particle objects instead of create/destroy
4. **Spatial Hashing**: For collision detection if needed
5. **Web Workers**: Offload physics simulation if >150 nodes

---

## Implementation Phases

### Phase 1: Core D3 Setup ✅ (Next)
- [ ] Install D3 dependencies (`d3-force`, `d3-selection`, `d3-zoom`)
- [ ] Create clean graph building function (no orphans)
- [ ] Setup force simulation with continuous physics
- [ ] Basic SVG rendering (nodes + edges)

### Phase 2: Activity Tracking
- [ ] Implement recency calculation
- [ ] Add opacity fading for inactive elements
- [ ] Style active vs inactive nodes/edges

### Phase 3: Camera Following
- [ ] Track active node bounds
- [ ] Implement smooth zoom/pan transitions
- [ ] Add user manual pan/zoom override

### Phase 4: Visual Effects
- [ ] Active node pulse/glow (SVG filters)
- [ ] Energy-based edge coloring
- [ ] Particle system (Canvas overlay)

### Phase 5: UI Integration
- [ ] Timeline controls integration
- [ ] Advanced settings (particle toggle, show inactive)
- [ ] Performance monitoring

### Phase 6: Polish & Testing
- [ ] Test with various cascade sizes
- [ ] Performance profiling
- [ ] Accessibility (keyboard controls, ARIA)

---

## Migration Strategy

1. **Keep Cytoscape code** - Comment out, don't delete (easy rollback)
2. **Parallel development** - Build D3 version alongside
3. **Feature flag** - Toggle between implementations for testing
4. **Gradual cutover** - Ship D3 when feature-complete

---

## Success Metrics

### What "Good" Looks Like
- ⚡ Smooth 60fps animation even with 100+ nodes
- 🎬 Mesmerizing to watch (like Gource)
- 📊 Clear visual hierarchy (active vs inactive)
- 🎮 Responsive controls (timeline, zoom, pan)
- 🎨 Beautiful visual effects without performance hit

### User Experience Goals
- User says "Wow, that's beautiful"
- Can follow cascade evolution intuitively
- Identifies key pathways at a glance
- Wants to share it with others

---

## References

- [D3 Force Documentation](https://d3js.org/d3-force)
- [D3 Zoom Documentation](https://d3js.org/d3-zoom)
- [Gource Source Code](https://github.com/acaudwell/Gource)
- [Observable: Force-Directed Graph](https://observablehq.com/@d3/force-directed-graph)
- [Observable: Continuous Force Layout](https://observablehq.com/@d3/continuous-force-directed-graph)
