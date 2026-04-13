'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SimulationParameter, SimulationSpec } from '@/lib/simulations'

type Props = { spec: SimulationSpec }
type SceneMetrics = { lines: Array<[string, string]>; viz: ReactNode; caption?: string }
type Vec = { x: number; y: number }

// ─── Utility helpers ───────────────────────────────────────────────────────

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00'
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
function toRadians(value: number) { return (value * Math.PI) / 180 }
function vec(x: number, y: number): Vec { return { x, y } }
function add(a: Vec, b: Vec): Vec { return { x: a.x + b.x, y: a.y + b.y } }
function scaleVec(v: Vec, s: number): Vec { return { x: v.x * s, y: v.y * s } }
function pointsString(pts: Vec[]) { return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') }
function pathFromSampler(steps: number, sample: (ratio: number) => Vec) {
  return Array.from({ length: steps }, (_, i) => {
    const r = steps <= 1 ? 0 : i / (steps - 1)
    const p = sample(r)
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }).join(' ')
}

/** Standard physics-textbook coil spring: zigzag between (x1,cy) and (x2,cy) */
function springCoilPath(x1: number, x2: number, cy: number, coils = 7): string {
  const n = coils * 2
  const gap = 10
  const segW = (x2 - x1 - gap * 2) / n
  const amp = 13
  const pts: string[] = [`M ${x1} ${cy}`, `L ${(x1 + gap).toFixed(1)} ${cy - amp}`]
  for (let i = 1; i < n; i++) {
    const x = x1 + gap + i * segW
    const y = cy + (i % 2 === 0 ? -amp : amp)
    pts.push(`L ${x.toFixed(1)} ${y}`)
  }
  pts.push(`L ${x2} ${cy}`)
  return pts.join(' ')
}

// ─── SVG sub-components (render inside <svg>) ─────────────────────────────

/** Arrow from p1 → p2 with a filled arrowhead */
function Arrow({ x1, y1, x2, y2, color = 'rgba(12,26,60,0.6)', width = 2.5 }: {
  x1: number; y1: number; x2: number; y2: number; color?: string; width?: number
}) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 2) return null
  const ux = dx / len, uy = dy / len
  const sz = 8, perp = sz * 0.45
  const bx = x2 - ux * sz, by = y2 - uy * sz
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon
        points={`${x2.toFixed(1)},${y2.toFixed(1)} ${(bx - uy * perp).toFixed(1)},${(by + ux * perp).toFixed(1)} ${(bx + uy * perp).toFixed(1)},${(by - ux * perp).toFixed(1)}`}
        fill={color}
      />
    </g>
  )
}

/** Horizontal double-headed measurement arrow with a centred label above */
function HorzMeasure({ x1, x2, y, label, color = 'rgba(201,151,0,0.8)' }: {
  x1: number; x2: number; y: number; label: string; color?: string
}) {
  const mid = (x1 + x2) / 2
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={1.8} />
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} stroke={color} strokeWidth={1.8} />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} stroke={color} strokeWidth={1.8} />
      <text x={mid} y={y - 6} textAnchor="middle" fontSize={9} fill={color}>{label}</text>
    </g>
  )
}

/** Stacked KE / PE energy bars placed at top-left (x, y) */
function EnergyBars({ x, y, keRatio, peRatio }: { x: number; y: number; keRatio: number; peRatio: number }) {
  const maxH = 60, barW = 14, gap = 5
  const ke = clamp(keRatio, 0, 1), pe = clamp(peRatio, 0, 1)
  return (
    <g>
      <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={8} fill="rgba(12,26,60,0.45)">KE</text>
      <text x={x + barW + gap + barW / 2} y={y - 5} textAnchor="middle" fontSize={8} fill="rgba(12,26,60,0.45)">PE</text>
      <rect x={x} y={y} width={barW} height={maxH} rx={3} fill="rgba(12,26,60,0.07)" />
      <rect x={x + barW + gap} y={y} width={barW} height={maxH} rx={3} fill="rgba(12,26,60,0.07)" />
      <rect x={x} y={y + maxH * (1 - ke)} width={barW} height={maxH * ke} rx={3} fill="var(--nd-gold)" />
      <rect x={x + barW + gap} y={y + maxH * (1 - pe)} width={barW} height={maxH * pe} rx={3} fill="#1c315e" opacity={0.75} />
      <text x={x + barW + gap / 2} y={y + maxH + 11} textAnchor="middle" fontSize={7} fill="rgba(12,26,60,0.4)">energy</text>
    </g>
  )
}

// ─── Scene wrapper ─────────────────────────────────────────────────────────

function Scene({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div>
      <div
        className="rounded-[26px] overflow-hidden border"
        style={{
          borderColor: 'rgba(12,26,60,0.08)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(246,243,235,0.94) 100%)',
          boxShadow: '0 16px 34px rgba(24, 42, 84, 0.08)',
        }}
      >
        <svg viewBox="0 0 360 240" className="block w-full h-auto" aria-hidden="true">
          {children}
        </svg>
      </div>
      {caption && (
        <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--nd-muted)' }}>
          {caption}
        </p>
      )}
    </div>
  )
}

// ─── Slider ────────────────────────────────────────────────────────────────

