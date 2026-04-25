import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

class FaceService {
  private isLoaded = false;

  async loadModels() {
    if (this.isLoaded) return;
    
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    
    this.isLoaded = true;
  }

  async getFaceDescriptor(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
    const detection = await faceapi
      .detectSingleFace(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection?.descriptor;
  }

  createMatcher(users: { name: string; descriptor: number[] }[]) {
    const labeledDescriptors = users.map(user => {
      const float32Descriptor = new Float32Array(user.descriptor);
      return new faceapi.LabeledFaceDescriptors(user.name, [float32Descriptor]);
    });

    return new faceapi.FaceMatcher(labeledDescriptors, 0.6);
  }

  async recognizeFace(imageElement: HTMLImageElement | HTMLVideoElement, matcher: faceapi.FaceMatcher) {
    const detections = await faceapi
      .detectAllFaces(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptors();

    return detections.map(d => {
      const match = matcher.findBestMatch(d.descriptor);
      return {
        label: match.label,
        distance: match.distance,
        box: d.detection.box
      };
    });
  }
}

export const faceService = new FaceService();
