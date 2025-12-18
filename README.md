# Dream Mirror 🔮

An interactive installation that visualizes dreams through real-time audio analysis and audio-responsive visualization.

## Description

Dream Mirror transforms spoken dream narratives into a dynamic, responsive visual experience. Users speak about their dreams into a microphone, and the system visualizes their voice through animated torus geometries that change shape and movement based on audio intensity.

## Current Features

- **3D Animated Toruses**: Three.js-powered torus geometries with Simplex Noise for organic wave deformation
- **Real-time Audio Analysis**: Microphone input analysis with frequency detection, peak detection, and intensity calculation
- **Audio-Responsive Visualization**: Toruses react to speech with:
  - Wave displacement that scales with audio intensity (non-linear curve for gradual response)
  - Speed variation based on audio intensity
  - Size scaling that grows with audio input
  - Minimum intensity threshold (0.5) to filter quiet sounds
- **Waveform Visualization**: Real-time audio waveform display with frequency bars
- **Color System**: Siri-like multi-color palette (blues, teals, purples, pinks) with smooth color interpolation
- **Modular Architecture**:
  - `index.html` - Main HTML structure
  - `script.js` - Main application logic (ES6 module)
  - `src/audioAnalyzer.js` - Audio analysis class
  - `src/style.css` - Styling

## Next Steps

### Sentient Audio Analysis

- Implement intelligent audio analysis to dynamically control visualization colors based on emotion
- Extract emotional valence, arousal, and sentiment from voice in real-time
- Integrate keyword-based sentiment analysis for dream content

### Panel Interpretation System

- Generate multi-cultural dream interpretations (Chinese, Southeast Asian, Western perspectives)
- Display interpretation panels after dream recording ends
- Design visual panels that match the projection aesthetic

### Beyond Web App: Projection Installation

- **Projection Setup**: Transition from web app to projection-based installation
- **Minimalist Interaction**: Single microphone as the only user interface element
- **Spatial Design**:
  - Animated toruses projected onto a white wall
  - Interpretation panels/words appear against the same projection surface
  - Immersive, ambient experience where users interact only through voice

The future vision is a room-scale installation where the animated toruses and text interpretations are projected, creating an intimate space for dream sharing and reflection.