function Slider({ parameter, value, onChange }: {
  parameter: SimulationParameter; value: number; onChange: (next: number) => void
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--nd-text)' }}>{parameter.label}</span>
        <span className="text-xs" style={{ color: 'var(--nd-muted)' }}>
          {formatNumber(value)}{parameter.unit ? ` ${parameter.unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={parameter.min}
        max={parameter.max}
        step={parameter.step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATION METRIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Basketball / stacked-ball collision ───────────────────────────────────

function basketballCollisionMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const g = 9.8
  const basketballMass = 0.62
  const tennisMass = values.upperMass
  const basketballRadius = 0.38
  const tennisRadius = 0.12
  const separation = basketballRadius + tennisRadius
  const dropHeight = values.dropHeight
  const floorRestitution = values.basketballBounce
  const collisionRestitution = values.collisionElasticity
  const impactSpeed = Math.sqrt(2 * g * dropHeight)
  const tDrop = Math.sqrt((2 * dropHeight) / g)
  const gapTime = separation / Math.max((1 + floorRestitution) * impactSpeed, 0.01)
  const bottomCollisionHeight = basketballRadius + floorRestitution * impactSpeed * gapTime - 0.5 * g * gapTime * gapTime
  const topCollisionHeight = basketballRadius + separation - impactSpeed * gapTime - 0.5 * g * gapTime * gapTime
  const bottomBefore = floorRestitution * impactSpeed - g * gapTime
  const topBefore = -impactSpeed - g * gapTime
  const bottomAfter =
    ((basketballMass - collisionRestitution * tennisMass) * bottomBefore + (1 + collisionRestitution) * tennisMass * topBefore)
    / (basketballMass + tennisMass)
  const topAfter =
    ((tennisMass - collisionRestitution * basketballMass) * topBefore + (1 + collisionRestitution) * basketballMass * bottomBefore)
    / (basketballMass + tennisMass)
  const peakHeight = topCollisionHeight + Math.max(0, topAfter) * Math.max(0, topAfter) / (2 * g)
  const speedGain = topAfter / impactSpeed
  const cycle = tDrop + gapTime + Math.max(1.2, Math.max(topAfter, 0) / g + 1)
  const stageTime = time % cycle
  const visibleHeight = clamp(Math.max(3.3, dropHeight * 2 + 0.8), 3.3, 4.8)
  const floorY = 210
  const scale = 168 / visibleHeight

  function sampleState(t: number) {
    if (t <= tDrop) {
      return {
        basketballY: basketballRadius + dropHeight - 0.5 * g * t * t,
        tennisY: basketballRadius + dropHeight + separation - 0.5 * g * t * t,
      }
    }
    if (t <= tDrop + gapTime) {
      const elapsed = t - tDrop
      return {
        basketballY: basketballRadius + floorRestitution * impactSpeed * elapsed - 0.5 * g * elapsed * elapsed,
        tennisY: basketballRadius + separation - impactSpeed * elapsed - 0.5 * g * elapsed * elapsed,
      }
    }
    const elapsed = t - tDrop - gapTime
    return {
      basketballY: Math.max(basketballRadius, bottomCollisionHeight + bottomAfter * elapsed - 0.5 * g * elapsed * elapsed),
      tennisY: Math.max(tennisRadius, topCollisionHeight + topAfter * elapsed - 0.5 * g * elapsed * elapsed),
    }
  }

  const state = sampleState(stageTime)
  const basketballScreenY = floorY - state.basketballY * scale
  const tennisScreenY = floorY - state.tennisY * scale
  const basketballScreenRadius = basketballRadius * scale
  const tennisScreenRadius = tennisRadius * scale
  const peakScreenY = floorY - Math.min(peakHeight, visibleHeight) * scale
  const topOffFrame = peakHeight > visibleHeight
  const trailStart = tDrop + gapTime
  const trailDuration = Math.max(0.15, Math.min(stageTime - trailStart, Math.max(topAfter, 0) / g))
  const trailPath = stageTime <= trailStart ? '' : pathFromSampler(18, ratio => {
    const elapsed = ratio * trailDuration
    const height = topCollisionHeight + topAfter * elapsed - 0.5 * g * elapsed * elapsed
    return { x: 228 + ratio * 54, y: floorY - clamp(height, 0, visibleHeight) * scale }
  })
  const isColliding = Math.abs(stageTime - (tDrop + gapTime)) < 0.08

  return {
    lines: [
      ['Upper Ball Peak', `${formatNumber(peakHeight)} m`],
      ['Speed Gain', `${formatNumber(speedGain)}×`],
      ['Launch Speed', `${formatNumber(Math.max(0, topAfter))} m/s`],
    ],
    viz: (
      <Scene caption="Ball sizes are exaggerated for visibility. Timing and rebound trends follow a stacked elastic-collision model.">
        {/* Sky / court background */}
        <rect x="0" y="0" width="360" height="240" fill="#eef5fb" />
        <rect x="0" y="0" width="360" height="130" fill="rgba(178,206,233,0.22)" />
        {/* Wooden floor */}
        <rect x="0" y={floorY} width="360" height="30" fill="#d7c2a3" />
        <rect x="0" y={floorY + 20} width="360" height="30" fill="#c39d74" />
        {[0, 60, 120, 180, 240, 300].map(x => (
          <line key={x} x1={x} y1={floorY} x2={x + 30} y2={floorY + 20} stroke="rgba(180,140,90,0.35)" strokeWidth="1" />
        ))}
        <line x1="28" y1={floorY} x2="332" y2={floorY} stroke="rgba(12,26,60,0.28)" strokeWidth="2.5" />
        {/* Release height dashed line */}
        <line x1="44" y1={floorY - dropHeight * scale - basketballScreenRadius}
              x2="220" y2={floorY - dropHeight * scale - basketballScreenRadius}
              stroke="rgba(12,26,60,0.14)" strokeDasharray="5 4" />
        <text x="48" y={floorY - dropHeight * scale - basketballScreenRadius - 7}
              fontSize="10" fill="rgba(12,26,60,0.42)">Release</text>
        {/* Predicted peak dashed line + label */}
        <line x1="200" y1={peakScreenY} x2="336" y2={peakScreenY} stroke="rgba(201,151,0,0.45)" strokeDasharray="5 4" />
        <text x="206" y={peakScreenY - 5} fontSize="9" fill="rgba(201,151,0,0.8)">
          Peak {formatNumber(peakHeight, 1)} m
        </text>
        {/* Tennis ball trail */}
        {trailPath && (
          <path d={trailPath} fill="none" stroke="rgba(201,151,0,0.5)" strokeWidth="2.5" strokeDasharray="5 4" />
        )}
        {/* Collision flash */}
        {isColliding && (
          <circle cx="140" cy={(basketballScreenY + tennisScreenY) / 2} r="22"
            fill="rgba(244,214,107,0.2)" stroke="rgba(244,214,107,0.7)" strokeWidth="2" />
        )}
        {/* Basketball */}
        <circle cx="140" cy={basketballScreenY} r={basketballScreenRadius}
          fill="#e17c34" stroke="rgba(12,26,60,0.28)" strokeWidth="2" />
        <path d={`M ${140 - basketballScreenRadius * 0.92} ${basketballScreenY} Q 140 ${basketballScreenY - basketballScreenRadius * 0.34} ${140 + basketballScreenRadius * 0.92} ${basketballScreenY}`}
          fill="none" stroke="rgba(12,26,60,0.26)" strokeWidth="1.6" />
        <path d={`M ${140 - basketballScreenRadius * 0.76} ${basketballScreenY - basketballScreenRadius * 0.52} Q 140 ${basketballScreenY + basketballScreenRadius * 0.06} ${140 + basketballScreenRadius * 0.76} ${basketballScreenY - basketballScreenRadius * 0.52}`}
          fill="none" stroke="rgba(12,26,60,0.22)" strokeWidth="1.4" />
        <text x="140" y={basketballScreenY + 4} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)" fontWeight="600">BB</text>
        {/* Tennis ball */}
        <circle cx="140" cy={tennisScreenY} r={tennisScreenRadius}
          fill="#d7f160" stroke="rgba(12,26,60,0.28)" strokeWidth="1.8" />
        <path d={`M ${140 - tennisScreenRadius * 0.85} ${tennisScreenY + tennisScreenRadius * 0.2} Q 140 ${tennisScreenY - tennisScreenRadius * 0.45} ${140 + tennisScreenRadius * 0.85} ${tennisScreenY + tennisScreenRadius * 0.2}`}
          fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="1.8" />
        {/* Off-frame indicator */}
        {topOffFrame && (
          <>
            <path d="M 140 18 L 133 30 H 147 Z" fill="rgba(201,151,0,0.9)" />
            <text x="154" y="27" fontSize="10" fill="var(--nd-text)">Tennis ball leaves frame</text>
          </>
        )}
        {/* Title */}
        <text x="26" y="26" fontSize="12" fontWeight="700" fill="var(--nd-text)">Stacked-ball rebound</text>
        <text x="26" y="42" fontSize="10" fill="rgba(12,26,60,0.55)">
          Momentum transfer from the basketball launches the tennis ball much higher.
        </text>
      </Scene>
    ),
  }
}

// ─── Ballistic cart ────────────────────────────────────────────────────────

function ballisticCartMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const g = 9.8
  const angle = toRadians(values.trackAngle)
  const track = vec(Math.cos(angle), -Math.sin(angle))
  const normal = vec(Math.sin(angle), Math.cos(angle))
  const flight = (2 * values.launchSpeed) / Math.max(g * Math.cos(angle), 0.3)
  const cycle = flight + 1.5
  const stageTime = Math.min(time % cycle, flight)
  const catchOffset = 0.5 * (g * Math.sin(angle) - values.cartAccel) * flight * flight
  const result = Math.abs(catchOffset) < 0.08 ? 'Returns to cart' : catchOffset > 0 ? 'Ball lands ahead' : 'Cart runs ahead'
  const resultColor = Math.abs(catchOffset) < 0.08 ? '#22c55e' : '#ef4444'

  const cartAt = (t: number) => add(vec(0, 0), scaleVec(track, values.cartSpeed * t + 0.5 * values.cartAccel * t * t))
  const ballAt = (t: number) =>
    add(scaleVec(track, values.cartSpeed * t), add(scaleVec(normal, values.launchSpeed * t), vec(0, -0.5 * g * t * t)))

  const cartPos = cartAt(stageTime)
  const ballPos = ballAt(stageTime)
  const extent = Math.max(values.cartSpeed * cycle + 0.5 * Math.max(values.cartAccel, g * Math.sin(angle), 0) * cycle * cycle + 1.4, 3.2)
  const scale = Math.min(92, 250 / extent)
  const origin = vec(62, 186)
  const toScreen = (point: Vec) => vec(origin.x + point.x * scale, origin.y - point.y * scale)

  const cartHalfLength = 0.3, cartHalfHeight = 0.12
  const cartCorners = [
    add(add(cartPos, scaleVec(track, -cartHalfLength)), scaleVec(normal, 0.02)),
    add(add(cartPos, scaleVec(track, cartHalfLength)), scaleVec(normal, 0.02)),
    add(add(cartPos, scaleVec(track, cartHalfLength)), scaleVec(normal, 2 * cartHalfHeight)),
    add(add(cartPos, scaleVec(track, -cartHalfLength)), scaleVec(normal, 2 * cartHalfHeight)),
  ].map(toScreen)

  const wheelOffset = 0.18, wheelRadius = 8
  const leftWheel = toScreen(add(cartPos, scaleVec(track, -wheelOffset)))
  const rightWheel = toScreen(add(cartPos, scaleVec(track, wheelOffset)))
  const basket = toScreen(add(add(cartPos, scaleVec(normal, 0.2)), scaleVec(track, 0.06)))
  const trailPath = pathFromSampler(22, ratio => toScreen(ballAt(flight * ratio)))
  const trackStart = toScreen(add(vec(0, 0), scaleVec(track, -0.55)))
  const trackEnd = toScreen(add(vec(0, 0), scaleVec(track, extent)))
  const ballScreen = toScreen(ballPos)

  return {
    lines: [
      ['Flight Time', `${formatNumber(flight)} s`],
      ['Catch Offset', `${formatNumber(Math.abs(catchOffset) * 100, 0)} cm`],
      ['Outcome', result],
    ],
    viz: (
      <Scene caption="The ball is launched perpendicular to the track. Whether it lands back in the cart depends on matching the along-track acceleration.">
        <rect x="0" y="0" width="360" height="240" fill="#edf4fa" />
        <rect x="0" y="155" width="360" height="85" fill="#e4d8c3" />
        {/* Track */}
        <path d={`M ${trackStart.x} ${trackStart.y} L ${trackEnd.x} ${trackEnd.y}`} stroke="#6c7688" strokeWidth="13" strokeLinecap="round" />
        <path d={`M ${trackStart.x} ${trackStart.y - 7} L ${trackEnd.x} ${trackEnd.y - 7}`} stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
        {/* Track ruler marks */}
        {Array.from({ length: 6 }, (_, i) => {
          const anchor = toScreen(add(vec(0, 0), scaleVec(track, (i / 5) * extent)))
          return <line key={i} x1={anchor.x} y1={anchor.y} x2={anchor.x} y2="222" stroke="rgba(12,26,60,0.07)" strokeWidth="1.5" />
        })}
        {/* Ball trajectory */}
        <path d={trailPath} fill="none" stroke="rgba(201,151,0,0.4)" strokeWidth="2.5" strokeDasharray="6 4" />
        {/* Cart body */}
        <polygon points={pointsString(cartCorners)} fill="#1c315e" stroke="rgba(12,26,60,0.3)" strokeWidth="1.5" />
        <path d={`M ${cartCorners[0].x + 10} ${cartCorners[0].y - 2} L ${cartCorners[1].x - 4} ${cartCorners[1].y - 2} L ${basket.x + 12} ${basket.y - 9}`}
          fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
        {/* Wheels */}
        <circle cx={leftWheel.x} cy={leftWheel.y + 2} r={wheelRadius} fill="#24334f" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
        <circle cx={rightWheel.x} cy={rightWheel.y + 2} r={wheelRadius} fill="#24334f" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
        <line x1={leftWheel.x - 5} y1={leftWheel.y + 2} x2={leftWheel.x + 5} y2={leftWheel.y + 2} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1={rightWheel.x - 5} y1={rightWheel.y + 2} x2={rightWheel.x + 5} y2={rightWheel.y + 2} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        {/* Basket opening */}
        <path d={`M ${basket.x - 14} ${basket.y} L ${basket.x} ${basket.y - 5} L ${basket.x + 14} ${basket.y}`}
          fill="none" stroke="rgba(244,214,107,0.9)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Ball */}
        <circle cx={ballScreen.x} cy={ballScreen.y} r={7} fill="var(--nd-gold)" stroke="rgba(12,26,60,0.3)" strokeWidth="1.5" />
        {/* Outcome badge */}
        <rect x="218" y="14" width="128" height="22" rx="11" fill={`${resultColor}22`} stroke={`${resultColor}88`} strokeWidth="1.5" />
        <text x="282" y="29" textAnchor="middle" fontSize="10" fontWeight="700" fill={resultColor}>{result}</text>
        {/* Title */}
        <text x="26" y="26" fontSize="12" fontWeight="700" fill="var(--nd-text)">Ballistic cart</text>
        <text x="26" y="41" fontSize="10" fill="rgba(12,26,60,0.55)">The ball returns only when along-track motion stays matched during flight.</text>
      </Scene>
    ),
  }
}

// ─── Projectile motion ─────────────────────────────────────────────────────

function projectileMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const speed = values.speed
  const angle = toRadians(values.angle)
  const gravity = values.gravity
  const flight = (2 * speed * Math.sin(angle)) / gravity
  const range = (speed * speed * Math.sin(2 * angle)) / gravity
  const peakHeight = (speed * speed * Math.sin(angle) ** 2) / (2 * gravity)
  const cycle = flight + 1.2
  const stageTime = Math.min(time % cycle, flight)
  const pointAt = (t: number) => ({ x: speed * Math.cos(angle) * t, y: speed * Math.sin(angle) * t - 0.5 * gravity * t * t })
  const position = pointAt(stageTime)
  const scale = Math.min(255 / Math.max(range, 2), 120 / Math.max(peakHeight, 1.6))
  const origin = vec(44, 196)
  const toScreen = (point: { x: number; y: number }) => vec(origin.x + point.x * scale, origin.y - point.y * scale)
  const trailPath = pathFromSampler(28, ratio => toScreen(pointAt(flight * ratio)))
  const projectile = toScreen(position)
  const landing = toScreen({ x: range, y: 0 })
  const peak = toScreen({ x: range / 2, y: peakHeight })
  const vx = speed * Math.cos(angle)
  const vy = speed * Math.sin(angle) - gravity * stageTime
  const vLen = Math.sqrt(vx * vx + vy * vy)
  const vScale = Math.min(40, 32 / Math.max(vLen, 0.1))

  return {
    lines: [
      ['Flight Time', `${formatNumber(flight)} s`],
      ['Range', `${formatNumber(range)} m`],
      ['Peak Height', `${formatNumber(peakHeight)} m`],
    ],
    viz: (
      <Scene caption="vx stays constant throughout the flight; vy decreases due to gravity. The combination traces a parabola.">
        {/* Sky */}
        <rect x="0" y="0" width="360" height="240" fill="#edf5fb" />
        <rect x="0" y="0" width="360" height="100" fill="rgba(178,214,240,0.18)" />
        {/* Ground */}
        <rect x="0" y="196" width="360" height="44" fill="#d6e2c5" />
        <line x1="26" y1="196" x2="336" y2="196" stroke="rgba(12,26,60,0.22)" strokeWidth="2.5" />
        {/* Grass tufts */}
        {[40, 90, 150, 220, 290, 340].map(x => (
          <path key={x} d={`M ${x} 196 Q ${x - 4} 190 ${x - 7} 196 M ${x} 196 Q ${x} 188 ${x + 3} 196`}
            fill="none" stroke="rgba(80,130,60,0.4)" strokeWidth="1.5" />
        ))}
        {/* Peak height dashed line */}
        <line x1={origin.x} y1={peak.y} x2={landing.x} y2={peak.y}
          stroke="rgba(12,26,60,0.12)" strokeDasharray="5 4" />
        <text x={peak.x + 6} y={peak.y - 5} fontSize="9" fill="rgba(12,26,60,0.5)">
          h = {formatNumber(peakHeight, 1)} m
        </text>
        {/* Vertical height arrow */}
        <Arrow x1={peak.x - 18} y1={196} x2={peak.x - 18} y2={peak.y + 4}
          color="rgba(12,26,60,0.35)" width={1.8} />
        {/* Trajectory */}
        <path d={trailPath} fill="none" stroke="rgba(201,151,0,0.5)" strokeWidth="3" />
        {/* Range annotation */}
        <HorzMeasure x1={origin.x} x2={landing.x} y={216} label={`R = ${formatNumber(range, 1)} m`} />
        {/* Cannon */}
        <rect x="28" y="172" width="18" height="24" rx="4" fill="#1c315e" />
        <rect x="22" y="188" width="28" height="8" rx="4" fill="#243d6e" />
        <line x1="37" y1="172" x2={37 + Math.cos(angle) * 30} y2={172 - Math.sin(angle) * 30}
          stroke="#1c315e" strokeWidth="6" strokeLinecap="round" />
        <circle cx="35" cy="186" r="5" fill="#3b5c8e" />
        {/* Projectile */}
        <circle cx={projectile.x} cy={projectile.y} r="8" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.3)" strokeWidth="1.5" />
        {/* Velocity vector components */}
        <Arrow x1={projectile.x} y1={projectile.y}
          x2={projectile.x + vx * vScale} y2={projectile.y}
          color="rgba(53,83,142,0.7)" width={2} />
        <Arrow x1={projectile.x} y1={projectile.y}
          x2={projectile.x} y2={projectile.y - vy * vScale}
          color="rgba(201,151,0,0.7)" width={2} />
        {/* Landing marker */}
        <path d={`M ${landing.x - 10} 196 L ${landing.x} 184 L ${landing.x + 10} 196`}
          fill="none" stroke="rgba(12,26,60,0.35)" strokeWidth="2" />
        {/* Legend */}
        <line x1="244" y1="220" x2="258" y2="220" stroke="rgba(53,83,142,0.7)" strokeWidth="2" />
        <text x="261" y="224" fontSize="9" fill="rgba(53,83,142,0.9)">vx (constant)</text>
        <line x1="244" y1="232" x2="258" y2="232" stroke="rgba(201,151,0,0.7)" strokeWidth="2" />
        <text x="261" y="236" fontSize="9" fill="rgba(170,120,0,0.9)">vy (gravity)</text>
        {/* Title */}
        <text x="26" y="24" fontSize="12" fontWeight="700" fill="var(--nd-text)">Projectile motion</text>
        <text x="26" y="39" fontSize="10" fill="rgba(12,26,60,0.55)">
          Horizontal speed is constant; vertical speed changes due to gravity.
        </text>
      </Scene>
    ),
  }
}

// ─── Pendulum ──────────────────────────────────────────────────────────────

function pendulumMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const length = values.length
  const releaseAngle = toRadians(values.angle)
  const gravity = values.gravity
  const period = 2 * Math.PI * Math.sqrt(length / gravity)
  const angularFrequency = (2 * Math.PI) / period
  const angleNow = releaseAngle * Math.cos(angularFrequency * time)
  const angularSpeed = Math.abs(releaseAngle * angularFrequency * Math.sin(angularFrequency * time))
  const maxPE = 0.5 * (length ** 2) * releaseAngle ** 2  // proportional
  const currentPE = 0.5 * (length ** 2) * angleNow ** 2
  const currentKE = maxPE - currentPE
  const keRatio = maxPE > 0 ? currentKE / maxPE : 0
  const peRatio = maxPE > 0 ? currentPE / maxPE : 0

  const rodPx = 116
  const pivot = vec(172, 32)
  const bob = vec(pivot.x + Math.sin(angleNow) * rodPx, pivot.y + Math.cos(angleNow) * rodPx)
  const arcPath = pathFromSampler(22, ratio => {
    const theta = -releaseAngle + ratio * releaseAngle * 2
    return vec(pivot.x + Math.sin(theta) * rodPx, pivot.y + Math.cos(theta) * rodPx)
  })
  // Velocity arrow on bob (tangent direction)
  const vScale = 28 * angularSpeed / Math.max(releaseAngle * angularFrequency, 0.01)
  const vx = -Math.cos(angleNow) * vScale * Math.sign(Math.sin(angularFrequency * time))
  const vy = Math.sin(angleNow) * vScale * Math.sign(Math.sin(angularFrequency * time))

  return {
    lines: [
      ['Period', `${formatNumber(period)} s`],
      ['Speed at Bottom', `${formatNumber(Math.abs(releaseAngle * angularFrequency * length))} m/s`],
      ['Release Angle', `${formatNumber(values.angle, 0)}°`],
    ],
    viz: (
      <Scene caption="At the bottom of the swing all energy is kinetic; at the release point all energy is potential. The bars show this exchange in real time.">
        {/* Background */}
        <rect x="0" y="0" width="360" height="240" fill="#eff4f7" />
        <rect x="0" y="188" width="360" height="52" fill="#e3dacb" />
        {/* Ceiling */}
        <rect x="140" y="0" width="64" height="14" rx="3" fill="#c8cdd8" />
        <rect x="156" y="14" width="32" height="6" rx="3" fill="#8f9eb8" />
        {[148, 164, 180, 196].map(x => (
          <line key={x} x1={x} y1="0" x2={x} y2="14" stroke="rgba(12,26,60,0.18)" strokeWidth="2" />
        ))}
        {/* Arc guide */}
        <path d={arcPath} fill="none" stroke="rgba(12,26,60,0.14)" strokeWidth="2" strokeDasharray="5 4" />
        {/* Vertical equilibrium line */}
        <line x1={pivot.x} y1={pivot.y} x2={pivot.x} y2={pivot.y + rodPx + 10}
          stroke="rgba(12,26,60,0.1)" strokeWidth="1.5" strokeDasharray="4 4" />
        {/* Rod */}
        <line x1={pivot.x} y1={pivot.y} x2={bob.x} y2={bob.y} stroke="#1c315e" strokeWidth="4" strokeLinecap="round" />
        {/* Pivot */}
        <circle cx={pivot.x} cy={pivot.y} r="8" fill="#1c315e" />
        <circle cx={pivot.x} cy={pivot.y} r="4" fill="#8f9eb8" />
        {/* Bob */}
        <circle cx={bob.x} cy={bob.y} r="19" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.3)" strokeWidth="2.5" />
        <circle cx={bob.x - 5} cy={bob.y - 5} r="5" fill="rgba(255,255,255,0.35)" />
        {/* Velocity arrow */}
        {vScale > 2 && (
          <Arrow x1={bob.x} y1={bob.y} x2={bob.x + vx} y2={bob.y + vy}
            color="rgba(12,26,60,0.6)" width={2.5} />
        )}
        {/* Energy bars (right side) */}
        <EnergyBars x={310} y={68} keRatio={keRatio} peRatio={peRatio} />
        {/* Period label */}
        <rect x="230" y="158" width="100" height="22" rx="11" fill="rgba(255,255,255,0.82)" stroke="rgba(12,26,60,0.08)" strokeWidth="1" />
        <text x="280" y="173" textAnchor="middle" fontSize="10" fill="var(--nd-text)" fontWeight="600">
          T = {formatNumber(period, 2)} s
        </text>
        {/* Title */}
        <text x="24" y="25" fontSize="12" fontWeight="700" fill="var(--nd-text)">Simple pendulum</text>
        <text x="24" y="40" fontSize="10" fill="rgba(12,26,60,0.55)">Longer string → slower swing. Energy converts between KE and PE.</text>
      </Scene>
    ),
  }
}

// ─── Mass-spring oscillator ────────────────────────────────────────────────

function harmonicMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const omega = Math.sqrt(values.k / values.mass)
  const period = (2 * Math.PI) / omega
  const displacement = values.amplitude * Math.cos(omega * time)
  const maxKE = 0.5 * values.k * values.amplitude ** 2
  const currentPE = 0.5 * values.k * displacement ** 2
  const currentKE = Math.max(0, maxKE - currentPE)
  const keRatio = maxKE > 0 ? currentKE / maxKE : 0
  const peRatio = maxKE > 0 ? currentPE / maxKE : 0

  // Cart x: equilibrium at x=210, range ±130 px mapped to amplitude range
  const maxDisplacement = values.amplitude
  const cartX = 210 + displacement * (110 / Math.max(maxDisplacement, 0.01))
  const wallX = 38
  const springPath = springCoilPath(wallX + 28, cartX - 24, 120)

  return {
    lines: [
      ['Period', `${formatNumber(period)} s`],
      ['Frequency', `${formatNumber(omega / (2 * Math.PI))} Hz`],
      ['Displacement', `${formatNumber(displacement)} m`],
    ],
    viz: (
      <Scene caption="Coil spring compresses and stretches as the mass oscillates. Energy is all kinetic at the centre and all potential at the extremes.">
        {/* Background */}
        <rect x="0" y="0" width="360" height="240" fill="#eff5fb" />
        <rect x="0" y="172" width="360" height="68" fill="#e3d9c8" />
        {/* Wall */}
        <rect x={wallX - 12} y="60" width="24" height="112" rx="6" fill="#70809d" />
        {[70, 84, 98, 112, 126, 140, 154].map(y => (
          <line key={y} x1={wallX - 12} y1={y} x2={wallX + 4} y2={y + 12} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        ))}
        {/* Track */}
        <rect x="62" y="150" width="264" height="10" rx="5" fill="rgba(12,26,60,0.12)" />
        <rect x="62" y="152" width="264" height="3" rx="1" fill="rgba(255,255,255,0.5)" />
        {/* Equilibrium line */}
        <line x1="210" y1="80" x2="210" y2="162" stroke="rgba(12,26,60,0.14)" strokeDasharray="5 4" strokeWidth="1.5" />
        <text x="210" y="76" textAnchor="middle" fontSize="8" fill="rgba(12,26,60,0.4)">eq.</text>
        {/* Spring attachment point */}
        <line x1={wallX + 12} y1="120" x2={wallX + 28} y2="120" stroke="#1c315e" strokeWidth="4" strokeLinecap="round" />
        {/* Coil spring */}
        <path d={springPath} fill="none" stroke="#1c315e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Cart */}
        <rect x={cartX - 26} y="94" width="54" height="56" rx="12"
          fill="var(--nd-gold)" stroke="rgba(12,26,60,0.28)" strokeWidth="2.5" />
        {/* Cart surface sheen */}
        <rect x={cartX - 20} y="97" width="24" height="6" rx="3" fill="rgba(255,255,255,0.4)" />
        {/* Cart label: m */}
        <text x={cartX + 1} y="127" textAnchor="middle" fontSize="14" fontWeight="700" fill="rgba(12,26,60,0.55)">m</text>
        {/* Cart wheels */}
        {[cartX - 16, cartX + 16].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy="155" r="9" fill="#24334f" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
            <circle cx={cx} cy="155" r="3.5" fill="rgba(255,255,255,0.35)" />
          </g>
        ))}
        {/* Displacement arrow */}
        {Math.abs(displacement) > 0.02 && (
          <Arrow x1={210} y1={82} x2={cartX} y2={82} color="rgba(201,151,0,0.7)" width={2} />
        )}
        {Math.abs(displacement) > 0.02 && (
          <text x={(210 + cartX) / 2} y={78} textAnchor="middle" fontSize={8} fill="rgba(170,120,0,0.85)">
            x = {formatNumber(Math.abs(displacement), 2)} m
          </text>
        )}
        {/* Energy bars */}
        <EnergyBars x={306} y={68} keRatio={keRatio} peRatio={peRatio} />
        {/* Title */}
        <text x="26" y="25" fontSize="12" fontWeight="700" fill="var(--nd-text)">Mass-spring oscillator</text>
        <text x="26" y="40" fontSize="10" fill="rgba(12,26,60,0.55)">Stiffer spring → faster oscillation. More mass → slower.</text>
      </Scene>
    ),
  }
}

// ─── Angular momentum (conservation) ──────────────────────────────────────

function angularMomentumMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const radius = values.collapsedRadius + ((values.radius - values.collapsedRadius) * (Math.cos(time * 0.9) + 1)) / 2
  const omega = values.omega * (values.radius / radius) ** 2
  const rotation = time * omega
  const armLength = 32 + radius * 42
  const center = vec(166, 124)
  const leftMass = vec(center.x + Math.cos(rotation) * armLength, center.y + Math.sin(rotation) * armLength)
  const rightMass = vec(center.x - Math.cos(rotation) * armLength, center.y - Math.sin(rotation) * armLength)
  const omegaFinal = values.omega * (values.radius / values.collapsedRadius) ** 2
  const omegaDisplay = formatNumber(omega, 1)

  return {
    lines: [
      ['Instantaneous ω', `${omegaDisplay} rad/s`],
      ['Final ω (collapsed)', `${formatNumber(omegaFinal, 1)} rad/s`],
      ['Moment Ratio', `${formatNumber((values.radius / values.collapsedRadius) ** 2)}×`],
    ],
    viz: (
      <Scene caption="Top-down view. Pulling the masses inward reduces the moment of inertia — angular speed must increase to conserve L = Iω.">
        <rect x="0" y="0" width="360" height="240" fill="#eef4fa" />
        {/* Outer reference circle */}
        <circle cx={center.x} cy={center.y} r={32 + values.radius * 42}
          fill="rgba(28,49,94,0.04)" stroke="rgba(12,26,60,0.1)" strokeWidth="1.5" strokeDasharray="5 4" />
        {/* Inner (collapsed) reference circle */}
        <circle cx={center.x} cy={center.y} r={32 + values.collapsedRadius * 42}
          fill="none" stroke="rgba(201,151,0,0.2)" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x={center.x + 32 + values.collapsedRadius * 42 + 4} y={center.y + 4}
          fontSize="9" fill="rgba(201,151,0,0.7)">r_min</text>
        {/* Velocity arc arrow */}
        <path d={`M ${center.x + armLength * 0.72} ${center.y - armLength * 0.72}
                   A ${armLength * 0.92} ${armLength * 0.92} 0 0 1 ${center.x + armLength} ${center.y - 6}`}
          fill="none" stroke="rgba(201,151,0,0.45)" strokeWidth="2.5" />
        <polygon
          points={`${center.x + armLength},${center.y - 6} ${center.x + armLength - 8},${center.y + 4} ${center.x + armLength + 6},${center.y + 2}`}
          fill="rgba(201,151,0,0.45)" />
        {/* Arms */}
        <line x1={center.x} y1={center.y} x2={leftMass.x} y2={leftMass.y}
          stroke="#1c315e" strokeWidth="7" strokeLinecap="round" />
        <line x1={center.x} y1={center.y} x2={rightMass.x} y2={rightMass.y}
          stroke="#1c315e" strokeWidth="7" strokeLinecap="round" />
        {/* Hub */}
        <circle cx={center.x} cy={center.y} r="20" fill="#243966" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <circle cx={center.x} cy={center.y} r="8" fill="#8f9eb8" />
        {/* Masses */}
        {[leftMass, rightMass].map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r="16" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.3)" strokeWidth="2.5" />
            <circle cx={m.x - 4} cy={m.y - 4} r="4" fill="rgba(255,255,255,0.3)" />
          </g>
        ))}
        {/* Live ω readout */}
        <rect x="244" y="16" width="102" height="42" rx="10" fill="rgba(255,255,255,0.88)" stroke="rgba(12,26,60,0.08)" strokeWidth="1" />
        <text x="295" y="33" textAnchor="middle" fontSize="9" fill="rgba(12,26,60,0.45)">angular speed</text>
        <text x="295" y="51" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--nd-text)">{omegaDisplay} rad/s</text>
        {/* L conservation note */}
        <text x="244" y="75" fontSize="9" fill="rgba(12,26,60,0.5)">L = Iω = constant</text>
        {/* Title */}
        <text x="24" y="24" fontSize="12" fontWeight="700" fill="var(--nd-text)">Angular momentum</text>
        <text x="24" y="39" fontSize="10" fill="rgba(12,26,60,0.55)">Arms pull inward → spin speeds up to conserve L.</text>
      </Scene>
    ),
  }
}

// ─── Traveling wave ────────────────────────────────────────────────────────

function waveMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const speed = values.frequency * values.wavelength
  const phase = time * values.frequency * 2 * Math.PI
  const amplitudePx = clamp(values.amplitude * 52, 8, 80)
  const wavelengthPx = clamp(values.wavelength * 44, 24, 200)
  const ropeStartX = 58, ropeEndX = 342, ropeCY = 130
  const ropePath = pathFromSampler(90, ratio => {
    const x = ropeStartX + ratio * (ropeEndX - ropeStartX)
    const y = ropeCY + Math.sin((x / wavelengthPx) * 2 * Math.PI - phase) * amplitudePx
    return vec(x, y)
  })
  // Find first crest position for wavelength annotation
  const crestPhase = (phase % (2 * Math.PI)) / (2 * Math.PI)
  const crestX1 = ropeStartX + (1 - crestPhase) * wavelengthPx
  const crestX2 = crestX1 + wavelengthPx

  return {
    lines: [
      ['Wave Speed', `${formatNumber(speed)} m/s`],
      ['Period', `${formatNumber(1 / values.frequency)} s`],
      ['Amplitude', `${formatNumber(values.amplitude)} m`],
    ],
    viz: (
      <Scene caption="Wave speed = frequency × wavelength (v = fλ). A higher frequency with the same wavelength means a faster wave.">
        <rect x="0" y="0" width="360" height="240" fill="#eef5fb" />
        {/* Equilibrium line */}
        <line x1={ropeStartX} y1={ropeCY} x2={ropeEndX} y2={ropeCY}
          stroke="rgba(12,26,60,0.1)" strokeDasharray="4 4" strokeWidth="1.5" />
        {/* Driver / source */}
        <rect x="26" y="92" width="22" height="76" rx="8" fill="#657792" />
        <rect x="28" y="126" width="18" height="4" rx="2" fill="rgba(255,255,255,0.5)" />
        <line x1="48" y1={ropeCY} x2={ropeStartX} y2={ropeCY} stroke="#1c315e" strokeWidth="4" strokeLinecap="round" />
        {/* Rope */}
        <path d={ropePath} fill="none" stroke="#1c315e" strokeWidth="4" strokeLinecap="round" />
        {/* Amplitude annotation (vertical double-arrow at left side) */}
        <line x1="48" y1={ropeCY - amplitudePx} x2="48" y2={ropeCY + amplitudePx}
          stroke="rgba(201,151,0,0.7)" strokeWidth="2" />
        <line x1="44" y1={ropeCY - amplitudePx} x2="52" y2={ropeCY - amplitudePx}
          stroke="rgba(201,151,0,0.7)" strokeWidth="2" />
        <line x1="44" y1={ropeCY + amplitudePx} x2="52" y2={ropeCY + amplitudePx}
          stroke="rgba(201,151,0,0.7)" strokeWidth="2" />
        <text x="54" y={ropeCY - amplitudePx + 4} fontSize="9" fill="rgba(201,151,0,0.85)">A</text>
        {/* Wavelength annotation (horizontal) between crests if visible */}
        {crestX1 > ropeStartX && crestX2 < ropeEndX && (
          <HorzMeasure x1={crestX1} x2={crestX2} y={ropeCY - amplitudePx - 14}
            label={`λ = ${formatNumber(values.wavelength, 1)} m`} />
        )}
        {/* Wave direction arrow */}
        <Arrow x1={ropeEndX - 32} y1={ropeCY - amplitudePx - 24}
          x2={ropeEndX - 6} y2={ropeCY - amplitudePx - 24}
          color="rgba(53,83,142,0.6)" width={2} />
        <text x={ropeEndX - 56} y={ropeCY - amplitudePx - 28} fontSize="9" fill="rgba(53,83,142,0.7)">propagation</text>
        {/* Wall anchor */}
        <rect x={ropeEndX} y="100" width="12" height="60" rx="4" fill="#8f9eb8" />
        {/* Wave speed badge */}
        <rect x="196" y="200" width="132" height="22" rx="11" fill="rgba(255,255,255,0.88)" stroke="rgba(12,26,60,0.08)" strokeWidth="1" />
        <text x="262" y="215" textAnchor="middle" fontSize="10" fill="var(--nd-text)" fontWeight="600">
          v = {formatNumber(speed, 1)} m/s
        </text>
        {/* Title */}
        <text x="24" y="24" fontSize="12" fontWeight="700" fill="var(--nd-text)">Traveling wave</text>
        <text x="24" y="39" fontSize="10" fill="rgba(12,26,60,0.55)">v = fλ — frequency sets pacing, wavelength sets spacing.</text>
      </Scene>
    ),
  }
}

// ─── Optics: interference / diffraction ────────────────────────────────────

function wavelengthColor(wavelength: number) {
  const hue = clamp(260 - (wavelength - 380) * 0.58, 10, 260)
  return `hsl(${hue}, 88%, 52%)`
}

function opticsMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const fringeSpacing = (values.wavelength * 1e-9 * values.distance) / (values.spacing * 1e-3)
  const glow = wavelengthColor(values.wavelength)
  const fringePixels = clamp(fringeSpacing * 9000, 8, 38)
  const shimmer = 0.85 + 0.15 * Math.sin(time * 3.5)
  const screenX = 295

  return {
    lines: [
      ['Fringe Spacing', `${formatNumber(fringeSpacing * 1000, 3)} mm`],
      ['Wavelength', `${formatNumber(values.wavelength, 0)} nm`],
      ['Screen Distance', `${formatNumber(values.distance)} m`],
    ],
    viz: (
      <Scene caption="Young's double-slit: bright fringes appear where path length differs by a whole number of wavelengths. Δy = λL/d.">
        {/* Dark room background */}
        <rect x="0" y="0" width="360" height="240" fill="#1a2438" />
        <rect x="0" y="0" width="360" height="240" fill="rgba(255,255,255,0.04)" />
        {/* Laser source */}
        <rect x="16" y="108" width="32" height="24" rx="5" fill="#243966" stroke={glow} strokeWidth="1.5" />
        <rect x="24" y="113" width="16" height="14" rx="3" fill={glow} opacity="0.3" />
        <text x="32" y="144" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">laser</text>
        {/* Beam from laser to slit barrier */}
        <line x1="48" y1="120" x2="118" y2="120" stroke={glow} strokeWidth="3" opacity={0.55} />
        {/* Slit barrier */}
        <rect x="118" y="56" width="12" height="128" rx="3" fill="#384d6b" />
        {/* Slits (cut-outs as lighter rectangles) */}
        <rect x="120" y="80" width="4" height="18" rx="2" fill="#1a2438" stroke={glow} strokeWidth="0.5" opacity={0.6} />
        <rect x="120" y="122" width="4" height="18" rx="2" fill="#1a2438" stroke={glow} strokeWidth="0.5" opacity={0.6} />
        {/* Beams from slits to screen (fan out) */}
        {[-3, -1, 0, 1, 3].map((n, i) => {
          const targetY = 120 + n * fringePixels * 1.2
          const opacity = 0.08 + (i === 2 ? 0.12 : 0.06)
          return (
            <path key={i}
              d={`M 122 89 L ${screenX} ${targetY} M 122 131 L ${screenX} ${targetY}`}
              fill="none" stroke={glow} strokeWidth="1.2" opacity={opacity * shimmer} />
          )
        })}
        {/* Screen */}
        <rect x={screenX} y="44" width="14" height="152" rx="5" fill="#2c3e58" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        {/* Interference fringes on screen */}
        {Array.from({ length: 13 }, (_, i) => {
          const n = i - 6
          const y = 120 + n * fringePixels
          if (y < 48 || y > 190) return null
          const intensity = Math.max(0.05, Math.cos(n * Math.PI / 3.5) ** 2) * shimmer
          return (
            <rect key={i} x={screenX + 2} y={y - fringePixels * 0.42} width="9"
              height={fringePixels * 0.84} rx="2"
              fill={glow} opacity={intensity} />
          )
        })}
        {/* Central bright fringe label */}
        <line x1={screenX + 16} y1="120" x2={screenX + 32} y2="120" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <text x={screenX + 34} y="124" fontSize="8" fill="rgba(255,255,255,0.5)">m=0</text>
        {/* Fringe spacing annotation */}
        {fringePixels > 10 && (
          <>
            <line x1={screenX + 16} y1="120" x2={screenX + 16} y2={120 + fringePixels}
              stroke="rgba(201,151,0,0.6)" strokeWidth="1.5" />
            <line x1={screenX + 13} y1="120" x2={screenX + 19} y2="120" stroke="rgba(201,151,0,0.6)" strokeWidth="1.5" />
            <line x1={screenX + 13} y1={120 + fringePixels} x2={screenX + 19} y2={120 + fringePixels} stroke="rgba(201,151,0,0.6)" strokeWidth="1.5" />
            <text x={screenX + 22} y={120 + fringePixels * 0.5 + 4} fontSize="8" fill="rgba(201,151,0,0.75)">Δy</text>
          </>
        )}
        {/* Title */}
        <text x="24" y="24" fontSize="12" fontWeight="700" fill="rgba(255,255,255,0.85)">Double-slit interference</text>
        <text x="24" y="39" fontSize="10" fill="rgba(255,255,255,0.4)">Longer λ or farther screen → wider fringe spacing.</text>
      </Scene>
    ),
  }
}

// ─── RC circuit ────────────────────────────────────────────────────────────

function pointOnCircuitPath(progress: number) {
  const xL = 58, xR = 230, yT = 80, yB = 162
  const w = xR - xL, h = yB - yT
  const perim = w * 2 + h * 2
  let d = (progress % 1) * perim
  if (d < w) return vec(xL + d, yT)
  d -= w
  if (d < h) return vec(xR, yT + d)
  d -= h
  if (d < w) return vec(xR - d, yB)
  d -= w
  return vec(xL, yB - d)
}

function circuitMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const current = values.voltage / values.resistance
  const tau = values.resistance * (values.capacitance / 1_000_000)
  const cycle = Math.max(tau * 5.5, 0.6)
  const stageTime = time % cycle
  const chargeFraction = 1 - Math.exp(-stageTime / Math.max(tau, 0.03))

  // Mini charging curve coordinates
  const graphX = 248, graphY = 64, graphW = 94, graphH = 60
  const tauX = graphX + clamp((tau / cycle) * graphW, 4, graphW - 4)

  return {
    lines: [
      ['Steady-State Current', `${formatNumber(current, 3)} A`],
      ['Time Constant τ', `${formatNumber(tau, 3)} s`],
      ['Capacitor Charge', `${formatNumber((values.capacitance / 1e6) * values.voltage * chargeFraction, 5)} C`],
    ],
    viz: (
      <Scene caption="The capacitor charges exponentially: ~63% charged after one time constant τ = RC. Current falls as charge builds.">
        <rect x="0" y="0" width="360" height="240" fill="#eff5fb" />
        {/* Circuit wires */}
        <path d="M 58 80 H 110 M 58 80 V 162 H 230 V 80 H 190" fill="none" stroke="#1c315e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Battery circle */}
        <circle cx="75" cy="121" r="22" fill="rgba(201,151,0,0.12)" stroke="var(--nd-gold)" strokeWidth="2.5" />
        <line x1="68" y1="110" x2="82" y2="110" stroke="#1c315e" strokeWidth="2.2" />
        <line x1="75" y1="103" x2="75" y2="117" stroke="#1c315e" strokeWidth="2.2" />
        <line x1="68" y1="132" x2="82" y2="132" stroke="#1c315e" strokeWidth="2.2" />
        <text x="75" y="152" textAnchor="middle" fontSize="8" fill="rgba(12,26,60,0.45)">
          {formatNumber(values.voltage, 0)}V
        </text>
        {/* Resistor zigzag */}
        <path d="M 110 80 L 116 70 L 122 90 L 128 70 L 134 90 L 140 70 L 146 90 L 152 70 L 158 80 L 190 80"
          fill="none" stroke="#1c315e" strokeWidth="3.5" strokeLinecap="round" />
        <text x="150" y="66" textAnchor="middle" fontSize="8" fill="rgba(12,26,60,0.45)">
          {values.resistance}Ω
        </text>
        {/* Capacitor plates */}
        <line x1="200" y1="100" x2="200" y2="142" stroke="#1c315e" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="230" y1="100" x2="230" y2="142" stroke="#1c315e" strokeWidth="3.5" strokeLinecap="round" />
        {/* Charge fill between plates */}
        <rect x="203" y={142 - chargeFraction * 42} width="24" height={chargeFraction * 42} rx="2"
          fill="rgba(201,151,0,0.65)" />
        <text x="215" y="156" textAnchor="middle" fontSize="8" fill="rgba(12,26,60,0.45)">
          {values.capacitance}µF
        </text>
        {/* Charge level label */}
        <text x="237" y={142 - chargeFraction * 42 + 4} fontSize="8" fill="rgba(201,151,0,0.8)">
          {formatNumber(chargeFraction * 100, 0)}%
        </text>
        {/* Moving charge dots */}
        {Array.from({ length: 7 }, (_, i) => {
          const pt = pointOnCircuitPath((time * 0.13 + i * 0.14) % 1)
          return <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="rgba(53,83,142,0.7)" />
        })}
        {/* V(t) charging curve graph */}
        <rect x={graphX - 4} y={graphY - 4} width={graphW + 10} height={graphH + 16} rx="8"
          fill="rgba(255,255,255,0.82)" stroke="rgba(12,26,60,0.1)" strokeWidth="1" />
        <line x1={graphX} y1={graphY + graphH} x2={graphX + graphW} y2={graphY + graphH}
          stroke="rgba(12,26,60,0.25)" strokeWidth="1.5" />
        <line x1={graphX} y1={graphY} x2={graphX} y2={graphY + graphH}
          stroke="rgba(12,26,60,0.25)" strokeWidth="1.5" />
        <path d={pathFromSampler(40, r => {
          const q = 1 - Math.exp(-r * 5)
          return vec(graphX + r * graphW, graphY + graphH - q * graphH)
        })} fill="none" stroke="rgba(201,151,0,0.7)" strokeWidth="2" />
        {/* Current time marker on curve */}
        <line x1={tauX} y1={graphY} x2={tauX} y2={graphY + graphH}
          stroke="rgba(53,83,142,0.4)" strokeDasharray="3 2" strokeWidth="1.5" />
        <text x={tauX + 2} y={graphY + 8} fontSize="7" fill="rgba(53,83,142,0.6)">τ</text>
        <text x={graphX + graphW * 0.35} y={graphY - 3} fontSize="8" fill="rgba(12,26,60,0.5)">V(t) on capacitor</text>
        {/* Title */}
        <text x="24" y="25" fontSize="12" fontWeight="700" fill="var(--nd-text)">RC circuit charging</text>
        <text x="24" y="40" fontSize="10" fill="rgba(12,26,60,0.55)">τ = RC sets how fast the capacitor reaches full voltage.</text>
      </Scene>
    ),
  }
}

// ─── Electric / magnetic field interaction ─────────────────────────────────

function fieldMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const fieldStrength = (values.sourceA * values.sourceB) / (values.distance * values.distance)
  const left = vec(96, 124)
  const right = vec(96 + values.distance * 40, 124)
  const pulse = 0.82 + 0.18 * Math.sin(time * 2.6)
  const mid = vec((left.x + right.x) / 2, 124)

  return {
    lines: [
      ['Force Scale', `${formatNumber(fieldStrength)}`],
      ['Separation', `${formatNumber(values.distance)} m`],
      ['Inverse-Square Term', `1/r² = ${formatNumber(1 / (values.distance * values.distance))}`],
    ],
    viz: (
      <Scene caption="Field lines curve between unlike charges; like charges repel. Force scales as 1/r² — halving the distance quadruples the interaction.">
        <rect x="0" y="0" width="360" height="240" fill="#eff4fb" />
        {/* Curved field lines with arrowheads */}
        {[-40, -22, 0, 22, 40].map((offset, i) => {
          const yL = left.y + offset, yR = right.y + offset
          const cx1 = left.x + 58, cy1 = left.y + offset * 0.35
          const cx2 = right.x - 58, cy2 = right.y + offset * 0.35
          const midT = 0.5
          const midX = (1 - midT) ** 3 * left.x + 3 * (1 - midT) ** 2 * midT * cx1 + 3 * (1 - midT) * midT ** 2 * cx2 + midT ** 3 * right.x
          const midY = (1 - midT) ** 3 * yL + 3 * (1 - midT) ** 2 * midT * cy1 + 3 * (1 - midT) * midT ** 2 * cy2 + midT ** 3 * yR
          const dx = midX - ((1 - 0.45) ** 3 * left.x + 3 * (1 - 0.45) ** 2 * 0.45 * cx1 + 3 * (1 - 0.45) * 0.45 ** 2 * cx2 + 0.45 ** 3 * right.x)
          const dy = midY - ((1 - 0.45) ** 3 * yL + 3 * (1 - 0.45) ** 2 * 0.45 * cy1 + 3 * (1 - 0.45) * 0.45 ** 2 * cy2 + 0.45 ** 3 * yR)
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          const ux = dx / len, uy = dy / len
          const sz = 6
          const bx = midX - ux * sz, by = midY - uy * sz
          const perp = sz * 0.4
          const opacity = 0.18 + i * 0.1
          return (
            <g key={i}>
              <path d={`M ${left.x + 18} ${yL} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${right.x - 18} ${yR}`}
                fill="none" stroke={`rgba(53,83,142,${opacity})`} strokeWidth={1.4 + i * 0.2} />
              <polygon
                points={`${midX.toFixed(1)},${midY.toFixed(1)} ${(bx - uy * perp).toFixed(1)},${(by + ux * perp).toFixed(1)} ${(bx + uy * perp).toFixed(1)},${(by - ux * perp).toFixed(1)}`}
                fill={`rgba(53,83,142,${opacity + 0.1})`} />
            </g>
          )
        })}
        {/* Separation dashed line */}
        <line x1={left.x} y1={left.y} x2={right.x} y2={right.y}
          stroke="rgba(12,26,60,0.14)" strokeDasharray="5 4" />
        {/* Distance annotation */}
        <HorzMeasure x1={left.x} x2={right.x} y={152} label={`r = ${formatNumber(values.distance, 1)} m`} />
        {/* Interaction glow at midpoint */}
        <circle cx={mid.x} cy={mid.y} r={16 + fieldStrength * 0.4}
          fill={`rgba(201,151,0,${0.06 * pulse})`} stroke={`rgba(201,151,0,${0.28 * pulse})`} strokeDasharray="5 4" />
        {/* Charge A (positive) */}
        <circle cx={left.x} cy={left.y} r={13 + values.sourceA * 1.8}
          fill="rgba(220,70,70,0.88)" stroke="rgba(180,40,40,0.6)" strokeWidth="2" />
        <line x1={left.x - 7} y1={left.y} x2={left.x + 7} y2={left.y} stroke="white" strokeWidth="2.5" />
        <line x1={left.x} y1={left.y - 7} x2={left.x} y2={left.y + 7} stroke="white" strokeWidth="2.5" />
        <text x={left.x} y={left.y + 28 + values.sourceA * 1.8} textAnchor="middle" fontSize="9" fill="rgba(200,60,60,0.9)">+q</text>
        {/* Charge B (negative) */}
        <circle cx={right.x} cy={right.y} r={13 + values.sourceB * 1.8}
          fill="rgba(53,83,142,0.85)" stroke="rgba(28,49,94,0.6)" strokeWidth="2" />
        <line x1={right.x - 7} y1={right.y} x2={right.x + 7} y2={right.y} stroke="white" strokeWidth="2.5" />
        <text x={right.x} y={right.y + 28 + values.sourceB * 1.8} textAnchor="middle" fontSize="9" fill="rgba(53,83,142,0.9)">−q</text>
        {/* Force scale readout */}
        <rect x="262" y="14" width="84" height="36" rx="8" fill="rgba(255,255,255,0.88)" stroke="rgba(12,26,60,0.08)" strokeWidth="1" />
        <text x="304" y="30" textAnchor="middle" fontSize="8" fill="rgba(12,26,60,0.45)">Force ∝ q₁q₂/r²</text>
        <text x="304" y="44" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--nd-text)">{formatNumber(fieldStrength)}</text>
        {/* Title */}
        <text x="24" y="24" fontSize="12" fontWeight="700" fill="var(--nd-text)">Field interaction</text>
        <text x="24" y="39" fontSize="10" fill="rgba(12,26,60,0.55)">Halve the separation → force quadruples (inverse-square law).</text>
      </Scene>
    ),
  }
}

// ─── Fluid flow (Bernoulli / Venturi) ──────────────────────────────────────

function fluidMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const areaM2 = values.area / 10000
  const flowRate = values.velocity * areaM2
  const throatVelocity = flowRate / (areaM2 * 0.38)  // narrowed to ~38%
  const pressureDelta = 0.5 * values.density * (throatVelocity ** 2 - values.velocity ** 2)
  const throatHalfHeight = clamp(values.area * 5.5, 18, 34)
  const inletHalfHeight = 38

  // Manometer heights (pressure → higher fluid column = higher pressure)
  const inletPressure = 0.5 * values.density * values.velocity ** 2
  const throatPressure = Math.max(0, inletPressure + pressureDelta)
  const maxP = Math.max(inletPressure, throatPressure, 1)
  const inletManomH = clamp((inletPressure / maxP) * 32, 4, 32)
  const throatManomH = clamp((throatPressure / maxP) * 32, 4, 32)

  return {
    lines: [
      ['Flow Rate', `${formatNumber(flowRate, 4)} m³/s`],
      ['Throat Speed', `${formatNumber(throatVelocity, 1)} m/s`],
      ['Pressure Drop', `${formatNumber(Math.abs(pressureDelta), 0)} Pa`],
    ],
    viz: (
      <Scene caption="Continuity: fluid speeds up at the constriction (A₁v₁ = A₂v₂). Bernoulli: higher speed means lower pressure.">
        <rect x="0" y="0" width="360" height="240" fill="#eef6fb" />
        {/* Pipe walls */}
        <path d={`M 24 ${120 - inletHalfHeight} H 118 L 176 ${120 - throatHalfHeight} H 242 L 300 ${120 - inletHalfHeight}`}
          fill="none" stroke="#1c315e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M 24 ${120 + inletHalfHeight} H 118 L 176 ${120 + throatHalfHeight} H 242 L 300 ${120 + inletHalfHeight}`}
          fill="none" stroke="#1c315e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        {/* Fluid fill */}
        <clipPath id="pipeClip">
          <path d={`M 24 ${120 - inletHalfHeight} H 118 L 176 ${120 - throatHalfHeight} H 242 L 300 ${120 - inletHalfHeight}
                     L 300 ${120 + inletHalfHeight} H 242 L 176 ${120 + throatHalfHeight} H 118 L 24 ${120 + inletHalfHeight} Z`} />
        </clipPath>
        <rect x="24" y="60" width="276" height="120" fill="rgba(53,140,210,0.14)" clipPath="url(#pipeClip)" />
        {/* Moving particles */}
        {Array.from({ length: 10 }, (_, i) => {
          const phase = (time * (0.45 + values.velocity * 0.05) + i * 0.1) % 1
          const x = 28 + phase * 268
          const inThroat = x > 138 && x < 242
          const speedFactor = inThroat ? 2.6 : 1
          const y = 120 + Math.sin(time * 1.6 + i * 1.1) * (inThroat ? throatHalfHeight * 0.5 : inletHalfHeight * 0.55)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={inThroat ? 4 : 6}
                fill={`rgba(53,140,210,${inThroat ? 0.9 : 0.65})`} />
              {inThroat && (
                <line x1={x - speedFactor * 6} y1={y} x2={x} y2={y}
                  stroke="rgba(53,140,210,0.45)" strokeWidth="2" />
              )}
            </g>
          )
        })}
        {/* Velocity labels */}
        <text x="68" y="108" textAnchor="middle" fontSize="9" fill="rgba(12,26,60,0.55)">
          v₁={formatNumber(values.velocity, 1)}
        </text>
        <text x="193" y={120 - throatHalfHeight - 8} textAnchor="middle" fontSize="9" fill="rgba(12,26,60,0.65)" fontWeight="600">
          v₂={formatNumber(throatVelocity, 1)} m/s
        </text>
        {/* Manometers */}
        {[
          { x: 82, height: inletManomH, label: 'P₁', color: 'rgba(53,140,210,0.7)' },
          { x: 192, height: throatManomH, label: 'P₂', color: 'rgba(201,151,0,0.7)' },
        ].map(({ x, height, label, color }) => (
          <g key={x}>
            <rect x={x - 6} y="56" width="12" height="42" rx="4"
              fill="rgba(255,255,255,0.7)" stroke="rgba(12,26,60,0.18)" strokeWidth="1" />
            <rect x={x - 5} y={98 - height} width="10" height={height} rx="3" fill={color} />
            <text x={x} y="51" textAnchor="middle" fontSize="9" fill={color} fontWeight="600">{label}</text>
          </g>
        ))}
        {/* Low-pressure annotation at throat */}
        <text x="192" y="168" textAnchor="middle" fontSize="8" fill="rgba(201,151,0,0.75)">↓ lower pressure</text>
        {/* Title */}
        <text x="24" y="24" fontSize="12" fontWeight="700" fill="var(--nd-text)">Venturi / Bernoulli flow</text>
        <text x="24" y="39" fontSize="10" fill="rgba(12,26,60,0.55)">Constriction speeds fluid up and drops pressure (P₁ {">"} P₂).</text>
      </Scene>
    ),
  }
}

