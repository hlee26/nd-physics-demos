'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SimulationParameter, SimulationSpec } from '@/lib/simulations'

type Props = {
  spec: SimulationSpec
}

type SceneMetrics = {
  lines: Array<[string, string]>
  viz: ReactNode
  caption?: string
}

type Vec = {
  x: number
  y: number
}

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function vec(x: number, y: number): Vec {
  return { x, y }
}

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y }
}

function scaleVec(vector: Vec, scalar: number): Vec {
  return { x: vector.x * scalar, y: vector.y * scalar }
}

function pointsString(points: Vec[]) {
  return points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

function pathFromSampler(steps: number, sample: (ratio: number) => Vec) {
  return Array.from({ length: steps }, (_, index) => {
    const ratio = steps <= 1 ? 0 : index / (steps - 1)
    const point = sample(ratio)
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }).join(' ')
}

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

function Slider({
  parameter,
  value,
  onChange,
}: {
  parameter: SimulationParameter
  value: number
  onChange: (next: number) => void
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
  const trailPath = stageTime <= trailStart
    ? ''
    : pathFromSampler(16, ratio => {
      const elapsed = ratio * trailDuration
      const height = topCollisionHeight + topAfter * elapsed - 0.5 * g * elapsed * elapsed
      return {
        x: 228 + ratio * 54,
        y: floorY - clamp(height, 0, visibleHeight) * scale,
      }
    })

  return {
    lines: [
      ['Upper Ball Peak', `${formatNumber(peakHeight)} m`],
      ['Speed Gain', `${formatNumber(speedGain)}x`],
      ['Upper Launch Speed', `${formatNumber(Math.max(0, topAfter))} m/s`],
    ],
    caption: 'The scene exaggerates the ball sizes for visibility, but the timing and rebound trends follow a stacked-ball collision model.',
    viz: (
      <Scene caption="The scene exaggerates the ball sizes for visibility, but the timing and rebound trends follow a stacked-ball collision model.">
        <rect x="0" y="0" width="360" height="240" fill="#eef5fb" />
        <rect x="0" y="0" width="360" height="136" fill="rgba(178, 206, 233, 0.28)" />
        <rect x="0" y={floorY} width="360" height="30" fill="#d7c2a3" />
        <rect x="0" y={floorY + 18} width="360" height="30" fill="#c39d74" />
        <line x1="28" y1={floorY} x2="332" y2={floorY} stroke="rgba(12,26,60,0.28)" strokeWidth="2.5" />
        <line x1="42" y1={floorY - dropHeight * scale - basketballScreenRadius} x2="318" y2={floorY - dropHeight * scale - basketballScreenRadius} stroke="rgba(12,26,60,0.14)" strokeDasharray="6 6" />
        <text x="48" y={floorY - dropHeight * scale - basketballScreenRadius - 8} fontSize="11" fill="var(--nd-muted)">Release height</text>
        <line x1="214" y1={peakScreenY} x2="332" y2={peakScreenY} stroke="rgba(201,151,0,0.38)" strokeDasharray="5 5" />
        <text x="220" y={peakScreenY - 8} fontSize="11" fill="var(--nd-muted)">Predicted peak</text>
        {trailPath && (
          <path d={trailPath} fill="none" stroke="rgba(201,151,0,0.45)" strokeWidth="2.5" strokeDasharray="5 5" />
        )}
        <circle cx="140" cy={basketballScreenY} r={basketballScreenRadius} fill="#e17c34" stroke="rgba(12,26,60,0.25)" strokeWidth="2" />
        <path d={`M ${140 - basketballScreenRadius * 0.92} ${basketballScreenY} Q 140 ${basketballScreenY - basketballScreenRadius * 0.34} ${140 + basketballScreenRadius * 0.92} ${basketballScreenY}`} fill="none" stroke="rgba(12,26,60,0.24)" strokeWidth="1.5" />
        <path d={`M ${140 - basketballScreenRadius * 0.76} ${basketballScreenY - basketballScreenRadius * 0.52} Q 140 ${basketballScreenY + basketballScreenRadius * 0.06} ${140 + basketballScreenRadius * 0.76} ${basketballScreenY - basketballScreenRadius * 0.52}`} fill="none" stroke="rgba(12,26,60,0.22)" strokeWidth="1.4" />
        <circle cx="140" cy={tennisScreenY} r={tennisScreenRadius} fill="#d7f160" stroke="rgba(12,26,60,0.25)" strokeWidth="1.8" />
        <path d={`M ${140 - tennisScreenRadius * 0.85} ${tennisScreenY + tennisScreenRadius * 0.2} Q 140 ${tennisScreenY - tennisScreenRadius * 0.45} ${140 + tennisScreenRadius * 0.85} ${tennisScreenY + tennisScreenRadius * 0.2}`} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="1.8" />
        <path d={`M ${140 - tennisScreenRadius * 0.82} ${tennisScreenY - tennisScreenRadius * 0.22} Q 140 ${tennisScreenY + tennisScreenRadius * 0.42} ${140 + tennisScreenRadius * 0.82} ${tennisScreenY - tennisScreenRadius * 0.22}`} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="1.8" />
        {Math.abs(stageTime - (tDrop + gapTime)) < 0.08 && (
          <circle cx="140" cy={(basketballScreenY + tennisScreenY) / 2} r="18" fill="rgba(244,214,107,0.22)" stroke="rgba(244,214,107,0.65)" strokeWidth="2" />
        )}
        {topOffFrame && (
          <>
            <path d="M 140 22 L 134 34 H 146 Z" fill="rgba(201,151,0,0.9)" />
            <text x="156" y="30" fontSize="11" fill="var(--nd-text)">Upper ball leaves the frame</text>
          </>
        )}
        <text x="26" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Stacked-ball rebound</text>
        <text x="26" y="44" fontSize="11" fill="var(--nd-muted)">The lighter top ball steals most of the upward speed after the second collision.</text>
      </Scene>
    ),
  }
}

function ballisticCartMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const g = 9.8
  const angle = toRadians(values.trackAngle)
  const track = vec(Math.cos(angle), -Math.sin(angle))
  const normal = vec(Math.sin(angle), Math.cos(angle))
  const flight = (2 * values.launchSpeed) / Math.max(g * Math.cos(angle), 0.3)
  const cycle = flight + 1.5
  const stageTime = Math.min(time % cycle, flight)
  const catchOffset = 0.5 * (g * Math.sin(angle) - values.cartAccel) * flight * flight
  const result =
    Math.abs(catchOffset) < 0.08
      ? 'Returns to cart'
      : catchOffset > 0
        ? 'Ball lands ahead'
        : 'Cart runs ahead'

  const cartAt = (t: number) => add(vec(0, 0), scaleVec(track, values.cartSpeed * t + 0.5 * values.cartAccel * t * t))
  const ballAt = (t: number) =>
    add(
      scaleVec(track, values.cartSpeed * t),
      add(scaleVec(normal, values.launchSpeed * t), vec(0, -0.5 * g * t * t))
    )

  const cartPos = cartAt(stageTime)
  const ballPos = ballAt(stageTime)
  const extent = Math.max(values.cartSpeed * cycle + 0.5 * Math.max(values.cartAccel, g * Math.sin(angle), 0) * cycle * cycle + 1.4, 3.2)
  const scale = Math.min(92, 250 / extent)
  const origin = vec(62, 186)
  const toScreen = (point: Vec) => vec(origin.x + point.x * scale, origin.y - point.y * scale)
  const cartHalfLength = 0.3
  const cartHalfHeight = 0.12
  const cartCorners = [
    add(add(cartPos, scaleVec(track, -cartHalfLength)), scaleVec(normal, 0.02)),
    add(add(cartPos, scaleVec(track, cartHalfLength)), scaleVec(normal, 0.02)),
    add(add(cartPos, scaleVec(track, cartHalfLength)), scaleVec(normal, 2 * cartHalfHeight)),
    add(add(cartPos, scaleVec(track, -cartHalfLength)), scaleVec(normal, 2 * cartHalfHeight)),
  ].map(toScreen)
  const wheelOffset = 0.18
  const wheelRadius = 8
  const leftWheel = toScreen(add(cartPos, scaleVec(track, -wheelOffset)))
  const rightWheel = toScreen(add(cartPos, scaleVec(track, wheelOffset)))
  const basket = toScreen(add(add(cartPos, scaleVec(normal, 0.2)), scaleVec(track, 0.06)))
  const trailPath = pathFromSampler(18, ratio => toScreen(ballAt(flight * ratio)))
  const trackStart = toScreen(add(vec(0, 0), scaleVec(track, -0.55)))
  const trackEnd = toScreen(add(vec(0, 0), scaleVec(track, extent)))
  const ballScreen = toScreen(ballPos)
  const ballRadius = 7

  return {
    lines: [
      ['Flight Time', `${formatNumber(flight)} s`],
      ['Catch Offset', `${formatNumber(Math.abs(catchOffset) * 100, 0)} cm`],
      ['Result', result],
    ],
    viz: (
      <Scene caption="The launch is drawn normal to the track, so matching the cart’s along-track acceleration is what determines whether the ball drops back into the cart.">
        <rect x="0" y="0" width="360" height="240" fill="#edf4fa" />
        <rect x="0" y="155" width="360" height="85" fill="#e4d8c3" />
        <path d={`M ${trackStart.x} ${trackStart.y} L ${trackEnd.x} ${trackEnd.y}`} stroke="#6c7688" strokeWidth="12" strokeLinecap="round" />
        <path d={`M ${trackStart.x} ${trackStart.y - 8} L ${trackEnd.x} ${trackEnd.y - 8}`} stroke="rgba(255,255,255,0.58)" strokeWidth="2" strokeLinecap="round" />
        {Array.from({ length: 6 }, (_, index) => {
          const ratio = index / 5
          const anchor = toScreen(add(vec(0, 0), scaleVec(track, ratio * extent)))
          return (
            <line key={index} x1={anchor.x} y1={anchor.y} x2={anchor.x} y2="220" stroke="rgba(12,26,60,0.08)" strokeWidth="2" />
          )
        })}
        <path d={trailPath} fill="none" stroke="rgba(201,151,0,0.36)" strokeWidth="2.6" strokeDasharray="6 5" />
        <polygon points={pointsString(cartCorners)} fill="#1c315e" stroke="rgba(12,26,60,0.25)" strokeWidth="1.5" />
        <path
          d={`M ${cartCorners[0].x + 10} ${cartCorners[0].y - 2} L ${cartCorners[1].x - 4} ${cartCorners[1].y - 2} L ${basket.x + 12} ${basket.y - 9}`}
          fill="none"
          stroke="rgba(255,255,255,0.86)"
          strokeWidth="2"
        />
        <circle cx={leftWheel.x} cy={leftWheel.y + 2} r={wheelRadius} fill="#24334f" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        <circle cx={rightWheel.x} cy={rightWheel.y + 2} r={wheelRadius} fill="#24334f" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        <path d={`M ${basket.x - 14} ${basket.y} L ${basket.x} ${basket.y - 5} L ${basket.x + 14} ${basket.y}`} fill="none" stroke="rgba(244,214,107,0.92)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={ballScreen.x} cy={ballScreen.y} r={ballRadius} fill="var(--nd-gold)" stroke="rgba(12,26,60,0.3)" strokeWidth="1.5" />
        <line x1={ballScreen.x} y1={ballScreen.y} x2={ballScreen.x + normal.x * 26} y2={ballScreen.y - normal.y * 26} stroke="rgba(201,151,0,0.7)" strokeWidth="2" />
        <text x="28" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Ballistic cart</text>
        <text x="28" y="44" fontSize="11" fill="var(--nd-muted)">The cart catches the ball only when their along-track motion stays matched during flight.</text>
      </Scene>
    ),
  }
}

function projectileMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const speed = values.speed
  const angle = toRadians(values.angle)
  const gravity = values.gravity
  const flight = (2 * speed * Math.sin(angle)) / gravity
  const range = (speed * speed * Math.sin(2 * angle)) / gravity
  const peakHeight = (speed * speed * Math.sin(angle) ** 2) / (2 * gravity)
  const cycle = flight + 1.2
  const stageTime = Math.min(time % cycle, flight)
  const pointAt = (t: number) => ({
    x: speed * Math.cos(angle) * t,
    y: speed * Math.sin(angle) * t - 0.5 * gravity * t * t,
  })
  const position = pointAt(stageTime)
  const scale = Math.min(255 / Math.max(range, 2), 130 / Math.max(peakHeight, 1.6))
  const origin = vec(42, 194)
  const toScreen = (point: Vec) => vec(origin.x + point.x * scale, origin.y - point.y * scale)
  const trailPath = pathFromSampler(24, ratio => toScreen(pointAt(flight * ratio)))
  const projectile = toScreen(position)
  const landing = toScreen(vec(range, 0))
  const vx = speed * Math.cos(angle)
  const vy = speed * Math.sin(angle) - gravity * stageTime

  return {
    lines: [
      ['Flight Time', `${formatNumber(flight)} s`],
      ['Range', `${formatNumber(range)} m`],
      ['Peak Height', `${formatNumber(peakHeight)} m`],
    ],
    viz: (
      <Scene caption="The scene shows the launcher, the full trajectory, and the landing point so the motion reads like an experiment instead of a graph.">
        <rect x="0" y="0" width="360" height="240" fill="#edf5fb" />
        <rect x="0" y="194" width="360" height="46" fill="#d6e2c5" />
        <line x1="24" y1="194" x2="336" y2="194" stroke="rgba(12,26,60,0.22)" strokeWidth="2.5" />
        <path d={trailPath} fill="none" stroke="rgba(201,151,0,0.45)" strokeWidth="3" />
        <rect x="26" y="170" width="18" height="24" rx="4" fill="#1c315e" />
        <line x1="35" y1="170" x2={35 + Math.cos(angle) * 28} y2={170 - Math.sin(angle) * 28} stroke="#1c315e" strokeWidth="5" strokeLinecap="round" />
        <circle cx={projectile.x} cy={projectile.y} r="8" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.28)" strokeWidth="1.5" />
        <line x1={projectile.x} y1={projectile.y} x2={projectile.x + vx * 0.9} y2={projectile.y - vy * 0.9} stroke="rgba(12,26,60,0.4)" strokeWidth="2" />
        <path d={`M ${landing.x - 10} 194 L ${landing.x} 182 L ${landing.x + 10} 194`} fill="none" stroke="rgba(12,26,60,0.32)" strokeWidth="2" />
        <text x="26" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Projectile launch</text>
        <text x="26" y="44" fontSize="11" fill="var(--nd-muted)">Velocity and gravity combine to shape the parabolic path.</text>
      </Scene>
    ),
  }
}

function pendulumMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const length = values.length
  const releaseAngle = toRadians(values.angle)
  const gravity = values.gravity
  const period = 2 * Math.PI * Math.sqrt(length / gravity)
  const angularFrequency = (2 * Math.PI) / period
  const angleNow = releaseAngle * Math.cos(angularFrequency * time)
  const angularSpeed = releaseAngle * angularFrequency * Math.sin(angularFrequency * time)
  const rod = 116
  const pivot = vec(180, 32)
  const bob = vec(pivot.x + Math.sin(angleNow) * rod, pivot.y + Math.cos(angleNow) * rod)
  const arcPath = pathFromSampler(22, ratio => {
    const theta = -releaseAngle + ratio * releaseAngle * 2
    return vec(pivot.x + Math.sin(theta) * rod, pivot.y + Math.cos(theta) * rod)
  })

  return {
    lines: [
      ['Period', `${formatNumber(period)} s`],
      ['Bob Speed', `${formatNumber(Math.abs(angularSpeed) * length)} m/s`],
      ['Release Angle', `${formatNumber(values.angle, 0)} deg`],
    ],
    viz: (
      <Scene caption="The stand, arc guide, and bob trail make the oscillation feel like a lab setup instead of a dial.">
        <rect x="0" y="0" width="360" height="240" fill="#eff4f7" />
        <rect x="0" y="186" width="360" height="54" fill="#e3dacb" />
        <rect x="164" y="20" width="32" height="10" rx="5" fill="#1c315e" />
        <line x1="180" y1="30" x2="180" y2="18" stroke="#1c315e" strokeWidth="5" strokeLinecap="round" />
        <path d={arcPath} fill="none" stroke="rgba(12,26,60,0.16)" strokeWidth="2.5" strokeDasharray="5 5" />
        <line x1={pivot.x} y1={pivot.y} x2={bob.x} y2={bob.y} stroke="#1c315e" strokeWidth="4" />
        <line x1={pivot.x} y1={pivot.y} x2="180" y2={pivot.y + rod} stroke="rgba(12,26,60,0.14)" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx={pivot.x} cy={pivot.y} r="7" fill="#1c315e" />
        <circle cx={bob.x} cy={bob.y} r="18" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.3)" strokeWidth="2" />
        <circle cx={bob.x - 5} cy={bob.y - 5} r="5" fill="rgba(255,255,255,0.36)" />
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Simple pendulum</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Longer strings slow the motion, while larger release angles increase the swing amplitude.</text>
      </Scene>
    ),
  }
}

function harmonicMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const omega = Math.sqrt(values.k / values.mass)
  const period = (2 * Math.PI) / omega
  const displacement = values.amplitude * Math.cos(omega * time)
  const cartX = 212 + displacement * 145
  const springPath = Array.from({ length: 10 }, (_, index) => {
    const x = 84 + (index * (cartX - 84)) / 9
    const y = index === 0 || index === 9 ? 120 : index % 2 === 0 ? 104 : 136
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y}`
  }).join(' ')

  return {
    lines: [
      ['Period', `${formatNumber(period)} s`],
      ['Angular Frequency', `${formatNumber(omega)} rad/s`],
      ['Displacement', `${formatNumber(displacement)} m`],
    ],
    viz: (
      <Scene caption="The oscillator is shown as a mass on a spring over a track so the displacement reads like physical motion.">
        <rect x="0" y="0" width="360" height="240" fill="#eff5fb" />
        <rect x="0" y="170" width="360" height="70" fill="#e3d9c8" />
        <rect x="32" y="86" width="30" height="68" rx="8" fill="#70809d" />
        <line x1="62" y1="120" x2="84" y2="120" stroke="#1c315e" strokeWidth="5" />
        <path d={springPath} fill="none" stroke="#1c315e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x={cartX} y="92" width="54" height="56" rx="12" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.26)" strokeWidth="2" />
        <rect x="64" y="148" width="252" height="8" rx="4" fill="rgba(12,26,60,0.12)" />
        <line x1={67} y1="82" x2={67} y2="160" stroke="rgba(12,26,60,0.12)" />
        <line x1="212" y1="82" x2="212" y2="160" stroke="rgba(12,26,60,0.12)" strokeDasharray="5 5" />
        <line x1={357} y1="82" x2={357} y2="160" stroke="rgba(12,26,60,0.12)" />
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Mass-spring oscillator</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Increasing the spring constant quickens the oscillation; adding mass slows it down.</text>
      </Scene>
    ),
  }
}

function angularMomentumMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const radius = values.collapsedRadius + ((values.radius - values.collapsedRadius) * (Math.cos(time * 0.9) + 1)) / 2
  const omega = values.omega * (values.radius / radius) ** 2
  const rotation = time * omega
  const armLength = 32 + radius * 42
  const center = vec(180, 120)
  const leftMass = vec(center.x + Math.cos(rotation) * armLength, center.y + Math.sin(rotation) * armLength)
  const rightMass = vec(center.x - Math.cos(rotation) * armLength, center.y - Math.sin(rotation) * armLength)

  return {
    lines: [
      ['Final Angular Speed', `${formatNumber(values.omega * (values.radius / values.collapsedRadius) ** 2)} rad/s`],
      ['Moment Ratio', `${formatNumber((values.radius / values.collapsedRadius) ** 2)}x`],
      ['Instantaneous Radius', `${formatNumber(radius)} m`],
    ],
    viz: (
      <Scene caption="The top view emphasizes how pulling mass inward shrinks the moment of inertia and speeds the rotation up.">
        <rect x="0" y="0" width="360" height="240" fill="#eef4fa" />
        <circle cx={center.x} cy={center.y} r="82" fill="rgba(28,49,94,0.06)" stroke="rgba(12,26,60,0.1)" strokeDasharray="5 5" />
        <line x1={center.x} y1={center.y} x2={leftMass.x} y2={leftMass.y} stroke="#1c315e" strokeWidth="6" strokeLinecap="round" />
        <line x1={center.x} y1={center.y} x2={rightMass.x} y2={rightMass.y} stroke="#1c315e" strokeWidth="6" strokeLinecap="round" />
        <circle cx={center.x} cy={center.y} r="18" fill="#35538e" />
        <circle cx={leftMass.x} cy={leftMass.y} r="15" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.28)" strokeWidth="2" />
        <circle cx={rightMass.x} cy={rightMass.y} r="15" fill="var(--nd-gold)" stroke="rgba(12,26,60,0.28)" strokeWidth="2" />
        <path d={`M 118 68 A 82 82 0 0 1 242 68`} fill="none" stroke="rgba(201,151,0,0.45)" strokeWidth="2.5" />
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Angular momentum</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Bring the masses inward and the rotation speeds up to conserve angular momentum.</text>
      </Scene>
    ),
  }
}

function waveMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const speed = values.frequency * values.wavelength
  const phase = time * values.frequency * 2 * Math.PI
  const amplitudePx = values.amplitude * 48
  const wavelengthPx = values.wavelength * 42
  const ropePath = pathFromSampler(80, ratio => {
    const x = 36 + ratio * 288
    const y = 124 + Math.sin((x / wavelengthPx) * 2 * Math.PI - phase) * amplitudePx
    return vec(x, y)
  })

  return {
    lines: [
      ['Wave Speed', `${formatNumber(speed)} m/s`],
      ['Period', `${formatNumber(1 / values.frequency)} s`],
      ['Amplitude', `${formatNumber(values.amplitude)} m`],
    ],
    viz: (
      <Scene caption="The driver, rope, and wavelength markers make the wave read like an apparatus with a real source and disturbance.">
        <rect x="0" y="0" width="360" height="240" fill="#eef5fb" />
        <rect x="24" y="86" width="22" height="76" rx="8" fill="#657792" />
        <line x1="46" y1="124" x2="60" y2="124" stroke="#1c315e" strokeWidth="4" />
        <path d={ropePath} fill="none" stroke="#1c315e" strokeWidth="4" strokeLinecap="round" />
        <line x1="86" y1="62" x2="86" y2="186" stroke="rgba(12,26,60,0.1)" strokeDasharray="5 5" />
        <line x1="86" y1={124 - amplitudePx} x2="86" y2={124 + amplitudePx} stroke="rgba(201,151,0,0.55)" strokeWidth="2" />
        <line x1="180" y1="56" x2={180 + wavelengthPx} y2="56" stroke="rgba(201,151,0,0.55)" strokeWidth="2.5" />
        <line x1="180" y1="50" x2="180" y2="62" stroke="rgba(201,151,0,0.55)" strokeWidth="2.5" />
        <line x1={180 + wavelengthPx} y1="50" x2={180 + wavelengthPx} y2="62" stroke="rgba(201,151,0,0.55)" strokeWidth="2.5" />
        <text x="186" y="48" fontSize="10" fill="var(--nd-muted)">one wavelength</text>
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Traveling wave</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Frequency sets the pacing while wavelength controls the spacing between crests.</text>
      </Scene>
    ),
  }
}

function wavelengthColor(wavelength: number) {
  const hue = clamp(260 - (wavelength - 380) * 0.58, 10, 260)
  return `hsl(${hue}, 88%, 58%)`
}

function opticsMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const fringeSpacing = (values.wavelength * 1e-9 * values.distance) / (values.spacing * 1e-3)
  const glow = wavelengthColor(values.wavelength)
  const fringePixels = clamp(fringeSpacing * 9000, 10, 34)
  const shimmer = 0.84 + 0.16 * Math.sin(time * 3.5)

  return {
    lines: [
      ['Fringe Spacing', `${formatNumber(fringeSpacing * 1000, 3)} mm`],
      ['Wavelength', `${formatNumber(values.wavelength, 0)} nm`],
      ['Screen Distance', `${formatNumber(values.distance)} m`],
    ],
    viz: (
      <Scene caption="Instead of bars on an axis, the scene shows a light source, the slit barrier, and the screen where the fringes appear.">
        <rect x="0" y="0" width="360" height="240" fill="#eff4fa" />
        <circle cx="56" cy="120" r="18" fill={glow} opacity="0.92" />
        <circle cx="56" cy="120" r="28" fill={glow} opacity="0.18" />
        <rect x="126" y="60" width="14" height="120" rx="4" fill="#203351" />
        <rect x="130" y="84" width="3" height="20" rx="1.5" fill="white" />
        <rect x="130" y="136" width="3" height="20" rx="1.5" fill="white" />
        <rect x="292" y="42" width="12" height="156" rx="5" fill="#d9e2ee" stroke="rgba(12,26,60,0.18)" strokeWidth="1.5" />
        <path d={`M 72 120 L 126 96 M 72 120 L 126 144`} stroke={glow} strokeWidth="2" opacity={0.42 * shimmer} />
        {Array.from({ length: 9 }, (_, index) => {
          const offset = (index - 4) * fringePixels
          const opacity = Math.max(0.18, 1 - Math.abs(index - 4) * 0.12) * shimmer
          return (
            <rect key={index} x={298} y={95 + offset} width="4" height="20" fill={glow} opacity={opacity} />
          )
        })}
        {Array.from({ length: 5 }, (_, index) => {
          const offset = (index - 2) * fringePixels * 2
          return (
            <path
              key={index}
              d={`M 133 ${120 + offset * 0.15} C 182 ${110 + offset * 0.25}, 234 ${112 + offset * 0.55}, 292 ${105 + offset}`}
              fill="none"
              stroke={glow}
              strokeWidth="1.8"
              opacity={0.2 + index * 0.08}
            />
          )
        })}
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Interference / diffraction</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Longer wavelengths or a farther screen spread the bright fringes farther apart.</text>
      </Scene>
    ),
  }
}

function pointOnCircuitPath(progress: number) {
  const xLeft = 58
  const xRight = 296
  const yTop = 78
  const yBottom = 162
  const width = xRight - xLeft
  const height = yBottom - yTop
  const perimeter = width * 2 + height * 2
  let distance = (progress % 1) * perimeter

  if (distance < width) return vec(xLeft + distance, yTop)
  distance -= width
  if (distance < height) return vec(xRight, yTop + distance)
  distance -= height
  if (distance < width) return vec(xRight - distance, yBottom)
  distance -= width
  return vec(xLeft, yBottom - distance)
}

function circuitMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const current = values.voltage / values.resistance
  const tau = values.resistance * (values.capacitance / 1_000_000)
  const cycle = Math.max(tau * 5, 0.6)
  const stageTime = time % cycle
  const chargeFraction = 1 - Math.exp(-stageTime / Math.max(tau, 0.03))
  const charge = (values.capacitance / 1_000_000) * values.voltage * chargeFraction

  return {
    lines: [
      ['Current', `${formatNumber(current, 3)} A`],
      ['Time Constant', `${formatNumber(tau, 3)} s`],
      ['Charge', `${formatNumber(charge, 4)} C`],
    ],
    viz: (
      <Scene caption="The battery, resistor, capacitor, and moving charge markers make it easier to see the actual circuit behavior than a simple bar graph.">
        <rect x="0" y="0" width="360" height="240" fill="#eff5fb" />
        <path d="M 58 78 H 120 L 148 78 L 148 162 L 214 162 M 246 162 H 296 V 78 H 58 V 162 H 96" fill="none" stroke="#1c315e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="96" cy="120" r="22" fill="rgba(201,151,0,0.14)" stroke="var(--nd-gold)" strokeWidth="3" />
        <line x1="89" y1="108" x2="103" y2="108" stroke="#1c315e" strokeWidth="2.2" />
        <line x1="96" y1="101" x2="96" y2="115" stroke="#1c315e" strokeWidth="2.2" />
        <line x1="89" y1="132" x2="103" y2="132" stroke="#1c315e" strokeWidth="2.2" />
        <path d="M 120 78 L 127 68 L 134 88 L 141 68 L 148 78" fill="none" stroke="#1c315e" strokeWidth="4" strokeLinecap="round" />
        <line x1="214" y1="132" x2="214" y2="188" stroke="#1c315e" strokeWidth="4" />
        <line x1="246" y1="132" x2="246" y2="188" stroke="#1c315e" strokeWidth="4" />
        <rect x="214" y={188 - chargeFraction * 56} width="32" height={chargeFraction * 56} fill="rgba(201,151,0,0.72)" />
        {Array.from({ length: 8 }, (_, index) => {
          const point = pointOnCircuitPath((time * 0.14 + index * 0.12) % 1)
          return <circle key={index} cx={point.x} cy={point.y} r="4.2" fill="rgba(53,83,142,0.72)" />
        })}
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">RC circuit</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Charge piles up between the capacitor plates as the circuit approaches equilibrium.</text>
      </Scene>
    ),
  }
}

function fieldMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const fieldStrength = (values.sourceA * values.sourceB) / (values.distance * values.distance)
  const left = vec(110, 124)
  const right = vec(110 + values.distance * 38, 124)
  const pulse = 0.8 + 0.2 * Math.sin(time * 2.6)

  return {
    lines: [
      ['Field / Force Scale', `${formatNumber(fieldStrength)}`],
      ['Separation', `${formatNumber(values.distance)} m`],
      ['Inverse-Square Factor', `${formatNumber(1 / (values.distance * values.distance))}`],
    ],
    viz: (
      <Scene caption="The charges are shown as sources with curved field lines and a highlighted interaction region instead of disconnected circles.">
        <rect x="0" y="0" width="360" height="240" fill="#eff4fb" />
        <circle cx={left.x} cy={left.y} r={14 + values.sourceA * 1.9} fill="rgba(201,151,0,0.84)" />
        <circle cx={right.x} cy={right.y} r={14 + values.sourceB * 1.9} fill="rgba(28,49,94,0.82)" />
        {Array.from({ length: 5 }, (_, index) => {
          const offset = (index - 2) * 24
          return (
            <path
              key={index}
              d={`M ${left.x + 18} ${left.y + offset} C ${left.x + 64} ${left.y + offset * 0.42}, ${right.x - 64} ${right.y + offset * 0.42}, ${right.x - 18} ${right.y + offset}`}
              fill="none"
              stroke={`rgba(53,83,142,${0.24 + index * 0.12})`}
              strokeWidth={1.6 + index * 0.25}
            />
          )
        })}
        <line x1={left.x} y1={left.y} x2={right.x} y2={right.y} stroke="rgba(12,26,60,0.16)" strokeDasharray="5 5" />
        <circle cx={(left.x + right.x) / 2} cy={124} r={18 + fieldStrength * 0.55} fill={`rgba(201,151,0,${0.08 * pulse})`} stroke={`rgba(201,151,0,${0.34 * pulse})`} strokeDasharray="5 5" />
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Field interaction</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Bringing the sources together rapidly strengthens the interaction because of the inverse-square dependence.</text>
      </Scene>
    ),
  }
}

function fluidMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const areaM2 = values.area / 10000
  const flowRate = values.velocity * areaM2
  const pressureDelta = 0.5 * values.density * values.velocity * values.velocity
  const throatHalfHeight = clamp(values.area * 5.5, 20, 34)

  return {
    lines: [
      ['Flow Rate', `${formatNumber(flowRate, 4)} m³/s`],
      ['Dynamic Pressure', `${formatNumber(pressureDelta, 0)} Pa`],
      ['Speed', `${formatNumber(values.velocity)} m/s`],
    ],
    viz: (
      <Scene caption="The narrowed throat and faster particles show why flow speeds up and pressure changes inside a venturi-style section.">
        <rect x="0" y="0" width="360" height="240" fill="#eef6fb" />
        <path d={`M 26 84 H 118 L 176 ${120 - throatHalfHeight} H 246 L 304 84`} fill="none" stroke="#1c315e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M 26 156 H 118 L 176 ${120 + throatHalfHeight} H 246 L 304 156`} fill="none" stroke="#1c315e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        {Array.from({ length: 9 }, (_, index) => {
          const phase = (time * (0.55 + values.velocity * 0.04) + index * 0.11) % 1
          const x = 38 + phase * 248
          const inThroat = x > 138 && x < 246
          const yBase = 120 + Math.sin(time * 1.8 + index) * 12
          return (
            <circle
              key={index}
              cx={x}
              cy={inThroat ? 120 + Math.sin(time * 2.4 + index) * throatHalfHeight * 0.42 : yBase}
              r={inThroat ? 4 : 6}
              fill="var(--nd-gold)"
              opacity={inThroat ? 0.95 : 0.7}
            />
          )
        })}
        <line x1="126" y1="58" x2="126" y2="182" stroke="rgba(12,26,60,0.1)" strokeDasharray="5 5" />
        <line x1="246" y1="58" x2="246" y2="182" stroke="rgba(12,26,60,0.1)" strokeDasharray="5 5" />
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Flow through a constriction</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">The same fluid squeezes through a smaller area, so the stream speeds up in the middle section.</text>
      </Scene>
    ),
  }
}

function thermoMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const pressure = (values.moles * 0.082057 * values.temperature) / values.volume
  const energy = 1.5 * values.moles * 8.314 * values.temperature
  const pistonTop = 160 - clamp(values.volume * 4.5, 22, 78)

  return {
    lines: [
      ['Pressure', `${formatNumber(pressure)} atm`],
      ['Thermal Energy', `${formatNumber(energy, 0)} J`],
      ['Temperature', `${formatNumber(values.temperature, 0)} K`],
    ],
    viz: (
      <Scene caption="The piston height and the gas particle motion together show how volume and temperature affect the state of the gas.">
        <rect x="0" y="0" width="360" height="240" fill="#f2f5f9" />
        <rect x="104" y="44" width="152" height="142" rx="18" fill="rgba(255,255,255,0.78)" stroke="#1c315e" strokeWidth="3" />
        <rect x="110" y={pistonTop} width="140" height="12" rx="6" fill="#8f9eb8" />
        <rect x="112" y={pistonTop + 12} width="136" height={176 - pistonTop} fill="rgba(244,214,107,0.08)" />
        {Array.from({ length: 22 }, (_, index) => {
          const speed = values.temperature / 220
          return (
            <circle
              key={index}
              cx={122 + ((index * 37 + time * speed * 14) % 116)}
              cy={pistonTop + 24 + ((index * 23 + time * speed * 18) % Math.max(22, 148 - pistonTop))}
              r="4.8"
              fill="rgba(201,151,0,0.72)"
            />
          )
        })}
        <rect x="104" y="186" width="152" height="12" rx="6" fill="#cc6f3f" />
        <text x="24" y="28" fontSize="12" fontWeight="700" fill="var(--nd-text)">Gas in a cylinder</text>
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">Hotter particles move faster, and the piston position reflects the selected gas volume.</text>
      </Scene>
    ),
  }
}

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
      <Scene caption="When a demo doesn’t match a specific built-in experiment, the fallback still uses a source-detector apparatus instead of abstract bars.">
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
        <text x="24" y="44" fontSize="11" fill="var(--nd-muted)">The source, coupling block, and detector gauge show how the chosen driver produces a measured response.</text>
      </Scene>
    ),
  }
}

