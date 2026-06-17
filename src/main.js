import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import AudioAnalyzer from "./audioAnalyzer.js";

class DreamGlobe {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock(); // Use Three.js Clock for accurate timing

    // Rotation speed - adjustable variable
    this.rotationSpeed = { x: 0.0005, y: 0.001 };

    // Color system - valence-based
    this.valence = 0.0; // -1 (negative) to 1 (positive)
    this.targetColor = new THREE.Color(0x3b82f6); // Default blue
    this.currentColor = new THREE.Color(0x3b82f6);

    // Audio system
    this.audioAnalyzer = new AudioAnalyzer();
    this.audioAnalysisInterval = null;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e27); // Dark blue background 0x0a0e27

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Create sphere
    this.createSphere();

    // Setup lighting
    this.setupLighting();

    // Setup OrbitControls for camera rotation
    this.setupOrbitControls();

    // Setup interactive controls for testing
    this.setupColorControls();

    // Setup audio controls (this also initializes waveform canvas)
    this.setupAudioControls();

    // Draw initial waveform (idle state)
    // Small delay to ensure canvas is ready
    setTimeout(() => {
      if (this.drawWaveform) {
        this.drawWaveform();
      }
    }, 100);

    // Handle window resize
    this.handleResize();

    // Start animation loop
    this.animate();
  }

  createSphere() {
    // Use IcosahedronGeometry for smooth sphere with 64 subdivisions
    const geometry = new THREE.IcosahedronGeometry(1, 64);

    // Get shaders from script tags in HTML (like the example)
    const vertexShader = document.getElementById("vertexshader").textContent;
    const fragmentShader =
      document.getElementById("fragmentshader").textContent;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFrequency: { value: 0.0 }, // Audio frequency (0-255), ready for audio integration
        uColor: { value: new THREE.Color(0x3b82f6) }, // Blue
        uValence: { value: 0.0 }, // Valence for wave complexity control
      },
      side: THREE.DoubleSide,
      transparent: true, // Enable transparency
      depthWrite: false, // Prevent z-fighting with transparency
      blending: THREE.NormalBlending, // Normal blending for realistic glass transparency
    });

    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);
    this.material = material;
  }

  setupLighting() {
    // Increased external lighting for better visibility
    // Main directional light for specular highlights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Stronger fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, -3, -5);
    this.scene.add(fillLight);

    // Increased ambient light for overall brightness
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Point light at center of orb - brightens interior when camera is inside
    const innerPointLight = new THREE.PointLight(0xffffff, 2.0, 3.0);
    innerPointLight.position.set(0, 0, 0); // Center of orb
    this.scene.add(innerPointLight);
  }

  setupOrbitControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Configure controls for smooth interaction
    this.controls.enableDamping = true; // Smooth camera movement
    this.controls.dampingFactor = 0.05;

    // Set limits for zoom - allow camera to go inside the orb (radius = 1.0)
    this.controls.minDistance = 0.3; // Allow camera inside orb to see inner waves and lines
    this.controls.maxDistance = 5;

    // Target the center of the scene (where the globe is)
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // Allow rotation from any angle
    this.controls.enablePan = false; // Disable panning (keeping camera focused on globe)
    this.controls.autoRotate = false; // We have our own rotation system
  }

  // Color mapping constants - stored as Three.js Color objects for smooth interpolation
  static VALENCE_COLORS = {
    veryNegative: new THREE.Color(0x7f1d1d),
    negative: new THREE.Color(0x9333ea),
    neutral: new THREE.Color(0x3b82f6),
    positive: new THREE.Color(0xf59e0b),
    veryPositive: new THREE.Color(0xfef3c7),
  };

  // Get smooth interpolated color based on valence
  getValenceColor(valence) {
    // Clamp valence between -1 and 1
    const clampedValence = THREE.MathUtils.clamp(valence, -1, 1);
    const color = new THREE.Color();

    // Map valence (-1 to 1) to color transitions with smooth interpolation
    // Breakpoints: -1, -0.5, 0, 0.3, 0.7, 1
    if (clampedValence < -0.5) {
      // -1 to -0.5: veryNegative (full at -1)
      const t = (clampedValence + 1) / 0.5; // 0 to 1 from -1 to -0.5
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.veryNegative,
        DreamGlobe.VALENCE_COLORS.negative,
        t
      );
    } else if (clampedValence < 0) {
      // -0.5 to 0: negative to neutral
      const t = (clampedValence + 0.5) / 0.5; // 0 to 1 from -0.5 to 0
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.negative,
        DreamGlobe.VALENCE_COLORS.neutral,
        t
      );
    } else if (clampedValence < 0.3) {
      // 0 to 0.3: neutral (full at 0, transitioning to positive)
      const t = clampedValence / 0.3; // 0 to 1 from 0 to 0.3
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.neutral,
        DreamGlobe.VALENCE_COLORS.positive,
        t
      );
    } else if (clampedValence < 0.7) {
      // 0.3 to 0.7: positive (full at 0.3, transitioning to veryPositive)
      const t = (clampedValence - 0.3) / 0.4; // 0 to 1 from 0.3 to 0.7
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.positive,
        DreamGlobe.VALENCE_COLORS.veryPositive,
        t
      );
    } else {
      // 0.7 to 1: veryPositive (full at 0.7+)
      // At 0.7+, we're already at veryPositive, but we can make it slightly brighter
      const t = (clampedValence - 0.7) / 0.3; // 0 to 1 from 0.7 to 1
      const brightened = DreamGlobe.VALENCE_COLORS.veryPositive.clone();
      brightened.lerp(new THREE.Color(1.0, 1.0, 0.95), t * 0.2); // Slight brightening at max
      color.copy(brightened);
    }

    return color;
  }

  // Get valence color hex string for UI display (with smooth interpolation)
  getValenceColorHex(valence) {
    const color = this.getValenceColor(valence);
    return "#" + color.getHexString();
  }

  updateColor(valence) {
    // Clamp valence between -1 and 1
    this.valence = THREE.MathUtils.clamp(valence, -1, 1);

    // Get smoothly interpolated color
    const targetColor = this.getValenceColor(this.valence);
    this.targetColor.copy(targetColor);
  }

  setupColorControls() {
    // Create wrapper container using flexbox for bottom controls
    const bottomWrapper = document.createElement("div");
    bottomWrapper.className = "bottom-controls-wrapper";

    // Add color labels using flexbox
    const colorLabels = document.createElement("div");
    colorLabels.className = "color-labels";
    colorLabels.innerHTML = `
      <span style="color: #7f1d1d;">Scary</span>
      <span style="color: #9333ea;">Negative</span>
      <span style="color: #3b82f6;">Neutral</span>
      <span style="color: #f59e0b;">Positive</span>
      <span style="color: #fef3c7;">Happy</span>
    `;

    // Create controls container using flexbox
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "controls-container";

    const label = document.createElement("label");
    label.textContent = "Emotion";
    label.className = "emotion-label";

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "slider-container";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "-1";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = "0";
    slider.className = "emotion-slider";

    // Update on slider change
    slider.addEventListener("input", (e) => {
      const valence = parseFloat(e.target.value);
      this.updateColor(valence);
    });

    // Assemble components using flexbox structure
    sliderContainer.appendChild(slider);
    controlsContainer.appendChild(label);
    controlsContainer.appendChild(sliderContainer);

    bottomWrapper.appendChild(colorLabels);
    bottomWrapper.appendChild(controlsContainer);

    document.body.appendChild(bottomWrapper);
  }

  setAudioLiveState(micGroup, toggle, isLive) {
    micGroup.classList.toggle("is-live", isLive);
    toggle.setAttribute("aria-checked", isLive ? "true" : "false");
    toggle.setAttribute(
      "aria-label",
      isLive ? "Turn audio off" : "Turn audio on"
    );
  }

  createAudioToggle() {
    const toggle = document.createElement("button");
    toggle.className = "audio-toggle";
    toggle.type = "button";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", "false");
    toggle.setAttribute("aria-label", "Turn audio on");

    const track = document.createElement("span");
    track.className = "audio-toggle-track";

    const thumb = document.createElement("span");
    thumb.className = "audio-toggle-thumb";
    thumb.setAttribute("aria-hidden", "true");

    track.appendChild(thumb);
    toggle.appendChild(track);

    return toggle;
  }

  drawWaveform(isLive = this.audioAnalyzer.isListening) {
    if (!this.waveformContext || !this.waveformCanvas) {
      return;
    }

    const ctx = this.waveformContext;
    const canvas = this.waveformCanvas;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    if (isLive && this.audioAnalyzer.isListening && this.audioAnalyzer.analyser) {
      const timeData = new Uint8Array(this.audioAnalyzer.analyser.fftSize);
      this.audioAnalyzer.analyser.getByteTimeDomainData(timeData);

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2eca45";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(46, 202, 69, 0.75)";

      const sliceWidth = width / timeData.length;
      let x = 0;

      for (let i = 0; i < timeData.length; i++) {
        const y = (timeData[i] / 128) * (height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }
  }

  setupAudioControls() {
    const audioContainer = document.createElement("div");
    audioContainer.className = "audio-controls";

    const micGroup = document.createElement("div");
    micGroup.className = "audio-mic-group";

    const toggle = this.createAudioToggle();

    micGroup.appendChild(toggle);

    const waveformContainer = document.createElement("div");
    waveformContainer.className = "audio-waveform";

    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 24;
    waveformContainer.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    this.waveformCanvas = canvas;
    this.waveformContext = ctx;
    this.waveformContainer = waveformContainer;

    let isListening = false;

    toggle.addEventListener("click", async () => {
      if (!isListening) {
        await this.startAudioListening();
        if (this.audioAnalyzer.isListening) {
          isListening = true;
          this.setAudioLiveState(micGroup, toggle, true);
        }
      } else {
        this.stopAudioListening();
        isListening = false;
        this.setAudioLiveState(micGroup, toggle, false);
        this.drawWaveform(false);
      }
    });

    audioContainer.appendChild(micGroup);
    audioContainer.appendChild(waveformContainer);

    document.body.appendChild(audioContainer);
    this.drawWaveform(false);
  }

  handleResize() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateFrequency(frequency, intensity, peak) {
    // PEAK-BASED ABRUPT RESPONSE
    // Focus on peak spikes rather than averages for maximum distinction

    // MUCH HIGHER threshold - only react to clear speech, not ambient noise
    // Speech typically has peaks in the 100-200+ range, ambient noise is lower
    const peakThreshold = 110;
    const intensityThreshold = 0.3;

    // Additional check: require BOTH peak AND intensity to be high
    // This filters out single spike events and requires sustained speech
    const hasSignificantPeak =
      (peak > peakThreshold && intensity > intensityThreshold) ||
      peak > peakThreshold * 1.5; // Very loud peaks can still trigger alone

    if (hasSignificantPeak) {
      // INSTANTANEOUS response to peaks - almost no smoothing
      const currentFreq = this.material.uniforms.uFrequency.value;

      // Use peak value directly for maximum abrupt response
      // Peak-based boost creates dramatic spikes (but smaller/more controlled)
      const peakBoost = intensity * 80; // Reduced boost for thinner spikes (was 120)
      const targetFreq = peak * 0.05 + peakBoost; // Reduced peak influence for skinnier spikes (was 0.8)

      // Almost NO smoothing - instant response to peaks
      const smoothFactor = 0.2;
      this.material.uniforms.uFrequency.value +=
        (targetFreq - currentFreq) * smoothFactor;

      // DRAMATIC scaling - orb jumps in size immediately with peaks
      const scaleTarget = 1.0 + intensity;
      const currentScale = this.sphere.scale.x;
      const scaleSmooth = 0.7;
      const newScale =
        currentScale + (scaleTarget - currentScale) * scaleSmooth;
      this.sphere.scale.set(newScale, newScale, newScale);
    } else {
      // When quiet - SMOOTH return to calm state
      const currentFreq = this.material.uniforms.uFrequency.value;
      if (currentFreq > 0.1) {
        // Smooth fade out - gradual return to calm
        this.material.uniforms.uFrequency.value *= 0.85; // Slower, smoother decay (was 0.3)
      } else {
        this.material.uniforms.uFrequency.value = 0;
      }

      // SMOOTH return to normal size when quiet - no abrupt changes
      const currentScale = this.sphere.scale.x;
      if (Math.abs(currentScale - 1.0) > 0.01) {
        const scaleSmooth = 0.15; // Much smoother return to calm (was 0.3 - too abrupt)
        const newScale = currentScale + (1.0 - currentScale) * scaleSmooth;
        this.sphere.scale.set(newScale, newScale, newScale);
      }
    }
  }

  async startAudioListening() {
    const success = await this.audioAnalyzer.setupMicrophone();
    if (!success) return;

    // Start analysis loop - analyze 20 times per second (like the guide)
    this.audioAnalysisInterval = setInterval(() => {
      if (this.audioAnalyzer.isListening) {
        const { frequency, volume, intensity, peak } =
          this.audioAnalyzer.analyze();

        // Update blob deformation based on PEAK detection
        // Pass peak value for abrupt spike detection
        // The shader uses: (uFrequency / 30.0) * (noise / 10.0)
        this.updateFrequency(frequency, intensity, peak);

        // Update waveform visualization
        this.drawWaveform();

        // Optional: You can also update other visual properties based on volume/intensity
        // For example, increase rotation speed with volume
        // this.rotationSpeed.x = 0.0005 + volume * 0.002;
      }
    }, 50); // 50ms = 20fps analysis rate

    // Draw initial waveform (inactive state)
    this.drawWaveform();

    console.log("🎤 Audio listening started - speak into your microphone!");
  }

  stopAudioListening() {
    if (this.audioAnalysisInterval) {
      clearInterval(this.audioAnalysisInterval);
      this.audioAnalysisInterval = null;
    }
    this.audioAnalyzer.stop();

    // Gradually fade frequency back to 0
    const fadeInterval = setInterval(() => {
      const currentFreq = this.material.uniforms.uFrequency.value;
      if (Math.abs(currentFreq) < 0.1) {
        this.material.uniforms.uFrequency.value = 0;
        clearInterval(fadeInterval);
      } else {
        this.material.uniforms.uFrequency.value *= 0.9; // Fade out
      }

      // Also fade scale back to 1.0
      const currentScale = this.sphere.scale.x;
      if (Math.abs(currentScale - 1.0) < 0.01) {
        this.sphere.scale.set(1.0, 1.0, 1.0);
      } else {
        const newScale = currentScale + (1.0 - currentScale) * 0.1;
        this.sphere.scale.set(newScale, newScale, newScale);
      }
    }, 50);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Update OrbitControls (required for damping)
    this.controls.update();

    // Update time for shader animation using Clock (handles frame rate variations)
    const elapsedTime = this.clock.getElapsedTime();
    this.material.uniforms.uTime.value = elapsedTime;

    // Smoothly interpolate colors toward target using Three.js lerp
    const lerpFactor = 0.05; // Smooth color transition
    this.currentColor.lerp(this.targetColor, lerpFactor);

    // Update shader uniforms with current colors and valence
    this.material.uniforms.uColor.value.copy(this.currentColor);
    this.material.uniforms.uValence.value = this.valence;

    // Apply rotation with fixed speed
    this.sphere.rotation.x += this.rotationSpeed.x;
    this.sphere.rotation.y += this.rotationSpeed.y;

    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize DreamGlobe when DOM is ready
const container = document.getElementById("app");
const globe = new DreamGlobe(container);
