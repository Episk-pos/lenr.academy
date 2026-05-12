import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useTheme } from '../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import {
  RUSSELL_OCTAVES,
  RUSSELL_COLORS,
  type RussellElement,
  type RussellOctave,
} from '../constants/russellElements'

interface RussellChart3DProps {
  onElementClick?: (Z: number) => void
}

// ─── Color Helpers ──────────────────────────────────────────────────────────

function getElementColor3D(el: RussellElement, isDark: boolean): string {
  if (el.modernSymbol === 'C') return RUSSELL_COLORS.carbon[isDark ? 'dark' : 'light']
  if (el.status === 'hypothetical') return RUSSELL_COLORS.hypothetical[isDark ? 'dark' : 'light']
  if (el.status === 'predicted') return RUSSELL_COLORS.predicted[isDark ? 'dark' : 'light']
  if (el.side === 'inertGas') return RUSSELL_COLORS.inertGas[isDark ? 'dark' : 'light']
  if (el.side === 'generation') return RUSSELL_COLORS.generation[isDark ? 'dark' : 'light']
  return RUSSELL_COLORS.radiation[isDark ? 'dark' : 'light']
}

// ─── 3D Layout Mapping ─────────────────────────────────────────────────────

const OCTAVE_Y_SPACING = 3.5
const MAX_RADIUS = 5
const ROTATION_PER_OCTAVE = Math.PI / 5 // 36° rotation per octave for helical effect

interface ElementNode {
  el: RussellElement
  octave: RussellOctave
  octaveIndex: number
  position: THREE.Vector3
}

function buildElementNodes(): ElementNode[] {
  const nodes: ElementNode[] = []

  RUSSELL_OCTAVES.forEach((octave, octaveIndex) => {
    const y = (RUSSELL_OCTAVES.length - 1 - octaveIndex) * OCTAVE_Y_SPACING
    const baseAngle = octaveIndex * ROTATION_PER_OCTAVE

    octave.elements.forEach((el) => {
      // Map position to radius: 0 = center axis, ±4 = max radius
      const absPos = Math.abs(el.position)
      const radius = (absPos / 4) * MAX_RADIUS

      // Map position to angle: generation side angles one way, radiation the other
      // Position sign determines which side of the spiral
      let angle = baseAngle
      if (el.position !== 0) {
        // Spread elements around the spiral
        // Generation (negative positions) go one direction, radiation (positive) the other
        const sideAngle = el.position < 0
          ? -Math.PI / 2 + ((el.position + 4) / 4) * (Math.PI / 3)
          : Math.PI / 2 - ((el.position - 1) / 3) * (Math.PI / 3)
        angle += sideAngle
      }

      const x = radius * Math.cos(angle)
      const z = radius * Math.sin(angle)

      nodes.push({
        el,
        octave,
        octaveIndex,
        position: new THREE.Vector3(x, y, z),
      })
    })
  })

  return nodes
}

// ─── Element Sphere Component ───────────────────────────────────────────────

interface ElementSphereProps {
  node: ElementNode
  isDark: boolean
  isHovered: boolean
  onHover: (node: ElementNode | null) => void
  onClick: (node: ElementNode) => void
}

function ElementSphere({ node, isDark, isHovered, onHover, onClick }: ElementSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const targetVec = useRef(new THREE.Vector3(1, 1, 1))
  const color = useMemo(() => getElementColor3D(node.el, isDark), [node.el, isDark])
  const isClickable = !!node.el.Z
  const isHypothetical = node.el.status === 'hypothetical'

  // Size: real elements larger, predicted medium, hypothetical smaller
  const baseSize = isHypothetical ? 0.25 : node.el.status === 'predicted' ? 0.35 : 0.4

  // Gentle hover pulse — cached Vector3 avoids per-frame allocation
  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isHovered ? 1.3 : 1.0
      targetVec.current.set(targetScale, targetScale, targetScale)
      meshRef.current.scale.lerp(targetVec.current, 0.1)
    }
  })

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(node)
    if (isClickable) {
      document.body.style.cursor = 'pointer'
    }
  }, [node, onHover, isClickable])

  const handlePointerOut = useCallback(() => {
    onHover(null)
    document.body.style.cursor = 'auto'
  }, [onHover])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick(node)
  }, [node, onClick])

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[baseSize, 24, 24]} />
        <meshStandardMaterial
          color={color}
          transparent={isHypothetical}
          opacity={isHypothetical ? 0.6 : 0.9}
          emissive={color}
          emissiveIntensity={isHovered ? 0.5 : 0.15}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      {/* Label */}
      <Text
        position={[0, baseSize + 0.3, 0]}
        fontSize={0.3}
        color={isDark ? '#e5e7eb' : '#374151'}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor={isDark ? '#111827' : '#ffffff'}
      >
        {node.el.modernSymbol || node.el.russellName.substring(0, 4)}
      </Text>
    </group>
  )
}

// ─── Central Axis & Octave Rings ────────────────────────────────────────────