// ─── Thermodynamics: gas in a cylinder ─────────────────────────────────────

function thermoMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const pressure = (values.moles * 0.082057 * values.temperature) / values.volume
  const energy = 1.5 * values.moles * 8.314 * values.temperature
  const pistonTop = 160 - clamp(values.volume * 4.5, 22, 78)
  const gasHeight = 160 - pistonTop
  // Temperature affects particle speed and color
  const speedFactor = values.temperature / 300
  const hotFraction = clamp((values.temperature - 200) / 500, 0, 1)

  function particleColor(seed: number): string {
    const variation = (seed % 3) / 3
    const hot = hotFraction * 0.8 + variation * 0.2
    const r = Math.round(180 + hot * 60)
    const g = Math.round(140 - hot * 90)
    const b = Math.round(20 + (1 - hot) * 160)
    return `rgb(${r},${g},${b})`
  }

  return {
    lines: [
      ['Pressure', `${formatNumber(pressure)} atm`],
      ['Thermal Energy', `${formatNumber(energy, 0)} J`],
      ['Temperature', `${formatNumber(values.temperature, 0)} K`],
    ],
    viz: (
      <Scene caption="Hotter gas particles (redder) move faster and hit the walls more often, producing higher pressure. The piston position reflects the gas volume.">
        <rect x="0" y="0" width="360" height="240" fill="#f2f5f9" />
        {/* Cylinder walls */}
        <rect x="104" y="44" width="152" height="142" rx="16" fill="rgba(255,255,255,0.7)" stroke="#1c315e" strokeWidth="3" />
        {/* Piston */}
        <rect x="108" y={pistonTop - 2} width="144" height="16" rx="6" fill="#5d7291" />
        <rect x="122" y={pistonTop + 3} width="112" height="6" rx="3" fill="rgba(255,255,255,0.4)" />
        {/* Piston rod */}
        <rect x="172" y="36" width="16" height={pistonTop - 36} rx="4" fill="#8f9eb8" />
        <rect x="160" y="26" width="40" height="14" rx="5" fill="#70809d" />
        {/* Gas fill */}
        <rect x="108" y={pistonTop + 14} width="144" height={gasHeight - 14} rx="4"
          fill={`rgba(${Math.round(220 + hotFraction * 35)},${Math.round(200 - hotFraction * 120)},${Math.round(80 - hotFraction * 60)},0.08)`} />
        {/* Particles colored by temperature */}
        {Array.from({ length: 24 }, (_, i) => {
          const s = speedFactor
          return (
            <circle key={i}
              cx={114 + ((i * 41 + Math.floor(time * s * 12 + i * 3.7)) % 132)}
              cy={pistonTop + 20 + ((i * 31 + Math.floor(time * s * 16 + i * 7.1)) % Math.max(16, gasHeight - 24))}
              r="5"
              fill={particleColor(i)}
              opacity="0.82"
            />
          )
        })}
        {/* Heat source at bottom */}
        <rect x="108" y="182" width="144" height="10" rx="4"
          fill={`rgba(${Math.round(180 + hotFraction * 75)},${Math.round(80 - hotFraction * 60)},${Math.round(20 - hotFraction * 10)},0.85)`} />
        {/* Temperature color legend */}
        <defs>
          <linearGradient id="tempGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(20,80,200)" />
            <stop offset="100%" stopColor="rgb(240,50,20)" />
          </linearGradient>
        </defs>
        <rect x="270" y="80" width="60" height="10" rx="3" fill="url(#tempGrad)" />
        <text x="270" y="76" fontSize="8" fill="rgba(12,26,60,0.45)">cold</text>
        <text x="316" y="76" fontSize="8" fill="rgba(12,26,60,0.45)">hot</text>
        {/* Pressure readout */}
        <rect x="266" y="100" width="72" height="34" rx="8" fill="rgba(255,255,255,0.88)" stroke="rgba(12,26,60,0.08)" strokeWidth="1" />
        <text x="302" y="115" textAnchor="middle" fontSize="8" fill="rgba(12,26,60,0.45)">pressure</text>
        <text x="302" y="128" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--nd-text)">{formatNumber(pressure, 1)} atm</text>
        {/* Volume label */}
        <line x1="98" y1={pistonTop + 14} x2="98" y2="162" stroke="rgba(12,26,60,0.25)" strokeWidth="1.5" />
        <line x1="94" y1={pistonTop + 14} x2="102" y2={pistonTop + 14} stroke="rgba(12,26,60,0.25)" strokeWidth="1.5" />
        <line x1="94" y1="162" x2="102" y2="162" stroke="rgba(12,26,60,0.25)" strokeWidth="1.5" />
        <text x="92" y={(pistonTop + 176) / 2} textAnchor="end" fontSize="8" fill="rgba(12,26,60,0.45)">V</text>
        {/* Title */}
        <text x="24" y="24" fontSize="12" fontWeight="700" fill="var(--nd-text)">Ideal gas in a cylinder</text>
        <text x="24" y="39" fontSize="10" fill="rgba(12,26,60,0.55)">PV = nRT — hotter gas at smaller volume means higher pressure.</text>
      </Scene>
    ),
  }
}

