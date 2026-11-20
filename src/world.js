import * as THREE from '../vendor/three.module.js'
import {
  clamp, rand, randInt, makeCanvas, canvasTexture, rayAABB, collidesCircle, resolveCircle,
} from './utils.js'
import {
  makeConcreteFloor, makeConcreteFloorRough, makeConcreteWall, makeContainer, makeWoodCrate,
  makeHazard, makeMetal, makeShadow, makeSmoke, makeGlow, makeScreen, makeSign, makePaper,
  makeEnvironment, makeBulletHole, makeBlood,
} from './textures.js'

const UP = new THREE.Vector3(0, 1, 0)

function boxGeo(w, h, d) {
  return new THREE.BoxGeometry(w, h, d)
}

export function buildWorld(scene, renderer) {
  const colliders = []
  const root = new THREE.Group()
  root.name = 'world'
  scene.add(root)

  scene.background = new THREE.Color(0x05070a)
  scene.fog = new THREE.FogExp2(0x06080b, 0.019)

  // Environment reflections
  const envTex = makeEnvironment()
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const envMap = pmrem.fromEquirectangular(envTex).texture
  scene.environment = envMap
  envTex.dispose()
  pmrem.dispose()

  const tex = {
    floor: makeConcreteFloor(),
    floorRough: makeConcreteFloorRough(),
    wall: makeConcreteWall(),
    crate: makeWoodCrate(),
    hazard: makeHazard(),
    metal: makeMetal(),
    shadow: makeShadow(),
    smoke: makeSmoke(),
    glow: makeGlow(),
    bullet: makeBulletHole(),
    blood: makeBlood(),
    screens: {
      lab: makeScreen('lab'),
      security: makeScreen('security'),
    },
    container: [
      makeContainer('#5a3b2c', 'TRANSCORP'),
      makeContainer('#324650', 'MERIDIAN'),
      makeContainer('#4e4a37', 'VANTAGE'),
      makeContainer('#4b3038', 'CIVIC FREIGHT'),
    ],
    paper: makePaper(),
    signs: {
      bay: makeSign(['BAY 04', 'RESTRICTED'], { bg: '#b6a33c', fg: '#171812', border: '#171812', size: 62 }),
      lab: makeSign(['LAB 03', 'AUTHORIZED ONLY'], { bg: '#b9b6a6', fg: '#1e211d', border: '#1e211d', size: 48 }),
      exfil: makeSign(['EXFIL', 'NORTH GATE'], { bg: '#1c2c20', fg: '#77ff9f', border: '#77ff9f', size: 64 }),
      caution: makeSign(['CAUTION', 'LIVE CIRCUIT'], { bg: '#c7a22c', fg: '#161712', border: '#161712', size: 54 }),
      noEntry: makeSign(['NO ENTRY', 'AUTHORIZED PERSONNEL'], { bg: '#a63a2e', fg: '#f0e9d6', border: '#f0e9d6', size: 42 }),
    },
  }

  const mat = {
    floor: new THREE.MeshStandardMaterial({
      map: tex.floor, roughnessMap: tex.floorRough, roughness: 0.86, metalness: 0.08, color: 0xa9aaa5,
    }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.92, metalness: 0.02, color: 0x9fa39f }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x272b2b, roughness: 0.9, metalness: 0.08 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x181b1d, roughness: 0.95, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ map: tex.metal, color: 0x8b9194, roughness: 0.52, metalness: 0.65 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x25292b, roughness: 0.55, metalness: 0.7 }),
    metalLight: new THREE.MeshStandardMaterial({ color: 0x737b7e, roughness: 0.4, metalness: 0.8 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.92, metalness: 0.02 }),
    crate: new THREE.MeshStandardMaterial({ map: tex.crate, roughness: 0.88, metalness: 0.03 }),
    hazard: new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.72, metalness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x7f9a9d, transparent: true, opacity: 0.18, roughness: 0.06, metalness: 0.1,
      transmission: 0.4, thickness: 0.03, depthWrite: false,
    }),
    screen: new THREE.MeshStandardMaterial({ map: tex.screens.lab, emissiveMap: tex.screens.lab, emissive: 0x7affab, emissiveIntensity: 0.85, roughness: 0.3 }),
    screenSec: new THREE.MeshStandardMaterial({ map: tex.screens.security, emissiveMap: tex.screens.security, emissive: 0x7affab, emissiveIntensity: 0.7, roughness: 0.3 }),
    paper: new THREE.MeshStandardMaterial({ map: tex.paper, roughness: 0.9, side: THREE.DoubleSide }),
    shadow: new THREE.MeshBasicMaterial({ map: tex.shadow, transparent: true, opacity: 0.75, depthWrite: false, color: 0x000000 }),
    puddle: new THREE.MeshPhysicalMaterial({ color: 0x060a0c, roughness: 0.08, metalness: 0.55, transparent: true, opacity: 0.82, envMapIntensity: 1.8 }),
  }

  const addBox = (w, h, d, x, y, z, material, opts = {}) => {
    const mesh = new THREE.Mesh(boxGeo(w, h, d), material)
    mesh.position.set(x, y, z)
    if (opts.rot) mesh.rotation.y = opts.rot
    root.add(mesh)
    if (opts.collider !== false) {
      const rw = Math.abs(Math.cos(opts.rot || 0)) * w + Math.abs(Math.sin(opts.rot || 0)) * d
      const rd = Math.abs(Math.cos(opts.rot || 0)) * d + Math.abs(Math.sin(opts.rot || 0)) * w
      addCollider(x, z, rw, rd, y - h / 2, y + h / 2, opts.tag)
    }
    return mesh
  }

  const addCollider = (cx, cz, w, d, minY = 0, maxY = 8, tag = 'solid') => {
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY, maxY, tag })
  }

  const addShadow = (x, z, w, d, opacity = 0.75) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.shadow.clone())
    m.material.opacity = opacity
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.012, z)
    m.renderOrder = 1
    root.add(m)
    return m
  }

  const addDecal = (tex2, x, y, z, w, h, rotY = 0, opacity = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: tex2, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }))
    m.position.set(x, y, z)
    m.rotation.y = rotY
    root.add(m)
    return m
  }

  // ---------------------------------------------------------------------------
  // Shell: floor, ceiling, walls
  // ---------------------------------------------------------------------------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 60), mat.floor)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, 0)
  root.add(floor)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(50, 60), mat.ceiling)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, 9, 0)
  root.add(ceiling)

  addBox(50, 9, 0.6, 0, 4.5, 30.3, mat.wall)
  addBox(50, 9, 0.6, 0, 4.5, -30.3, mat.wall)
  addBox(0.6, 9, 60, -25.3, 4.5, 0, mat.wall)
  addBox(0.6, 9, 60, 25.3, 4.5, 0, mat.wall)

  // Concrete pilasters
  for (let z = -27; z <= 27; z += 9) {
    addBox(0.55, 9, 0.75, -24.8, 4.5, z, mat.wallDark)
    addBox(0.55, 9, 0.75, 24.8, 4.5, z, mat.wallDark)
  }

  // Roof trusses
  for (let z = -28; z <= 28; z += 7) {
    addBox(49.5, 0.24, 0.22, 0, 8.55, z, mat.metalDark, { collider: false })
    for (let x = -22; x <= 22; x += 8.8) {
      addBox(0.12, 0.8, 0.12, x, 8.15, z, mat.metalDark, { collider: false })
    }
  }
  for (const x of [-20, -10, 0, 10, 20]) {
    addBox(0.22, 0.22, 59.5, x, 8.72, 0, mat.metalDark, { collider: false })
  }

  // Overhead pipes
  for (let i = 0; i < 7; i++) {
    const y = 8.0 + i * 0.08
    const x = -22 + i * 0.55
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 59, 8), i % 3 === 0 ? mat.metal : mat.metalDark)
    p.rotation.x = Math.PI / 2
    p.position.set(x, y, 0)
    root.add(p)
  }
  for (let z = -22; z <= 22; z += 11) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 48, 8), mat.metalDark)
    p.rotation.z = Math.PI / 2
    p.position.set(0, 8.1, z)
    root.add(p)
  }

  // ---------------------------------------------------------------------------
  // Lights
  // ---------------------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xa4bdd8, 0x221c15, 1.1))
  scene.add(new THREE.AmbientLight(0x3a4a5c, 1.15))

  const lights = []
  const lightMats = []
  const lightPositions = [
    [0, 7.45, 20], [0, 7.45, 8], [0, 7.45, -4], [0, 7.45, -16], [0, 7.45, -25],
  ]
  for (let i = 0; i < lightPositions.length; i++) {
    const [x, y, z] = lightPositions[i]
    if (i % 2 === 0) {
      const light = new THREE.PointLight(0xbdd6ff, 120, 30, 2)
      light.position.set(x, y, z)
      light.userData.base = 120
      light.userData.phase = rand(0, 10)
      light.userData.flicker = i === 2
      scene.add(light)
      lights.push(light)
    }

    const housing = new THREE.Mesh(boxGeo(3.1, 0.13, 0.46), mat.metalDark)
    housing.position.set(x, 8.16, z)
    root.add(housing)
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xdcecff, emissive: 0xb7d4ff, emissiveIntensity: 3.4, roughness: 0.4,
    })
    lightMats.push(tubeMat)
    const tube = new THREE.Mesh(boxGeo(2.85, 0.055, 0.22), tubeMat)
    tube.position.set(x, 8.08, z)
    root.add(tube)
    // wire
    addBox(0.04, 0.75, 0.04, x - 0.8, 8.5, z, mat.metalDark, { collider: false })
    addBox(0.04, 0.75, 0.04, x + 0.8, 8.5, z, mat.metalDark, { collider: false })

    // haze
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.smoke, color: 0x8fb6e8, transparent: true, opacity: 0.05, depthWrite: false,
    }))
    haze.position.set(x, 6.8, z)
    haze.scale.set(12, 8, 1)
    root.add(haze)
  }

  // Wall cage lamps (warm)
  const cageMat = new THREE.MeshStandardMaterial({ color: 0xffd28c, emissive: 0xffb24d, emissiveIntensity: 2.2, roughness: 0.4 })
  const warmLights = []
  for (const [x, z] of [[-23.8, 13], [23.8, 13], [-23.8, -20], [23.8, -20]]) {
    const g = new THREE.Group()
    g.position.set(x, 4.2, z)
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.32, 12, 1, true), mat.metalDark)
    shade.rotation.x = Math.PI
    g.add(shade)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), cageMat)
    bulb.position.y = -0.13
    g.add(bulb)
    root.add(g)
    if (z > 0 || x < 0) {
      const pl = new THREE.PointLight(0xffa850, 24, 12, 2)
      pl.position.set(x + (x > 0 ? -0.8 : 0.8), 4.0, z)
      pl.userData.base = 24
      pl.userData.phase = rand(0, 10)
      scene.add(pl)
      warmLights.push(pl)
    }
  }

  // Red emergency light near north gate
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff3d32, emissive: 0xff1c12, emissiveIntensity: 2.6, roughness: 0.5 })
  for (const x of [-5.6, 5.6]) {
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.26, 10), redMat)
    beacon.position.set(x, 6.4, -29.6)
    root.add(beacon)
  }

  // ---------------------------------------------------------------------------
  // Ceiling signs and wall dressing
  // ---------------------------------------------------------------------------
  const signMat = (map, emissive = false) => new THREE.MeshStandardMaterial({
    map, roughness: 0.72, metalness: 0.05,
    emissiveMap: emissive ? map : null, emissive: emissive ? 0x6bff96 : 0x000000, emissiveIntensity: emissive ? 0.65 : 0,
  })
  const addWallSign = (texture, x, y, z, w, h, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMat(texture))
    m.position.set(x, y, z)
    m.rotation.y = rotY
    root.add(m)
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h + 0.1), new THREE.MeshBasicMaterial({ color: 0x101211 }))
    frame.position.set(x, y, z)
    frame.rotation.y = rotY
    frame.translateZ(-0.012)
    root.add(frame)
  }
  addWallSign(tex.signs.bay, -24.95, 5.5, 17, 3.2, 1.6, Math.PI / 2)
  addWallSign(tex.signs.lab, -14.36, 2.7, -12.2, 2.2, 1.1, Math.PI / 2)
  addWallSign(tex.signs.caution, 24.95, 4.7, -2, 2.6, 1.3, -Math.PI / 2)
  addWallSign(tex.signs.noEntry, 24.95, 3.2, 21, 2.2, 1.1, -Math.PI / 2)
  addWallSign(tex.signs.exfil, 0, 6.3, -29.96, 3.8, 1.9, 0)
  const exfilSignMat = root.children[root.children.length - 2].material
  exfilSignMat.emissive = new THREE.Color(0x62ff90)
  exfilSignMat.emissiveIntensity = 1.1
  exfilSignMat.emissiveMap = tex.signs.exfil

  // Arrow floor decals
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x9a8b3d, transparent: true, opacity: 0.55, depthWrite: false })
  for (const [x, z] of [[0, 15], [0, 2], [0, -13]]) {
    for (let i = 0; i < 3; i++) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.4), arrowMat)
      a.rotation.x = -Math.PI / 2
      a.position.set(x, 0.014, z - i * 1.0)
      root.add(a)
    }
  }

  // ---------------------------------------------------------------------------
  // Containers
  // ---------------------------------------------------------------------------
  const containerSpecs = [
    [-13.4, 18.6, 6.1, 2.6, 2.5, 0, 0],
    [11.8, 20.4, 6.1, 2.6, 2.5, 0, 1],
    [-11.6, 10.3, 2.5, 2.6, 6.1, 0, 2],
    [13.4, 8.6, 6.1, 2.6, 2.5, 0, 0],
    [-18.2, 1.6, 6.1, 2.6, 2.5, 0, 3],
    [8.8, -1.4, 2.5, 2.6, 6.1, 0, 1],
    [-8.9, -15.7, 6.1, 2.6, 2.5, 0, 2],
    [14.6, -16.5, 6.1, 2.6, 2.5, 0, 3],
    [20.4, -2.0, 2.5, 2.6, 6.1, 0, 1],
    [-20.6, 10.4, 2.5, 2.6, 6.1, 0, 0],
  ]
  const containerMeshes = []
  for (const [x, z, w, h, d, rot, ci] of containerSpecs) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = rot
    const containerMat = new THREE.MeshStandardMaterial({
      map: tex.container[ci], roughness: 0.7, metalness: 0.45, color: 0xc6c6c0,
    })
    const body = new THREE.Mesh(boxGeo(w, h, d), containerMat)
    body.position.y = h / 2
    g.add(body)
    const roof = new THREE.Mesh(boxGeo(w + 0.08, 0.12, d + 0.08), mat.metalDark)
    roof.position.y = h + 0.04
    g.add(roof)
    // Corner castings
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(boxGeo(0.17, h + 0.1, 0.17), mat.metalDark)
      post.position.set(sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08))
      g.add(post)
    }
    // Door locking bars
    const barMat = mat.metalLight
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h * 0.8, 6), barMat)
      bar.position.set(w / 2 + 0.015, h / 2, -d * 0.3 + i * d * 0.2)
      g.add(bar)
    }
    root.add(g)
    const rw = Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d
    const rd = Math.abs(Math.cos(rot)) * d + Math.abs(Math.sin(rot)) * w
    addCollider(x, z, rw, rd, 0, h)
    addShadow(x, z, rw + 1.2, rd + 1.2, 0.65)
    containerMeshes.push(g)
  }

  // Stacked containers (visual + upper collider)
  const stacked = [
    [11.8, 20.4, 6.1, 2.6, 2.5, 0, 2],
    [-8.9, -15.7, 6.1, 2.6, 2.5, 0, 0],
  ]
  for (const [x, z, w, h, d, rot, ci] of stacked) {
    const g = new THREE.Group()
    g.position.set(x, 2.6, z)
    g.rotation.y = rot
    const containerMat = new THREE.MeshStandardMaterial({
      map: tex.container[ci], roughness: 0.7, metalness: 0.45, color: 0xbabbb5,
    })
    const body = new THREE.Mesh(boxGeo(w, h, d), containerMat)
    body.position.y = h / 2
    g.add(body)
    const roof = new THREE.Mesh(boxGeo(w + 0.08, 0.12, d + 0.08), mat.metalDark)
    roof.position.y = h + 0.04
    g.add(roof)
    root.add(g)
  }

  // ---------------------------------------------------------------------------
  // Crates, pallets, barrels
  // ---------------------------------------------------------------------------
  const crateSpecs = [
    [-3.7, 21.0, 1.4, 1.2, 1.4, 0.1], [-2.3, 21.2, 1.1, 1.0, 1.1, -0.05],
    [-3.7, 21.0, 1.2, 1.0, 1.2, 0.3, 1.2],
    [4.3, 17.2, 1.5, 1.3, 1.5, 0.2], [5.8, 17.0, 1.0, 0.9, 1.0, -0.2],
    [-4.9, 7.6, 1.3, 1.2, 1.3, 0.15], [-18.4, 7.7, 1.1, 1.0, 1.1, 0.5],
    [4.8, 1.4, 1.4, 1.2, 1.4, -0.1], [5.8, 1.3, 1.0, 0.9, 1.0, 0.2],
    [17.8, 12.6, 1.3, 1.2, 1.3, 0.4], [19.0, 12.5, 1.0, 0.8, 1.0, -0.1],
    [-17.9, -17.7, 1.4, 1.3, 1.4, 0.1], [3.1, -20.4, 1.2, 1.0, 1.2, 0.3],
    [20.3, -22.0, 1.5, 1.2, 1.5, -0.2], [21.0, -20.9, 1.0, 0.8, 1.0, 0.1],
    [-21.5, 19.3, 1.1, 1.0, 1.1, 0.2],
  ]
  const crateMeshes = []
  for (const [x, z, w, h, d, rot, yy = 0] of crateSpecs) {
    const mesh = new THREE.Mesh(boxGeo(w, h, d), mat.crate)
    mesh.position.set(x, h / 2 + yy, z)
    mesh.rotation.y = rot
    root.add(mesh)
    const rw = Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d
    const rd = Math.abs(Math.cos(rot)) * d + Math.abs(Math.sin(rot)) * w
    addCollider(x, z, rw, rd, yy, yy + h)
    if (yy === 0) addShadow(x, z, rw + 0.5, rd + 0.5, 0.6)
    crateMeshes.push(mesh)
  }

  // Wooden pallets
  for (let i = 0; i < 8; i++) {
    const x = rand(-22, 22)
    const z = rand(-25, 25)
    if (collidesCircle(x, z, 0.8, colliders)) continue
    const pallet = new THREE.Group()
    for (let j = 0; j < 4; j++) {
      const slat = new THREE.Mesh(boxGeo(1.5, 0.06, 0.18), mat.crate)
      slat.position.set(0, 0.12, -0.55 + j * 0.36)
      pallet.add(slat)
    }
    for (const sx of [-0.6, 0.6]) {
      const runner = new THREE.Mesh(boxGeo(0.15, 0.1, 1.4), mat.crate)
      runner.position.set(sx, 0.05, 0)
      pallet.add(runner)
    }
    pallet.position.set(x, 0, z)
    pallet.rotation.y = rand(-0.4, 0.4)
    root.add(pallet)
  }

  const barrelMats = [
    new THREE.MeshStandardMaterial({ color: 0x3b4f42, roughness: 0.7, metalness: 0.45 }),
    new THREE.MeshStandardMaterial({ color: 0x6b3a24, roughness: 0.75, metalness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x2e3d4f, roughness: 0.65, metalness: 0.5 }),
  ]
  const barrelPositions = [
    [-21.3, 4.6], [-20.2, 4.2], [-21.6, 3.4], [7.2, 13.2], [6.5, 12.6],
    [-6.3, -19.7], [-7.3, -20.3], [18.4, -7.3], [19.1, -6.6], [-16.3, -11.2],
  ]
  for (let i = 0; i < barrelPositions.length; i++) {
    const [x, z] = barrelPositions[i]
    const g = new THREE.Group()
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.92, 14), barrelMats[i % 3])
    barrel.position.y = 0.46
    g.add(barrel)
    for (const yy of [0.25, 0.68]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.025, 6, 16), mat.metalDark)
      ring.rotation.x = Math.PI / 2
      ring.position.y = yy
      g.add(ring)
    }
    g.position.set(x, 0, z)
    g.rotation.y = rand(0, 6.28)
    root.add(g)
    addCollider(x, z, 0.7, 0.7, 0, 0.95)
    addShadow(x, z, 1.1, 1.1, 0.55)
  }

  // ---------------------------------------------------------------------------
  // Lab
  // ---------------------------------------------------------------------------
  addBox(0.28, 3.2, 3.6, -14.5, 1.6, -12.2, mat.wallDark)
  addBox(0.28, 3.2, 3.7, -14.5, 1.6, -6.2, mat.wallDark)
  addBox(0.28, 0.7, 2.5, -14.5, 2.85, -9.2, mat.wallDark)
  addBox(2.2, 0.16, 6.0, -14.5, 3.2, -9.2, mat.metalDark, { collider: false })

  // Lab counter
  addBox(1.25, 1.0, 6.6, -23.0, 0.5, -9.2, mat.metal)
  addBox(1.45, 0.08, 6.8, -23.0, 1.04, -9.2, mat.metalLight, { collider: false })
  for (let z = -12.1; z <= -6.4; z += 1.2) {
    addBox(1.1, 0.6, 0.04, -23.0, 0.42, z, mat.metalDark, { collider: false })
    addBox(0.18, 0.03, 0.03, -22.55, 0.55, z, mat.metalLight, { collider: false })
  }
  addShadow(-22.4, -9.2, 3.1, 7.6, 0.6)

  // Laptop / intel
  const laptop = new THREE.Group()
  laptop.position.set(-22.55, 1.08, -9.0)
  laptop.rotation.y = 0.5
  const base = new THREE.Mesh(boxGeo(0.62, 0.035, 0.44), mat.metalDark)
  base.position.y = 0.02
  laptop.add(base)
  const lid = new THREE.Group()
  lid.position.set(0, 0.035, -0.2)
  lid.rotation.x = -0.34
  const lidMesh = new THREE.Mesh(boxGeo(0.62, 0.42, 0.025), mat.metalDark)
  lidMesh.position.y = 0.21
  lid.add(lidMesh)
  const laptopScreenMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: tex.screens.lab, emissiveMap: tex.screens.lab, emissive: 0x5aff9c, emissiveIntensity: 1.3, roughness: 0.25,
  })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.33), laptopScreenMat)
  screen.position.set(0, 0.21, 0.015)
  lid.add(screen)
  laptop.add(lid)
  // keyboard
  const kb = new THREE.Mesh(boxGeo(0.54, 0.008, 0.3), new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.7 }))
  kb.position.set(0, 0.043, 0.02)
  laptop.add(kb)
  root.add(laptop)
  const laptopLight = new THREE.PointLight(0x58ff9c, 3.5, 4.5, 2)
  laptopLight.position.set(-22.3, 1.55, -8.8)
  scene.add(laptopLight)

  // Fume hood
  const hood = new THREE.Group()
  hood.position.set(-23.2, 0, -5.2)
  const hoodBody = new THREE.Mesh(boxGeo(1.8, 2.35, 1.5), mat.metal)
  hoodBody.position.y = 1.18
  hood.add(hoodBody)
  const hoodGlass = new THREE.Mesh(boxGeo(1.62, 1.0, 0.03), mat.glass)
  hoodGlass.position.set(0, 1.55, 0.76)
  hood.add(hoodGlass)
  const hoodLight = new THREE.Mesh(boxGeo(1.35, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0xc4ffd8, emissive: 0x78ffb0, emissiveIntensity: 2.6 }))
  hoodLight.position.set(0, 2.1, 0.55)
  hood.add(hoodLight)
  root.add(hood)
  addCollider(-23.2, -5.2, 1.9, 1.6, 0, 2.4)
  addShadow(-23.2, -5.2, 2.8, 2.5, 0.6)

  // Lab tables and equipment
  addBox(2.4, 0.9, 1.0, -18.0, 0.45, -9.4, mat.metal)
  addBox(2.55, 0.07, 1.12, -18.0, 0.93, -9.4, mat.metalLight, { collider: false })
  addCollider(-18.0, -9.4, 2.55, 1.12, 0, 1.0)
  for (let i = 0; i < 5; i++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, rand(0.18, 0.34), 8), barrelMats[i % 3])
    bottle.position.set(-18.8 + i * 0.35, 1.12, -9.35 + rand(-0.25, 0.25))
    root.add(bottle)
  }
  // Monitor on lab table
  const labMon = new THREE.Group()
  labMon.position.set(-17.4, 1.0, -9.6)
  labMon.rotation.y = 0.3
  const monStand = new THREE.Mesh(boxGeo(0.06, 0.26, 0.06), mat.metalDark)
  monStand.position.y = 0.13
  labMon.add(monStand)
  const monBody = new THREE.Mesh(boxGeo(0.62, 0.4, 0.05), mat.metalDark)
  monBody.position.y = 0.42
  labMon.add(monBody)
  const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), mat.screen)
  monScreen.position.set(0, 0.42, 0.03)
  labMon.add(monScreen)
  root.add(labMon)

  // Lab wall screens
  const wallScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15), mat.screen)
  wallScreen.position.set(-24.92, 2.55, -9.1)
  wallScreen.rotation.y = Math.PI / 2
  root.add(wallScreen)
  

  // Hazard floor in lab
  addDecal(tex.hazard, -17.5, 0.016, -6.8, 3.5, 0.6, 0, 0.5)

  // ---------------------------------------------------------------------------
  // Office / security room
  // ---------------------------------------------------------------------------
  addBox(0.28, 3.0, 3.6, 14.5, 1.5, -12.2, mat.wallDark)
  addBox(0.28, 3.0, 3.7, 14.5, 1.5, -6.2, mat.wallDark)
  addBox(0.28, 0.6, 2.5, 14.5, 2.7, -9.2, mat.wallDark)

  addBox(3.0, 0.9, 1.3, 18.3, 0.45, -8.0, mat.metal)
  addBox(3.15, 0.08, 1.45, 18.3, 0.94, -8.0, mat.metalLight, { collider: false })
  addCollider(18.3, -8.0, 3.15, 1.45, 0, 1.0)
  addShadow(18.3, -8.0, 3.8, 2.1, 0.55)
  // Office chairs
  for (const [x, z, rot] of [[16.7, -6.7, 0.3], [20.0, -10.0, -0.4]]) {
    const chair = new THREE.Group()
    const seat = new THREE.Mesh(boxGeo(0.55, 0.09, 0.55), mat.rubber)
    seat.position.y = 0.48
    chair.add(seat)
    const back = new THREE.Mesh(boxGeo(0.55, 0.65, 0.09), mat.rubber)
    back.position.set(0, 0.82, 0.27)
    back.rotation.x = -0.08
    chair.add(back)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 8), mat.metalDark)
    stem.position.y = 0.24
    chair.add(stem)
    chair.position.set(x, 0, z)
    chair.rotation.y = rot
    root.add(chair)
    addCollider(x, z, 0.6, 0.6, 0, 0.95)
  }
  // Monitors
  for (const [x, z, rot] of [[17.2, -8.0, 0.2], [19.4, -8.0, -0.15]]) {
    const mon = new THREE.Group()
    mon.position.set(x, 1.0, z)
    mon.rotation.y = rot
    const stand = new THREE.Mesh(boxGeo(0.08, 0.3, 0.08), mat.metalDark)
    stand.position.y = 0.15
    mon.add(stand)
    const body = new THREE.Mesh(boxGeo(0.78, 0.48, 0.06), mat.metalDark)
    body.position.y = 0.52
    mon.add(body)
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.4), mat.screenSec)
    scr.position.set(0, 0.52, 0.035)
    mon.add(scr)
    root.add(mon)
  }
  // Filing cabinets
  for (let i = 0; i < 3; i++) {
    addBox(0.6, 1.45, 0.6, 23.2, 0.725, -11.8 + i * 0.7, mat.metal)
    addBox(0.02, 0.04, 0.4, 22.88, 1.0, -11.8 + i * 0.7, mat.metalLight, { collider: false })
  }
  addShadow(23.2, -11.1, 1.2, 2.6, 0.5)
  addWallSign(tex.signs.noEntry, 14.36, 2.45, -9.2, 2.0, 1.0, Math.PI / 2)

  // ---------------------------------------------------------------------------
  // Catwalk along west wall
  // ---------------------------------------------------------------------------
  const catwalk = new THREE.Group()
  for (let z = -22; z <= 18; z += 2.5) {
    const plank = new THREE.Mesh(boxGeo(1.6, 0.1, 2.3), mat.metal)
    plank.position.set(-23.3, 4.2, z)
    catwalk.add(plank)
  }
  for (let z = -23; z <= 20; z += 4.5) {
    const post = new THREE.Mesh(boxGeo(0.12, 1.15, 0.12), mat.metalDark)
    post.position.set(-22.55, 4.82, z)
    catwalk.add(post)
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6), mat.metalLight)
    rail.position.set(-22.55, 4.82, z)
    catwalk.add(rail)
  }
  for (let z = -24; z <= 20; z += 6) {
    const support = new THREE.Mesh(boxGeo(0.18, 4.2, 0.18), mat.metalDark)
    support.position.set(-22.6, 2.1, z)
    catwalk.add(support)
    addCollider(-22.6, z, 0.25, 0.25, 0, 4.2)
  }
  const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 42, 8), mat.metalLight)
  topRail.rotation.x = Math.PI / 2
  topRail.position.set(-22.55, 5.4, -2)
  catwalk.add(topRail)
  root.add(catwalk)

  // ---------------------------------------------------------------------------
  // North gate / extraction
  // ---------------------------------------------------------------------------
  addBox(8.2, 6.4, 0.24, 0, 3.2, -29.92, mat.metalDark)
  const gateMat = new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.7, metalness: 0.3, color: 0x777777 })
  for (let i = 0; i < 12; i++) {
    const slat = new THREE.Mesh(boxGeo(8.0, 0.34, 0.1), i % 2 ? gateMat : mat.metal)
    slat.position.set(0, 0.3 + i * 0.44, -29.76)
    root.add(slat)
  }
  addDecal(tex.hazard, 0, 0.018, -27.8, 7.4, 0.9, 0, 0.7)
  addDecal(tex.hazard, 0, 0.018, 26.5, 7.4, 0.9, 0, 0.55)

  const exfil = {
    position: new THREE.Vector3(0, 0, -26.0),
    radius: 2.8,
    active: false,
    completed: false,
    group: new THREE.Group(),
    light: null,
    ring: null,
    smoke: [],
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3aff83, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.5, 48), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.set(0, 0.02, -26)
  exfil.group.add(ring)
  exfil.ring = ring
  const exfilLight = new THREE.PointLight(0x49ff8e, 0, 14, 2)
  exfilLight.position.set(0, 2.2, -26)
  scene.add(exfilLight)
  exfil.light = exfilLight
  // flares
  const flareMat = new THREE.MeshStandardMaterial({ color: 0x7dffab, emissive: 0x31ff78, emissiveIntensity: 3, roughness: 0.4 })
  for (const x of [-2.3, 2.3]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.36, 6), flareMat)
    stick.position.set(x, 0.18, -26.4)
    root.add(stick)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0x62ff98, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.position.set(x, 0.35, -26.4)
    glow.scale.set(1.2, 1.2, 1)
    glow.userData.flare = true
    exfil.group.add(glow)
  }
  scene.add(exfil.group)
  // Smoke puffs at exfil
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.smoke, color: 0x4eff8b, transparent: true, opacity: 0, depthWrite: false,
    }))
    s.position.set(rand(-1.5, 1.5), rand(0.1, 2.0), -26 + rand(-1.2, 1.2))
    s.scale.setScalar(rand(1.4, 2.6))
    s.userData = { phase: rand(0, 6.28), speed: rand(0.2, 0.5), baseX: s.position.x, baseZ: s.position.z, baseY: rand(0.2, 1.6) }
    root.add(s)
    exfil.smoke.push(s)
  }

  // Crates flanking gate
  for (const [x, z] of [[-5.1, -25.8], [5.2, -25.2]]) {
    const mesh = new THREE.Mesh(boxGeo(1.6, 1.3, 1.6), mat.crate)
    mesh.position.set(x, 0.65, z)
    mesh.rotation.y = rand(-0.2, 0.2)
    root.add(mesh)
    addCollider(x, z, 1.6, 1.6, 0, 1.3)
    addShadow(x, z, 2.3, 2.3, 0.55)
  }

  // ---------------------------------------------------------------------------
  // Puddles and debris
  // ---------------------------------------------------------------------------
  const puddleGeo = new THREE.CircleGeometry(1, 28)
  for (const [x, z, sx, sz] of [
    [-6.8, 5.2, 2.2, 1.0], [7.5, -8.4, 1.8, 1.3], [-2.6, -20.0, 1.4, 0.8],
    [16.8, 3.2, 1.0, 2.2], [-17.4, 14.2, 1.6, 1.0], [3.2, 12.0, 1.1, 0.7],
  ]) {
    const p = new THREE.Mesh(puddleGeo, mat.puddle)
    p.rotation.x = -Math.PI / 2
    p.position.set(x, 0.008, z)
    p.scale.set(sx, sz, 1)
    root.add(p)
  }

  // Scattered papers
  for (let i = 0; i < 28; i++) {
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.38), mat.paper)
    paper.rotation.x = -Math.PI / 2
    paper.rotation.z = rand(0, 6.28)
    paper.position.set(rand(-22, 22), 0.016, rand(-25, 25))
    root.add(paper)
  }

  // Shell casings and small debris
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xa68139, roughness: 0.35, metalness: 0.8 })
  for (let i = 0; i < 30; i++) {
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.045, 6), brassMat)
    casing.rotation.x = Math.PI / 2
    casing.rotation.z = rand(0, 6.28)
    casing.position.set(rand(-21, 21), 0.02, rand(-25, 24))
    root.add(casing)
  }

  // ---------------------------------------------------------------------------
  // Dust motes
  // ---------------------------------------------------------------------------
  const dustCount = 460
  const dustGeo = new THREE.BufferGeometry()
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = rand(-24, 24)
    dustPos[i * 3 + 1] = rand(0.2, 8.5)
    dustPos[i * 3 + 2] = rand(-29, 29)
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dustMat = new THREE.PointsMaterial({
    color: 0xa8bed6, size: 0.028, transparent: true, opacity: 0.36,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  })
  const dust = new THREE.Points(dustGeo, dustMat)
  root.add(dust)

  // ---------------------------------------------------------------------------
  // Interaction target / objective markers
  // ---------------------------------------------------------------------------
  const intel = {
    position: new THREE.Vector3(-22.55, 1.1, -9.0),
    radius: 2.2,
    collected: false,
    prompt: 'RECOVER THE MANIFEST',
    laptop,
    screenMat: laptopScreenMat,
    light: laptopLight,
    baseY: 1.08,
  }

  // small floating locator chevron (only visible when close / objective)
  const marker = new THREE.Group()
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.0, depthWrite: false })
  const chev = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), markerMat)
  chev.rotation.z = Math.PI
  marker.add(chev)
  marker.position.set(-22.55, 2.1, -9.0)
  root.add(marker)
  intel.marker = marker
  intel.markerMat = markerMat

  // Bullet impact pools
  const impactPool = []
  for (let i = 0; i < 42; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({
      map: tex.bullet, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    }))
    m.visible = false
    m.renderOrder = 3
    scene.add(m)
    impactPool.push({ mesh: m, life: 0 })
  }
  let impactIndex = 0

  const bloodPool = []
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: tex.blood, transparent: true, depthWrite: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4,
    }))
    m.rotation.x = -Math.PI / 2
    m.visible = false
    m.renderOrder = 2
    scene.add(m)
    bloodPool.push({ mesh: m, life: 0 })
  }
  let bloodIndex = 0

  const addImpact = (point, normal) => {
    const item = impactPool[impactIndex++ % impactPool.length]
    item.mesh.position.copy(point).addScaledVector(normal, 0.012)
    item.mesh.lookAt(point.clone().add(normal))
    item.mesh.rotation.z = rand(0, 6.28)
    item.mesh.scale.setScalar(rand(0.65, 1.3))
    item.mesh.visible = true
    item.life = 26
  }

  const addBloodPool = (point) => {
    const item = bloodPool[bloodIndex++ % bloodPool.length]
    item.mesh.position.set(point.x, 0.018, point.z)
    item.mesh.rotation.z = rand(0, 6.28)
    item.mesh.scale.setScalar(rand(0.7, 1.4))
    item.mesh.visible = true
    item.mesh.material.opacity = 0.85
    item.life = 999
  }

  // ---------------------------------------------------------------------------
  // Raycast + updates
  // ---------------------------------------------------------------------------
  const raycast = (origin, dir, maxDist = 120) => {
    let best = { dist: maxDist, normal: null, point: null, type: 'none' }
    if (dir.y < -0.0001) {
      const t = -origin.y / dir.y
      if (t > 0.01 && t < best.dist) {
        best = { dist: t, normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3().copy(origin).addScaledVector(dir, t), type: 'floor' }
      }
    }
    if (dir.y > 0.0001) {
      const t = (9 - origin.y) / dir.y
      if (t > 0.01 && t < best.dist) {
        best = { dist: t, normal: new THREE.Vector3(0, -1, 0), point: new THREE.Vector3().copy(origin).addScaledVector(dir, t), type: 'ceiling' }
      }
    }
    for (const c of colliders) {
      if (c.minY > origin.y && c.minY - origin.y > maxDist) continue
      const hit = rayAABB(origin, dir, c)
      if (!hit || hit.t <= 0.02 || hit.t >= best.dist) continue
      best = {
        dist: hit.t,
        normal: hit.normal,
        point: new THREE.Vector3().copy(origin).addScaledVector(dir, hit.t),
        type: c.tag,
      }
    }
    return best
  }

  const update = (t, dt, playerPos) => {
    // Light flicker
    for (const light of lights) {
      if (light.userData.flicker) {
        const p = light.userData.phase
        const f = Math.sin(t * 13 + p) > 0.92 || Math.sin(t * 27 + p * 2) > 0.985 ? 0.15 : 1
        light.intensity = light.userData.base * f
      }
    }
    for (const light of warmLights) {
      light.intensity = light.userData.base * (0.92 + Math.sin(t * 3.1 + light.userData.phase) * 0.06)
    }
    for (const m of lightMats) {
      m.emissiveIntensity = 3.1 + Math.sin(t * 9) * 0.08
    }
    // Dust
    const pos = dust.geometry.attributes.position
    for (let i = 0; i < dustCount; i++) {
      let y = pos.getY(i) + dt * (0.025 + (i % 7) * 0.004)
      let x = pos.getX(i) + Math.sin(t * 0.2 + i) * dt * 0.01
      if (y > 8.6) y = 0.2
      pos.setY(i, y)
      pos.setX(i, x)
    }
    pos.needsUpdate = true

    // Intel marker pulse
    if (!intel.collected) {
      intel.marker.rotation.y += dt * 1.6
      intel.marker.position.y = 2.0 + Math.sin(t * 2.4) * 0.08
      const dist = playerPos ? playerPos.distanceTo(intel.position) : 99
      intel.markerMat.opacity = clamp((10 - dist) / 10, 0, 1) * 0.75
      intel.light.intensity = 3.5 + Math.sin(t * 5) * 0.6
      intel.screenMat.emissiveIntensity = 1.15 + Math.sin(t * 2.5) * 0.15
    } else {
      intel.markerMat.opacity = 0
      intel.screenMat.emissive.setHex(0xffa33d)
      intel.screenMat.emissiveIntensity = 0.4
    }

    // Exfil
    exfil.ring.material.opacity = exfil.active ? 0.38 + Math.sin(t * 4) * 0.18 : 0.03
    exfil.light.intensity = exfil.active ? 9 + Math.sin(t * 4) * 3 : 0
    for (const s of exfil.smoke) {
      const u = s.userData
      s.position.y += dt * u.speed
      if (s.position.y > 5.5) {
        s.position.y = 0.1
        s.position.x = rand(-1.6, 1.6)
        s.position.z = -26 + rand(-1.2, 1.2)
      }
      s.material.opacity = exfil.active ? clamp(0.17 - s.position.y * 0.02, 0, 0.18) : 0
      s.position.x = u.baseX + Math.sin(t * 0.4 + u.phase) * 0.5
    }
    for (const child of exfil.group.children) {
      if (child.userData.flare) {
        child.material.opacity = exfil.active ? 0.75 + Math.sin(t * 7) * 0.2 : 0
      }
    }

    // Impacts fade
    for (const item of impactPool) {
      if (item.life > 0) {
        item.life -= dt
        if (item.life <= 0) item.mesh.visible = false
      }
    }
    for (const item of bloodPool) {
      if (item.life > 0 && item.life < 900) {
        item.life -= dt
        if (item.life <= 0) item.mesh.visible = false
      }
    }
  }

  return {
    root,
    colliders,
    lights,
    intel,
    exfil,
    raycast,
    addImpact,
    addBloodPool,
    update,
    materials: mat,
    textures: tex,
    collidesCircle: (x, z, r, feetY = 0, headY = 1.8) => collidesCircle(x, z, r, colliders, feetY, headY),
    resolveCircle: (x, z, r, feetY = 0, headY = 1.8) => resolveCircle(x, z, r, colliders, feetY, headY),
  }
}
