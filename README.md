# Dream Mirror 🔮

An interactive installation that visualizes dreams through real-time audio analysis and emotion-responsive visualization.

## Description

Dream Mirror transforms spoken dream narratives into a dynamic, responsive visual experience. Users speak about their dreams into a microphone, and the system visualizes their emotional state through an animated orb that changes color, shape, and movement based on voice analysis.

## Current POC Features

- **3D Animated Orb**: Three.js-powered sphere with custom shaders for fluid deformation and wave patterns
- **Real-time Audio Analysis**: Microphone input analysis with frequency detection and peak detection
- **Audio-Responsive Visualization**: Orb reacts to speech with spikes and deformation based on audio peaks
- **Manual Emotion Control**: Slider interface to adjust valence (-1 to 1) that controls orb color:
  - Scary (dark red) → Negative (purple) → Neutral (blue) → Positive (gold) → Happy (bright gold)
- **Waveform Visualization**: Real-time audio waveform display
- **Interactive Camera**: OrbitControls for exploring the orb from any angle
- **Color Mapping**: Smooth color interpolation based on emotional valence

## Demo

<video width="800" controls>
  <source src="./public/poc-demo.mp4" type="video/mp4">
  Your browser does not support the video tag. [Download the video](./public/poc-demo.mp4) instead.
</video>

## Next Steps

### Sentient Audio Analysis

- Implement intelligent audio analysis to dynamically adjust the currently manual emotion slider
- Extract emotional valence, arousal, and sentiment from voice in real-time
- Replace manual slider with automatic emotion detection from audio signals
- Integrate keyword-based sentiment analysis for dream content

### Panel Interpretation System

- Generate multi-cultural dream interpretations (Chinese, Southeast Asian, Western perspectives)
- Display interpretation panels after dream recording ends
- Design visual panels that match the projection aesthetic

### Beyond Web App: Projection Installation

- **Projection Setup**: Transition from web app to projection-based installation
- **Minimalist Interaction**: Single microphone as the only user interface element
- **Spatial Design**:
  - Orb projected onto a white wall
  - Interpretation panels/words appear against the same projection surface
  - Immersive, ambient experience where users interact only through voice

The future vision is a room-scale installation where the orb and text interpretations are projected, creating an intimate space for dream sharing and reflection.