// ─── Van de Graaff (fallback) ───────────────────────────────────────────────

function vanDeGraaffFallbackMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const candleCount = Math.round(values.candles)
  const humidityFactor = 1 - values.humidity / 140
  const effectiveRadius = Math.sqrt(values.voltage) * 1.15 * humidityFactor
  const extinctionDistance = effectiveRadius * 1.6
  const candles = Array.from({ length: candleCount }, (_, i) => {
    const distance = values.spacing + i * 3.2
    const intensity = Math.max(0, 1 - distance / Math.max(extinctionDistance, 1))
    return { distance, extinguished: distance <= extinctionDistance, intensity }
  })
  const extinguished = candles.filter(c => c.extinguished).length
  const pulse = 0.82 + 0.18 * Math.sin(time * 6)

  return {
    lines: [
      ['Est. Extinction Radius', `${formatNumber(extinctionDistance)} cm`],
      ['Candles Extinguished', `${extinguished} / ${candleCount}`],
      ['Humidity Reduction', `${formatNumber((1 - humidityFactor) * 100, 0)} %`],
    ],
    viz: (
      <Scene caption="Electric wind from the Van de Graaff sphere blows outward and extinguishes candles within its effective radius.">
        <rect x="0" y="0" width="360" height="240" fill="#edf4fb" />
        <rect x="0" y="184" width="360" height="56" fill="#dfd4c3" />
        {/* Column */}
        <rect x="72" y="96" width="28" height="88" rx="10" fill="#1c315e" />
        <rect x="76" y="100" width="8" height="80" rx="3" fill="rgba(255,255,255,0.12)" />
        {/* Sphere support rod */}
        <line x1="86" y1="96" x2="86" y2="56" stroke="#1c315e" strokeWidth="6" />
        {/* Sphere */}
        <circle cx="86" cy="42" r="28" fill="rgba(236,242,248,0.96)" stroke="#1c315e" strokeWidth="2.5" />
        <circle cx="78" cy="34" r="8" fill="rgba(255,255,255,0.45)" />
        {/* Electric field glow */}
        <circle cx="86" cy="42" r={Math.min(90, extinctionDistance * 2.3)}
          fill={`rgba(106,171,255,${0.06 * pulse})`}
          stroke={`rgba(106,171,255,${0.32 * pulse})`} strokeDasharray="6 5" />
        {/* Field lines radiating from sphere */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rad = toRadians(deg)
          const r1 = 30, r2 = Math.min(70, extinctionDistance * 2.1)
          return (
            <line key={i}
              x1={86 + Math.cos(rad) * r1} y1={42 + Math.sin(rad) * r1}
              x2={86 + Math.cos(rad) * r2} y2={42 + Math.sin(rad) * r2}
              stroke={`rgba(106,171,255,${0.28 * pulse})`} strokeWidth="1.5" />
          )
        })}
        {/* Candles */}
        {candles.map((candle, i) => {
          const x = 176 + i * 30
          return (
            <g key={i}>
              <rect x={x} y="163" width="13" height="22" rx="3" fill="#f2e7cf" stroke="rgba(12,26,60,0.16)" />
              <line x1={x + 6.5} y1="163" x2={x + 6.5} y2="157" stroke="rgba(12,26,60,0.45)" strokeWidth="1.6" />
              {candle.extinguished ? (
                <>
                  <path d={`M ${x + 6.5} 155 C ${x + 1} 149, ${x + 10} 144, ${x + 6.5} 138`}
                    fill="none" stroke="rgba(90,108,139,0.55)" strokeWidth="2" />
                  <circle cx={x + 6.5} cy="157" r="2.5" fill="rgba(90,108,139,0.5)" />
                </>
              ) : (
                <path
                  d={`M ${x + 6.5} 157 C ${x - 1} ${148 - candle.intensity * 6}, ${x + 12} ${140 - candle.intensity * 9}, ${x + 6.5} ${131 - candle.intensity * 12} C ${x + 1} ${140 - candle.intensity * 4}, ${x + 2} ${150 - candle.intensity * 2}, ${x + 6.5} 157`}
                  fill={`rgba(255, ${185 + Math.round(candle.intensity * 45)}, 58, 0.92)`}
                  stroke="rgba(255,148,40,0.95)"
                />
              )}
            </g>
          )
        })}
        {/* Extinction radius label */}
        <text x="86" y="176" textAnchor="middle" fontSize="9" fill="rgba(106,171,255,0.75)">
          r = {formatNumber(extinctionDistance, 1)} cm
        </text>
        {/* Title */}
        <text x="24" y="24" fontSize="12" fontWeight="700" fill="var(--nd-text)">Van de Graaff — electric wind</text>
        <text x="24" y="39" fontSize="10" fill="rgba(12,26,60,0.55)">The charged sphere ionises air and creates a strong outward wind that snuffs candles.</text>
      </Scene>
    ),
  }
}