function CentralAxis({ isDark }: { isDark: boolean }) {
  const topY = (RUSSELL_OCTAVES.length - 1) * OCTAVE_Y_SPACING + 1
  const bottomY = -1
  const height = topY - bottomY
  const centerY = (topY + bottomY) / 2

  return (
    <group>
      {/* Central axis line */}
      <mesh position={[0, centerY, 0]}>
        <cylinderGeometry args={[0.03, 0.03, height, 8]} />
        <meshStandardMaterial
          color={isDark ? '#4b5563' : '#9ca3af'}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Octave level rings */}
      {RUSSELL_OCTAVES.map((_, i) => {
        const y = (RUSSELL_OCTAVES.length - 1 - i) * OCTAVE_Y_SPACING
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[MAX_RADIUS, 0.02, 8, 64]} />
            <meshStandardMaterial
              color={isDark ? '#374151' : '#d1d5db'}
              transparent
              opacity={0.2}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// ─── Spiral Connection Lines ────────────────────────────────────────────────

function SpiralConnections({ nodes, isDark }: { nodes: ElementNode[]; isDark: boolean }) {
  const lines = useMemo(() => {
    const result: { points: THREE.Vector3[]; color: string }[] = []

    // Connect elements within each octave in position order
    for (const octave of RUSSELL_OCTAVES) {
      const octaveNodes = nodes
        .filter(n => n.octave.number === octave.number)
        .sort((a, b) => a.el.position - b.el.position)

      if (octaveNodes.length < 2) continue

      const points = octaveNodes.map(n => n.position)
      const color = isDark ? '#4b5563' : '#9ca3af'
      result.push({ points, color })
    }

    // Connect inert gases between octaves (vertical spine)
    const inertNodes = nodes
      .filter(n => n.el.side === 'inertGas')
      .sort((a, b) => a.octaveIndex - b.octaveIndex)

    if (inertNodes.length > 1) {
      for (let i = 0; i < inertNodes.length - 1; i++) {
        result.push({
          points: [inertNodes[i].position, inertNodes[i + 1].position],
          color: isDark ? '#6b7280' : '#9ca3af',
        })
      }
    }

    return result
  }, [nodes, isDark])

  const lineObjects = useMemo(() => {
    return lines.map((geo) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(geo.points)
      const material = new THREE.LineBasicMaterial({
        color: geo.color,
        transparent: true,
        opacity: 0.35,
      })
      return { line: new THREE.Line(geometry, material), geometry, material }
    })
  }, [lines])

  useEffect(() => {
    return () => {
      lineObjects.forEach(({ geometry, material }) => {
        geometry.dispose()
        material.dispose()
      })
    }
  }, [lineObjects])

  return (
    <group>
      {lineObjects.map((obj, i) => (
        <primitive key={i} object={obj.line} />
      ))}
    </group>
  )
}

// ─── Scene Content ──────────────────────────────────────────────────────────

interface SceneProps {
  isDark: boolean
  onElementClick?: (Z: number) => void
}

function Scene({ isDark, onElementClick }: SceneProps) {
  const { t } = useTranslation()
  const [hoveredNode, setHoveredNode] = useState<ElementNode | null>(null)
  const nodes = useMemo(() => buildElementNodes(), [])

  const handleClick = useCallback((node: ElementNode) => {
    if (node.el.Z && onElementClick) {
      onElementClick(node.el.Z)
    }
  }, [onElementClick])

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
      <directionalLight position={[-5, -5, -10]} intensity={0.3} />

      <CentralAxis isDark={isDark} />
      <SpiralConnections nodes={nodes} isDark={isDark} />

      {nodes.map((node, i) => (
        <ElementSphere
          key={`${node.octave.number}-${node.el.russellName}-${i}`}
          node={node}
          isDark={isDark}
          isHovered={hoveredNode === node}
          onHover={setHoveredNode}
          onClick={handleClick}
        />
      ))}

      {/* Tooltip HTML overlay */}
      {hoveredNode && (
        <Html
          position={[
            hoveredNode.position.x,
            hoveredNode.position.y + 1.2,
            hoveredNode.position.z,
          ]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="px-3 py-2 rounded-lg shadow-lg text-sm max-w-xs whitespace-nowrap"
            style={{
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
              color: isDark ? '#f3f4f6' : '#1f2937',
            }}
          >
            <div className="font-semibold">
              {hoveredNode.el.modernName || hoveredNode.el.russellName}
              {hoveredNode.el.modernSymbol && ` (${hoveredNode.el.modernSymbol})`}
            </div>
            <div className="text-xs opacity-75">
              {t('russellChart.octave')} {hoveredNode.octave.number} — {hoveredNode.el.side === 'generation'
                ? t('russellChart.generationSide')
                : hoveredNode.el.side === 'radiation'
                ? t('russellChart.radiationSide')
                : t('russellChart.inertGasLabel')}
            </div>
            {hoveredNode.el.Z && (
              <div className="text-xs opacity-75">Z = {hoveredNode.el.Z}</div>
            )}
            {hoveredNode.el.note && (
              <div className="text-xs mt-1 italic opacity-60">{t(hoveredNode.el.note)}</div>
            )}
          </div>
        </Html>
      )}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={50}
        target={[0, (RUSSELL_OCTAVES.length * OCTAVE_Y_SPACING) / 2 - OCTAVE_Y_SPACING, 0]}
      />
    </>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RussellChart3D({ onElementClick }: RussellChart3DProps) {
  const { theme } = useTheme()
  const { t } = useTranslation()
  const isDark = theme === 'dark'

  return (
    <div className="relative">
      <div
        className="w-full rounded-lg overflow-hidden"
        style={{
          height: '600px',
          backgroundColor: isDark ? '#111827' : '#f9fafb',
        }}
      >
        <Canvas
          camera={{
            position: [15, 18, 15],
            fov: 50,
            near: 0.1,
            far: 200,
          }}
          gl={{ antialias: true }}
        >
          <Scene isDark={isDark} onElementClick={onElementClick} />
        </Canvas>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        {t('russellChart.view3DControls')}
      </p>
    </div>
  )
}
