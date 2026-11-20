import * as THREE from '../vendor/three.module.js'

export function createPost(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2())
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  })
  target.texture.colorSpace = THREE.LinearSRGBColorSpace

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture },
      uResolution: { value: new THREE.Vector2(size.x, size.y) },
      uTime: { value: 0 },
      uDamage: { value: 0 },
      uLowHealth: { value: 0 },
      uFade: { value: 1 },
      uDistortion: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uDamage;
      uniform float uLowHealth;
      uniform float uFade;
      uniform float uDistortion;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      vec3 aces(vec3 x) {
        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
      }

      void main() {
        vec2 p = vUv - 0.5;
        p.x *= 1.0;
        float r2 = dot(p, p);
        float edge = smoothstep(0.18, 0.68, length(p));

        // subtle barrel / fisheye distortion
        vec2 uv = 0.5 + p * (1.0 + (0.085 * r2 + 0.035 * r2 * r2) * uDistortion);

        // chromatic aberration
        vec2 ca = p * (0.0009 + r2 * 0.0027);
        float rr = texture2D(tDiffuse, uv + ca).r;
        float gg = texture2D(tDiffuse, uv).g;
        float bb = texture2D(tDiffuse, uv - ca).b;
        vec3 col = vec3(rr, gg, bb);

        // cheap 8 tap bloom for hot lights and muzzle flashes
        vec2 px = 1.0 / uResolution;
        vec3 bl = vec3(0.0);
        bl += texture2D(tDiffuse, uv + px * vec2(5.0, 0.0)).rgb;
        bl += texture2D(tDiffuse, uv + px * vec2(-5.0, 0.0)).rgb;
        bl += texture2D(tDiffuse, uv + px * vec2(0.0, 5.0)).rgb;
        bl += texture2D(tDiffuse, uv + px * vec2(0.0, -5.0)).rgb;
        bl += texture2D(tDiffuse, uv + px * vec2(10.0, 8.0)).rgb;
        bl += texture2D(tDiffuse, uv + px * vec2(-10.0, -8.0)).rgb;
        bl += texture2D(tDiffuse, uv + px * vec2(9.0, -9.0)).rgb;
        bl += texture2D(tDiffuse, uv + px * vec2(-9.0, 9.0)).rgb;
        bl *= 0.125;
        float blLum = max(max(bl.r, bl.g), bl.b);
        col += bl * smoothstep(0.58, 1.4, blLum) * 0.42;

        // grade: cool shadows, warm practicals
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, 1.16);
        col *= vec3(1.04, 1.0, 0.95);
        col += vec3(0.004, 0.009, 0.014) * (1.0 - smoothstep(0.0, 0.45, luma));
        col = pow(max(col, 0.0), vec3(0.92, 1.0, 1.07));

        // bodycam lens vignette
        float vig = 1.0 - smoothstep(0.19, 0.86, length(p * vec2(1.02, 1.0)));
        col *= mix(0.58, 1.0, vig);

        // scanlines / sensor lines
        col *= 1.0 - 0.016 * (0.5 + 0.5 * sin(vUv.y * uResolution.y * 1.6));
        // faint horizontal sensor band
        float band = 1.0 - smoothstep(0.0, 0.02, abs(fract(vUv.y * 0.5 + uTime * 0.015) - 0.5));
        col += vec3(0.008, 0.011, 0.014) * band;

        // lens smudges
        float smudge = 0.0;
        smudge += (1.0 - smoothstep(0.0, 0.17, length(vUv - vec2(0.23, 0.72)))) * 0.18;
        smudge += (1.0 - smoothstep(0.0, 0.22, length(vUv - vec2(0.79, 0.32)))) * 0.13;
        smudge += (1.0 - smoothstep(0.0, 0.11, length(vUv - vec2(0.63, 0.79)))) * 0.1;
        col *= 1.0 - smudge;

        // film grain, stronger in shadows
        float grain = hash(vUv * uResolution + fract(uTime) * 431.0) - 0.5;
        col += grain * (0.013 + 0.008 * (1.0 - luma));
        // fixed pattern noise
        col += (hash(floor(vUv * uResolution * 0.5) + 5.0) - 0.5) * 0.0035;

        // damage wash + low health pulse
        float hurt = uDamage * smoothstep(0.15, 0.78, length(p));
        col = mix(col, vec3(0.45, 0.015, 0.008), hurt * 0.52);
        float pulse = 0.5 + 0.5 * sin(uTime * 5.2);
        float low = uLowHealth * smoothstep(0.28, 0.8, length(p)) * (0.3 + 0.22 * pulse);
        col = mix(col, vec3(0.34, 0.01, 0.006), low * 0.42);

        // slight exposure breathing and camera sensor flicker
        col *= 0.985 + 0.015 * sin(uTime * 8.0);
        col = aces(col * 1.42);
        col = pow(max(col, 0.0), vec3(1.0 / 2.2));

        gl_FragColor = vec4(col * uFade, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  })

  const postScene = new THREE.Scene()
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  postScene.add(quad)

  const setSize = (w, h) => {
    target.setSize(w, h)
    material.uniforms.uResolution.value.set(w, h)
  }

  return {
    target,
    material,
    postScene,
    postCamera,
    setSize,
    render(renderer, scene, camera, weaponScene, weaponCamera) {
      renderer.setRenderTarget(target)
      renderer.clear()
      renderer.render(scene, camera)
      if (weaponScene) {
        renderer.clearDepth()
        renderer.render(weaponScene, weaponCamera)
      }
      renderer.setRenderTarget(null)
      renderer.render(postScene, postCamera)
    },
  }
}