function vanDeGraaffFallbackMetrics(values: Record<string, number>, time: number): SceneMetrics {
  const candleCount = Math.round(values.candles)
  const humidityFactor = 1 - values.humidity / 140
  const effectiveRadius = Math.sqrt(values.voltage) * 1.15 * humidityFactor
  const extinctionDistance = effectiveRadius * 1.6
  const candles = Array.from({ length: candleCount }, (_, index) => {
    const distance = values.spacing + index * 3.2
    const intensity = Math.max(0, 1 - distance / Math.max(extinctionDistance, 1))
    return { distance, extinguished: distance <= extinctionDistance, intensity }
  })
  const extinguished = candles.filter(candle => candle.extinguished).length
  const pulse = 0.82 + 0.18 * Math.sin(time * 6)

  return {
    lines: [
      ['Estimated Extinction Radius', `${formatNumber(extinctionDistance)} cm`],
      ['Candles Extinguished', `${extinguished} / ${candleCount}`],
      ['Humidity Reduction', `${formatNumber((1 - humidityFactor) * 100, 0)} %`],
    ],
    viz: (
      <Scene caption="A fuller apparatus-style Van de Graaff simulation is available in the embedded full-screen view when present.">
        <rect x="0" y="0" width="360" height="240" fill="#edf4fb" />
        <rect x="0" y="184" width="360" height="56" fill="#dfd4c3" />
        <rect x="72" y="96" width="28" height="88" rx="10" fill="#1c315e" />
        <line x1="86" y1="96" x2="86" y2="56" stroke="#1c315e" strokeWidth="6" />
        <circle cx="86" cy="42" r="28" fill="rgba(236,242,248,0.96)" stroke="#1c315e" strokeWidth="2.5" />
        <circle cx="86" cy="42" r={Math.min(88, extinctionDistance * 2.3)} fill={`rgba(106,171,255,${0.08 * pulse})`} stroke={`rgba(106,171,255,${0.36 * pulse})`} strokeDasharray="6 6" />
        {candles.map((candle, index) => {
          const x = 176 + index * 28
          return (
            <g key={index}>
              <rect x={x} y="162" width="13" height="22" rx="3" fill="#f2e7cf" stroke="rgba(12,26,60,0.16)" />
              <line x1={x + 6.5} y1="162" x2={x + 6.5} y2="156" stroke="rgba(12,26,60,0.45)" strokeWidth="1.6" />
              {candle.extinguished ? (
                <>
                  <path d={`M ${x + 6.5} 154 C ${x + 1} 148, ${x + 10} 144, ${x + 6.5} 138`} fill="none" stroke="rgba(90,108,139,0.58)" strokeWidth="2" />
                  <circle cx={x + 6.5} cy="156" r="2.4" fill="rgba(90,108,139,0.44)" />
                </>
              ) : (
                <path
                  d={`M ${x + 6.5} 156 C ${x - 0.5} ${148 - candle.intensity * 6}, ${x + 12} ${140 - candle.intensity * 9}, ${x + 6.5} ${132 - candle.intensity * 12} C ${x + 1} ${140 - candle.intensity * 4}, ${x + 2} ${149 - candle.intensity * 2}, ${x + 6.5} 156`}
                  fill={`rgba(255, ${188 + Math.round(candle.intensity * 42)}, 58, 0.92)`}
                  stroke="rgba(255,148,40,0.95)"
                />
              )}
            </g>
          )
        })}
      </Scene>
    ),
  }
}

