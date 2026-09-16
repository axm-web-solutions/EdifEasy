import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { GlassTowers } from './GlassTowers'

/**
 * Torres de cristal en 3D con camara cinematografica.
 *
 * Sustituye la ilustracion estatica SVG por una escena WebGL de Three.js que
 * recorre el edificio en distintos "tomas": contrapicado bajo, lateral, aerea
 * y un dolly que sube hacia el cielo. La camara sigue una spline Catmull-Rom
 * cerrada sobre los mismos ejes de la ilustracion original.
 *
 * Carga diferida (React.lazy) desde AuthLayout para no inflar el bundle de la
 * app autenticada con Three.js.
 *
 * Si WebGL no esta disponible (o el ancho es < 1024px, donde el panel del auth
 * se oculta), se cae al GlassTowers SVG estatico sin romper la pagina.
 */
export function GlassTowers3D({ className }: { className?: string }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isDesktop) return
    if (!containerRef.current) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      setFailed(true)
      return
    }

    const container = containerRef.current
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    container.appendChild(renderer.domElement)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xbfd3f2, 34, 150)

    const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 500)

    // --- Cielo -----------------------------------------------------------
    function makeSkyTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas')
      canvas.width = 4
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 128)
        gradient.addColorStop(0, '#ffffff')
        gradient.addColorStop(0.42, '#cfe0fd')
        gradient.addColorStop(1, '#2f5590')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 4, 128)
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    }

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(450, 24, 16),
      new THREE.MeshBasicMaterial({
        map: makeSkyTexture(),
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      }),
    )
    scene.add(sky)

    // --- Fachada de ventanas --------------------------------------------
    function makeFacadeTexture(): THREE.CanvasTexture {
      const cells = 6
      const cell = 128
      const canvas = document.createElement('canvas')
      canvas.width = cells * cell
      canvas.height = cells * cell
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#0a1424'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const inset = 22
        for (let row = 0; row < cells; row++) {
          for (let col = 0; col < cells; col++) {
            const x = col * cell + inset
            const y = row * cell + inset
            const roll = Math.random()
            // Mezcla de ventanas apagadas, encendidas y con brillo calido.
            if (roll < 0.32) ctx.fillStyle = '#16233a'
            else if (roll < 0.78) ctx.fillStyle = '#8fc0ff'
            else ctx.fillStyle = '#ffd9a3'
            ctx.fillRect(x, y, cell - inset * 2, cell - inset * 2)
          }
        }
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      return texture
    }

    const facadeTexture = makeFacadeTexture()
    const materials = [
      new THREE.MeshStandardMaterial({
        map: facadeTexture,
        emissiveMap: facadeTexture,
        emissive: new THREE.Color(0x7fb4ff),
        emissiveIntensity: 0.62,
        metalness: 0.22,
        roughness: 0.62,
      }),
      new THREE.MeshStandardMaterial({
        map: facadeTexture,
        emissiveMap: facadeTexture,
        emissive: new THREE.Color(0x6f9fe8),
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.55,
        color: new THREE.Color(0x20344f),
      }),
    ]

    // --- Torres (distribucion determinista, estilo plano de arquitectura) -
    function seeded(seed: number): () => number {
      let state = seed >>> 0
      return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0xffffffff
      }
    }

    const rand = seeded(7)
    const towers: { x: number; z: number; w: number; h: number; d: number; m: number }[] = []
    const TWELVE = 12
    for (let index = 0; index < TWELVE; index++) {
      const angle = (index / TWELVE) * Math.PI * 2 + rand() * 0.5
      const radius = 7 + rand() * 17
      towers.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        w: 1.8 + rand() * 1.6,
        d: 1.8 + rand() * 1.6,
        h: 6 + rand() * 11,
        m: rand() < 0.5 ? 0 : 1,
      })
    }

    const towerGroup = new THREE.Group()
    for (const tower of towers) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(tower.w, tower.h, tower.d),
        materials[tower.m],
      )
      mesh.position.set(tower.x, tower.h / 2, tower.z)
      towerGroup.add(mesh)

      // Remate: una franja mas clara que corta la silueta contra el cielo.
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(tower.w * 1.04, 0.55, tower.d * 1.04),
        new THREE.MeshStandardMaterial({
          color: 0x9cc0ea,
          metalness: 0.6,
          roughness: 0.35,
          emissive: 0x1b2c45,
          emissiveIntensity: 0.4,
        }),
      )
      cap.position.set(tower.x, tower.h + 0.05, tower.z)
      towerGroup.add(cap)
    }
    scene.add(towerGroup)

    // --- Suelo ------------------------------------------------------------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95, metalness: 0.05 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.05
    scene.add(ground)

    // --- Nubes a la deriva para dar escala -------------------------------
    function makeCloudTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const gradient = ctx.createRadialGradient(128, 32, 4, 128, 32, 120)
        gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 256, 64)
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    }

    const cloudTexture = makeCloudTexture()
    const clouds: THREE.Mesh[] = []
    const CLOUDS = 4
    for (let index = 0; index < CLOUDS; index++) {
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(34 + rand() * 30, 8 + rand() * 6),
        new THREE.MeshBasicMaterial({
          map: cloudTexture,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      )
      cloud.position.set(rand() * 120 - 60, 22 + rand() * 18, rand() * 120 - 70)
      scene.add(cloud)
      clouds.push(cloud)
    }

    // --- Luces ------------------------------------------------------------
    scene.add(new THREE.HemisphereLight(0xdbe8fe, 0x0d1b30, 1.1))
    const sun = new THREE.DirectionalLight(0xfff2da, 1.7)
    sun.position.set(-40, 60, 30)
    scene.add(sun)
    const rim = new THREE.PointLight(0x7fb0ff, 1.4, 180, 2)
    rim.position.set(28, 26, -46)
    scene.add(rim)

    // --- Camara: spline cerrada de "tomas" --------------------------------
    const positions = [
      new THREE.Vector3(20, 1.6, 22),
      new THREE.Vector3(-18, 2, 20),
      new THREE.Vector3(-12, 13, -14),
      new THREE.Vector3(13, 13, -12),
      new THREE.Vector3(8, 1.3, 24),
    ]
    const lookAt = [
      new THREE.Vector3(-2, 10, 0),
      new THREE.Vector3(2, 12, 0),
      new THREE.Vector3(2, 3, 0),
      new THREE.Vector3(-3, 4, 0),
      new THREE.Vector3(0, 15, 0),
    ]
    const SEGMENTS = positions.length

    const clock = new THREE.Clock()
    const LOOP_SECONDS = 26 * (reduceMotion ? 6 : 1)
    const cameraPos = new THREE.Vector3()
    const cameraTarget = new THREE.Vector3()

    function animate() {
      const elapsed = clock.getElapsedTime()
      const u = (elapsed / LOOP_SECONDS) * SEGMENTS
      catmullInto(positions, u, cameraPos)
      catmullInto(lookAt, u, cameraTarget)
      // Micro-vaiven de "camara en mano" para que no parezca un track perfecto.
      cameraPos.y += Math.sin(elapsed * 0.9) * 0.06
      camera.position.copy(cameraPos)
      camera.lookAt(cameraTarget)

      for (let index = 0; index < clouds.length; index++) {
        const cloud = clouds[index]
        cloud.position.x = cloud.userData.baseX + Math.sin(elapsed * 0.03 * (index + 1)) * 4
      }

      renderer.render(scene, camera)
    }

    /**
     * Evaluacion de la spline sin allocating por frame: escribe sobre un
     * Vector3 reutilizado.
     */
    function catmullInto(points: THREE.Vector3[], u: number, out: THREE.Vector3): void {
      const i = Math.floor(u) % SEGMENTS
      const t = u - Math.floor(u)
      const p0 = points[(i - 1 + SEGMENTS) % SEGMENTS]
      const p1 = points[i]
      const p2 = points[(i + 1) % SEGMENTS]
      const p3 = points[(i + 2) % SEGMENTS]
      const t2 = t * t
      const t3 = t2 * t
      out.set(
        0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 *
          (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        0.5 *
          (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      )
    }

    // Base de deriva de las nubes (valores estables por indice).
    clouds.forEach((cloud) => {
      cloud.userData.baseX = cloud.position.x
    })

    function resize() {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width === 0 || height === 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    if (observer) observer.observe(container)
    else window.addEventListener('resize', resize)
    resize()

    let frameId = 0
    function loop() {
      animate()
      frameId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(frameId)
      if (observer) observer.disconnect()
      else window.removeEventListener('resize', resize)
      renderer.setAnimationLoop(null)
      renderer.dispose()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
      })
      facadeTexture.dispose()
      cloudTexture.dispose()
      ;(sky.material as THREE.Material).dispose()
      materials.forEach((material) => material.dispose())
      container.removeChild(renderer.domElement)
    }
  }, [isDesktop, reduceMotion])

  if (!isDesktop || failed) {
    return <GlassTowers className={className} />
  }

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label="Torres de cristal en animacion 3D con tomas de camara"
    />
  )
}