// ─── Generic fallback ──────────────────────────────────────────────────────

function genericMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const output = Math.max(0, values.driver * values.response - values.loss)
  const needleAngle = -55 + clamp(output * 10, 0, 110)
  const indicatorGlow = 0.18 + Math.min(0.6, output / 10) + 0.08 * Math.sin(time * 3)
  const angle = toRadians(needleAngle)
  const center = vec(282, 110)

  return {
    lines: [
      ['Output', formatNumber(output)],
      ['Driver', formatNumber(values.driver)],
      ['Loss', formatNumber(values.loss)],
    ],
    viz: (
      <Scene caption="Generic parameter study — use this when the demo does not map to a specific built-in experiment.">
        <rect x="0" y="0" width="360" height="240" fill="#eff5fb" />
        <rect x="34" y="84" width="86" height="72" rx="16" fill="#1c315e" />
        <circle cx="77" cy="120" r={18 + values.driver * 1.7} fill="rgba(244,214,107,0.72)" />
        <circle cx="77" cy="120" r="14" fill="rgba(255,255,255,0.14)" />
        <path d="M 120 120 H 188" stroke="rgba(12,26,60,0.28)" strokeWidth="5" strokeLinecap="round" />
        <rect x="188" y="104" width="54" height="32" rx="12" fill="#8f9eb8" />
        <circle cx="282" cy="110" r="34" fill="rgba(255,255,255,0.78)" stroke="rgba(12,26,60,0.18)" strokeWidth="2" />
        <path d="M 254 110 A 28 28 0 0 1 310 110" fill="none" stroke="rgba(12,26,60,0.16)" strokeWidth="2" />
        <line x1={center.x} y1={center.y} x2={center.x + Math.cos(angle) * 24} y2={center.y + Math.sin(angle) * 24} stroke="#c99700" strokeWidth="3" strokeLinecap="round" />
        <circle cx={center.x} cy={center.y} r="5" fill="#1c315e" />
        <circle cx="288" cy="162" r="16" fill={`rgba(201,151,0,${indicatorGlow})`} stroke="rgba(201,151,0,0.65)" strokeWidth="2" />
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Parameter study</text>
        <text x="24" y="44" fontSize="11" fill="rgba(12,26,60,0.55)">Source–coupling–detector chain shows how the driver produces a measured response.</text>
      </Scene>
    ),
  }
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

