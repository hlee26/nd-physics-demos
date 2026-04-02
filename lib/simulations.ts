export type SimulationKind =
  | 'van-de-graaff-candles'
  | 'ballistic-cart'
  | 'basketball-bounce'
  | 'projectile'
  | 'pendulum'
  | 'harmonic'
  | 'angular-momentum'
  | 'wave'
  | 'optics'
  | 'circuit'
  | 'field'
  | 'fluid'
  | 'thermo'
  | 'generic'

export type SimulationParameter = {
  key: string
  label: string
  min: number
  max: number
  step: number
  value: number
  unit?: string
}

export type SimulationSpec = {
  kind: SimulationKind
  title: string
  summary: string
  inferred: boolean
  parameters: SimulationParameter[]
  embedUrl?: string
}

export type DemoLike = {
  id?: string
  title: string
  category: string
  subcategory: string
  slug?: string | null
  description?: string | null
  setup?: string | null
  notes?: string | null
  equipment?: string | null
  simulation_type?: string | null
  simulation_config?: SimulationSpec | null
}

function makeSpec(kind: SimulationKind, title: string, summary: string, parameters: SimulationParameter[], inferred = true): SimulationSpec {
  return { kind, title, summary, parameters, inferred }
}

function textFor(demo: DemoLike) {
  return [demo.title, demo.description, demo.setup, demo.notes, demo.equipment]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function has(text: string, words: string[]) {
  return words.some(word => text.includes(word))
}

export function inferSimulationSpec(demo: DemoLike): SimulationSpec {
  if (demo.simulation_config) return demo.simulation_config

  const text = textFor(demo)

  if (
    demo.slug === 'van-de-graaff-candles' ||
    has(text, ['electric wind']) ||
    (has(text, ['van de graaff', 'van-de-graaff']) && has(text, ['candle', 'candles']))
  ) {
    const spec = makeSpec(
      'van-de-graaff-candles',
      'Van de Graaff Candle Discharge',
      'Estimate whether nearby candle flames stay lit as voltage, spacing, and room conditions change.',
      [
        { key: 'voltage', label: 'Sphere Voltage', min: 20, max: 350, step: 5, value: 110, unit: 'kV' },
        { key: 'candles', label: 'Number of Candles', min: 1, max: 6, step: 1, value: 3 },
        { key: 'spacing', label: 'Candle Distance', min: 3, max: 30, step: 1, value: 10, unit: 'cm' },
        { key: 'humidity', label: 'Humidity', min: 10, max: 90, step: 1, value: 40, unit: '%' },
      ],
      false
    )
    spec.embedUrl = '/simulations/van-de-graaff-candles.html'
    return spec
  }

  if (
    demo.slug?.startsWith('ballistic-cart') ||
    has(text, ['ballistic cart'])
  ) {
    const accelerationDemo = demo.slug?.includes('acceleration') || has(text, ['accelerating cart', 'mass hanger', 'pulley'])
    const inclineDemo = demo.slug?.includes('incline') || has(text, ['incline', 'elevate one end', 'lab jack'])
    const inclineAngle = inclineDemo ? 12 : 0
    const inclineAcceleration = inclineDemo ? 2.05 : 0

    return makeSpec(
      'ballistic-cart',
      'Ballistic Cart Model',
      accelerationDemo
        ? 'Watch how an accelerating cart outruns the launched ball and misses the catch.'
        : inclineDemo
          ? 'See why the ball can still return to the cart when both move together along an incline.'
          : 'Launch a ball from a moving cart and compare when it falls back into the cart.',
      [
        { key: 'cartSpeed', label: 'Cart Speed', min: 0.3, max: 3.5, step: 0.05, value: accelerationDemo ? 0.9 : inclineDemo ? 1.1 : 1.2, unit: 'm/s' },
        { key: 'launchSpeed', label: 'Launch Speed', min: 1, max: 6.5, step: 0.05, value: 3.9, unit: 'm/s' },
        { key: 'cartAccel', label: 'Cart Acceleration', min: -0.5, max: 3.5, step: 0.05, value: accelerationDemo ? 1.15 : inclineAcceleration, unit: 'm/s²' },
        { key: 'trackAngle', label: 'Track Angle', min: 0, max: 18, step: 1, value: inclineAngle, unit: 'deg' },
      ],
      false
    )
  }

  if (
    demo.slug === 'basketball-tennis-ball-drop' ||
    has(text, ['tennis ball']) ||
    has(text, ['basketball']) ||
    has(text, ['exploding stars'])
  ) {
    return makeSpec(
      'basketball-bounce',
      'Stacked Ball Collision',
      'Drop a basketball with a lighter ball on top to see how momentum transfer launches the upper ball much higher.',
      [
        { key: 'dropHeight', label: 'Drop Height', min: 0.4, max: 2.4, step: 0.05, value: 1.2, unit: 'm' },
        { key: 'basketballBounce', label: 'Basketball Bounce', min: 0.35, max: 0.95, step: 0.01, value: 0.78 },
        { key: 'collisionElasticity', label: 'Ball Collision Elasticity', min: 0.4, max: 0.98, step: 0.01, value: 0.9 },
        { key: 'upperMass', label: 'Upper Ball Mass', min: 0.03, max: 0.18, step: 0.005, value: 0.058, unit: 'kg' },
      ],
      false
    )
  }

  if (has(text, ['projectile', 'launch', 'cannon', 'trajectory', 'ballistic'])) {
    return makeSpec(
      'projectile',
      'Projectile Model',
      'Adjust launch conditions and compare flight time, range, and peak height.',
      [
        { key: 'speed', label: 'Launch Speed', min: 2, max: 40, step: 0.5, value: 18, unit: 'm/s' },
        { key: 'angle', label: 'Launch Angle', min: 5, max: 85, step: 1, value: 42, unit: 'deg' },
        { key: 'gravity', label: 'Gravity', min: 1, max: 20, step: 0.1, value: 9.8, unit: 'm/s²' },
      ]
    )
  }

  if (has(text, ['pendulum', 'bob', 'swing'])) {
    return makeSpec(
      'pendulum',
      'Pendulum Model',
      'Change length, release angle, and gravity to estimate period and motion.',
      [
        { key: 'length', label: 'Length', min: 0.2, max: 4, step: 0.05, value: 1.4, unit: 'm' },
        { key: 'angle', label: 'Release Angle', min: 2, max: 45, step: 1, value: 15, unit: 'deg' },
        { key: 'gravity', label: 'Gravity', min: 1, max: 20, step: 0.1, value: 9.8, unit: 'm/s²' },
      ]
    )
  }

  if (has(text, ['spring', 'shm', 'oscillation', 'mass on a spring', 'simple harmonic'])) {
    return makeSpec(
      'harmonic',
      'Oscillator Model',
      'Vary mass, spring constant, and amplitude to estimate oscillation timing.',
      [
        { key: 'mass', label: 'Mass', min: 0.1, max: 10, step: 0.1, value: 1.2, unit: 'kg' },
        { key: 'k', label: 'Spring Constant', min: 1, max: 60, step: 0.5, value: 14, unit: 'N/m' },
        { key: 'amplitude', label: 'Amplitude', min: 0.01, max: 0.5, step: 0.01, value: 0.18, unit: 'm' },
      ]
    )
  }

  if (has(text, ['hoberman', 'collapsing star', 'angular momentum', 'rotation', 'spin faster'])) {
    return makeSpec(
      'angular-momentum',
      'Angular Momentum Model',
      'Shrink the rotating radius and observe the corresponding increase in angular speed.',
      [
        { key: 'radius', label: 'Initial Radius', min: 0.2, max: 2.5, step: 0.05, value: 1.2, unit: 'm' },
        { key: 'collapsedRadius', label: 'Collapsed Radius', min: 0.05, max: 1.2, step: 0.05, value: 0.45, unit: 'm' },
        { key: 'omega', label: 'Initial Angular Speed', min: 0.2, max: 8, step: 0.1, value: 1.5, unit: 'rad/s' },
      ]
    )
  }

  if (demo.category === 'optics' || has(text, ['laser', 'slit', 'interference', 'diffraction', 'polarization', 'prism', 'refraction'])) {
    return makeSpec(
      'optics',
      'Optics Model',
      'Change wavelength and geometry to estimate fringe spacing or refraction angle.',
      [
        { key: 'wavelength', label: 'Wavelength', min: 380, max: 750, step: 5, value: 532, unit: 'nm' },
        { key: 'spacing', label: 'Slit/Feature Spacing', min: 0.01, max: 1, step: 0.01, value: 0.2, unit: 'mm' },
        { key: 'distance', label: 'Screen Distance', min: 0.2, max: 5, step: 0.05, value: 1.5, unit: 'm' },
      ]
    )
  }

  if (demo.category === 'oscillations-waves' || has(text, ['wave', 'frequency', 'standing wave', 'beats', 'slinky', 'sound'])) {
    return makeSpec(
      'wave',
      'Wave Model',
      'Adjust frequency, wavelength, and amplitude to compare propagation and period.',
      [
        { key: 'frequency', label: 'Frequency', min: 0.1, max: 20, step: 0.1, value: 2.5, unit: 'Hz' },
        { key: 'wavelength', label: 'Wavelength', min: 0.2, max: 8, step: 0.1, value: 2, unit: 'm' },
        { key: 'amplitude', label: 'Amplitude', min: 0.05, max: 1, step: 0.05, value: 0.35, unit: 'm' },
      ]
    )
  }

  if (demo.category === 'e-m' || has(text, ['circuit', 'resistor', 'capacitor', 'inductor', 'current', 'voltage', 'charge'])) {
    return makeSpec(
      'circuit',
      'Circuit Model',
      'Change voltage and component values to estimate current and characteristic time scales.',
      [
        { key: 'voltage', label: 'Voltage', min: 1, max: 24, step: 0.5, value: 9, unit: 'V' },
        { key: 'resistance', label: 'Resistance', min: 1, max: 1000, step: 1, value: 220, unit: 'Ω' },
        { key: 'capacitance', label: 'Capacitance', min: 1, max: 1000, step: 1, value: 100, unit: 'µF' },
      ]
    )
  }

  if (has(text, ['electric', 'magnetic', 'field', 'lorentz', 'coulomb', 'force between'])) {
    return makeSpec(
      'field',
      'Field Interaction Model',
      'Change source strength and separation to estimate field strength and force trends.',
      [
        { key: 'sourceA', label: 'Source Strength A', min: 1, max: 20, step: 0.1, value: 5, unit: 'arb' },
        { key: 'sourceB', label: 'Source Strength B', min: 1, max: 20, step: 0.1, value: 5, unit: 'arb' },
        { key: 'distance', label: 'Separation', min: 0.1, max: 5, step: 0.05, value: 1.2, unit: 'm' },
      ]
    )
  }

  if (demo.category === 'fluids' || has(text, ['bernoulli', 'pressure', 'vortex', 'venturi', 'fluid'])) {
    return makeSpec(
      'fluid',
      'Fluid Flow Model',
      'Compare velocity, area, and density to estimate pressure differences and flow rate.',
      [
        { key: 'velocity', label: 'Flow Speed', min: 0.1, max: 20, step: 0.1, value: 4, unit: 'm/s' },
        { key: 'area', label: 'Tube Area', min: 0.1, max: 5, step: 0.1, value: 1.5, unit: 'cm²' },
        { key: 'density', label: 'Density', min: 100, max: 1500, step: 10, value: 1000, unit: 'kg/m³' },
      ]
    )
  }

  if (demo.category === 'thermo' || has(text, ['temperature', 'heat', 'gas', 'pressure', 'entropy', 'thermal'])) {
    return makeSpec(
      'thermo',
      'Thermal Model',
      'Vary temperature, amount of gas, and volume to compare pressure and thermal energy.',
      [
        { key: 'temperature', label: 'Temperature', min: 200, max: 700, step: 5, value: 300, unit: 'K' },
        { key: 'moles', label: 'Amount of Gas', min: 0.1, max: 5, step: 0.1, value: 1, unit: 'mol' },
        { key: 'volume', label: 'Volume', min: 1, max: 20, step: 0.2, value: 8, unit: 'L' },
      ]
    )
  }

  return makeSpec(
    'generic',
    'Parameter Model',
    'Use a simplified parameter study when the demonstration does not map cleanly to a single built-in model.',
    [
      { key: 'driver', label: 'Driver', min: 0, max: 10, step: 0.1, value: 5 },
      { key: 'response', label: 'Response Factor', min: 0.1, max: 10, step: 0.1, value: 2 },
      { key: 'loss', label: 'Loss Term', min: 0, max: 5, step: 0.1, value: 0.6 },
    ]
  )
}

export function buildSimulationForStorage(demo: DemoLike) {
  const spec = inferSimulationSpec(demo)
  return {
    simulation_type: spec.kind,
    simulation_config: spec,
  }
}
