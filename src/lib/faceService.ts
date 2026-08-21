import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';

class FaceService {
  private isLoaded = false;
  private tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 });

  async loadModels() {
    if (this.isLoaded) return;
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      this.isLoaded = true;
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  async getFaceDescriptor(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
    if (!this.isLoaded) await this.loadModels();
    const detection = await faceapi
      .detectSingleFace(imageElement, this.tinyOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection?.descriptor;
  }

  createMatcher(users: { name: string; descriptor: number[] }[]) {
    if (users.length === 0) return null;
    const labeledDescriptors = users.map(user => {
      const float32Descriptor = new Float32Array(user.descriptor);
      return new faceapi.LabeledFaceDescriptors(user.name, [float32Descriptor]);
    });

    return new faceapi.FaceMatcher(labeledDescriptors, 0.4); 
  }

  async recognizeFace(imageElement: HTMLImageElement | HTMLVideoElement, matcher: faceapi.FaceMatcher) {
    if (!this.isLoaded) return [];

    const detection = await faceapi
      .detectSingleFace(imageElement, this.tinyOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return [];

    const match = matcher.findBestMatch(detection.descriptor);
    return [{
      label: match.label,
      distance: match.distance,
      box: detection.detection.box
    }];
  }
}

export const faceService = new FaceService();