function getMetrics(spec: SimulationSpec, values: Record<string, number>, time: number): SceneMetrics {
  switch (spec.kind) {
    case 'ballistic-cart':       return ballisticCartMetrics(values, time)
    case 'basketball-bounce':    return basketballCollisionMetrics(values, time)
    case 'van-de-graaff-candles': return vanDeGraaffFallbackMetrics(values, time)
    case 'projectile':           return projectileMetrics(values, time)
    case 'pendulum':             return pendulumMetrics(values, time)
    case 'harmonic':             return harmonicMetrics(values, time)
    case 'angular-momentum':     return angularMomentumMetrics(values, time)
    case 'wave':                 return waveMetrics(values, time)
    case 'optics':               return opticsMetrics(values, time)
    case 'circuit':              return circuitMetrics(values, time)
    case 'field':                return fieldMetrics(values, time)
    case 'fluid':                return fluidMetrics(values, time)
    case 'thermo':               return thermoMetrics(values, time)
    default:                     return genericMetrics(values, time)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DemoSimulation({ spec }: Props) {
  // Embed mode (external HTML simulation)
  if (spec.embedUrl) {
    return (
      <section className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <div className="eyebrow mb-2">Interactive Simulation</div>
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>{spec.title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--nd-muted)' }}>{spec.summary}</p>
          </div>
          <a href={spec.embedUrl} target="_blank" rel="noopener"
            className="px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg, #f2d37d 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)' }}>
            Open Full Simulation
          </a>
        </div>
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(12,26,60,0.08)', background: 'rgba(255,255,255,0.7)' }}>
          <iframe src={spec.embedUrl} title={spec.title} className="w-full"
            style={{ height: '1080px', border: 0, background: 'white' }} />
        </div>
      </section>
    )
  }

  const defaults = useMemo(
    () => Object.fromEntries(spec.parameters.map(p => [p.key, p.value])),
    [spec.parameters]
  )
  const [values, setValues] = useState<Record<string, number>>(defaults)
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)

  useEffect(() => { setValues(defaults); setTime(0) }, [defaults])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setTime(t => t + 0.04), 40)
    return () => window.clearInterval(id)
  }, [playing])

  const setValue = (key: string, next: number) =>
    setValues(current => ({ ...current, [key]: next }))

  const reset = () => { setValues(defaults); setTime(0); setPlaying(true) }

  const metrics = useMemo(() => getMetrics(spec, values, time), [spec, time, values])

  return (
    <section className="glass-card p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
        <div>
          <div className="eyebrow mb-2">Interactive Simulation</div>
          <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>{spec.title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--nd-muted)' }}>{spec.summary}</p>
          {spec.inferred && (
            <p className="text-xs mt-2" style={{ color: 'var(--nd-muted)' }}>
              Simulation inferred from the demo record. Adjust sliders to explore the key parameters.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setPlaying(p => !p)}
            className="px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(12,26,60,0.08)', color: 'var(--nd-text)' }}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={reset}
            className="px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg, #f2d37d 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)' }}>
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6 items-start">
        <div>{metrics.viz}</div>
        <div className="space-y-4">
          {spec.parameters.map(parameter => (
            <Slider key={parameter.key} parameter={parameter}
              value={values[parameter.key]}
              onChange={next => setValue(parameter.key, next)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        {metrics.lines.map(([label, value]) => (
          <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(12,26,60,0.06)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--nd-muted)' }}>{label}</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--nd-text)' }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