function getMetrics(spec: SimulationSpec, values: Record<string, number>, time: number): SceneMetrics {
  switch (spec.kind) {
    case 'ballistic-cart':
      return ballisticCartMetrics(values, time)
    case 'basketball-bounce':
      return basketballCollisionMetrics(values, time)
    case 'van-de-graaff-candles':
      return vanDeGraaffFallbackMetrics(values, time)
    case 'projectile':
      return projectileMetrics(values, time)
    case 'pendulum':
      return pendulumMetrics(values, time)
    case 'harmonic':
      return harmonicMetrics(values, time)
    case 'angular-momentum':
      return angularMomentumMetrics(values, time)
    case 'wave':
      return waveMetrics(values, time)
    case 'optics':
      return opticsMetrics(values, time)
    case 'circuit':
      return circuitMetrics(values, time)
    case 'field':
      return fieldMetrics(values, time)
    case 'fluid':
      return fluidMetrics(values, time)
    case 'thermo':
      return thermoMetrics(values, time)
    default:
      return genericMetrics(values, time)
  }
}

export default function DemoSimulation({ spec }: Props) {
  if (spec.embedUrl) {
    return (
      <section className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <div className="eyebrow mb-2">Interactive Simulation</div>
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--nd-text)' }}>{spec.title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--nd-muted)' }}>{spec.summary}</p>
          </div>
          <a
            href={spec.embedUrl}
            target="_blank"
            rel="noopener"
            className="px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg, #f2d37d 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)' }}
          >
            Open Full Simulation
          </a>
        </div>
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(12,26,60,0.08)', background: 'rgba(255,255,255,0.7)' }}>
          <iframe
            src={spec.embedUrl}
            title={spec.title}
            className="w-full"
            style={{ height: '1080px', border: 0, background: 'white' }}
          />
        </div>
      </section>
    )
  }

  const defaults = useMemo(
    () => Object.fromEntries(spec.parameters.map(parameter => [parameter.key, parameter.value])),
    [spec.parameters]
  )
  const [values, setValues] = useState<Record<string, number>>(defaults)
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)

  useEffect(() => {
    setValues(defaults)
    setTime(0)
  }, [defaults])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setTime(current => current + 0.04)
    }, 40)
    return () => window.clearInterval(id)
  }, [playing])

  const setValue = (key: string, next: number) => {
    setValues(current => ({ ...current, [key]: next }))
  }

  const reset = () => {
    setValues(defaults)
    setTime(0)
    setPlaying(true)
  }

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
              Generated from the demo record and rendered with a more physical scene instead of an abstract chart.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying(current => !current)}
            className="px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(12,26,60,0.08)', color: 'var(--nd-text)' }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={reset}
            className="px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg, #f2d37d 0%, var(--nd-gold) 100%)', color: 'var(--nd-navy)' }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6 items-start">
        <div>{metrics.viz}</div>
        <div className="space-y-4">
          {spec.parameters.map(parameter => (
            <Slider
              key={parameter.key}
              parameter={parameter}
              value={values[parameter.key]}
              onChange={next => setValue(parameter.key, next)}
            />
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
