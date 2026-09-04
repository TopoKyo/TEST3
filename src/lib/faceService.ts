import * as faceapi from 'face-api.js';

const MODEL_URL = typeof window !== 'undefined' ? window.location.origin + '/models' : '/models';

class FaceService {
  private isLoaded = false;
  private tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

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
    
    // Check if the element has valid dimensions before passing to face-api to avoid Box.constructor NaN crashes
    let width = 0;
    let height = 0;
    
    if (imageElement instanceof HTMLVideoElement) {
      width = imageElement.videoWidth;
      height = imageElement.videoHeight;
    } else if (imageElement instanceof HTMLImageElement) {
      width = imageElement.naturalWidth || imageElement.width;
      height = imageElement.naturalHeight || imageElement.height;
    }

    if (!width || !height || width === 0 || height === 0) {
      return undefined;
    }

    try {
      console.log('Starting detection...');
      let targetElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement = imageElement;
      
      // If it's an Image that is not in the DOM, draw it to a canvas to ensure face-api handles it correctly
      if (imageElement instanceof HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.width || imageElement.naturalWidth;
        canvas.height = imageElement.height || imageElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
          targetElement = canvas;
        }
      }

      const detection = await faceapi
        .detectSingleFace(targetElement, this.tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();
      console.log('Detection finished:', detection);
      return detection?.descriptor;
    } catch (e) {
      console.error('getFaceDescriptor error:', e);
      return undefined;
    }
  }

  createMatcher(users: { name: string; descriptor: number[] }[]) {
    const validUsers = users.filter(u => u.descriptor && u.descriptor.length > 0);
    if (validUsers.length === 0) return null;
    
    const labeledDescriptors = validUsers.map(user => {
      const float32Descriptor = new Float32Array(user.descriptor);
      return new faceapi.LabeledFaceDescriptors(user.name, [float32Descriptor]);
    });

    return new faceapi.FaceMatcher(labeledDescriptors, 0.4); 
  }

  async recognizeFace(imageElement: HTMLImageElement | HTMLVideoElement, matcher: faceapi.FaceMatcher) {
    if (!this.isLoaded) return [];
    
    let width = 0;
    let height = 0;
    
    if (imageElement instanceof HTMLVideoElement) {
      width = imageElement.videoWidth;
      height = imageElement.videoHeight;
    } else if (imageElement instanceof HTMLImageElement) {
      width = imageElement.naturalWidth || imageElement.width;
      height = imageElement.naturalHeight || imageElement.height;
    }

    if (!width || !height || width === 0 || height === 0) {
      return [];
    }

    try {
      console.log('Starting detection...');
      let targetElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement = imageElement;
      
      // If it's an Image that is not in the DOM, draw it to a canvas to ensure face-api handles it correctly
      if (imageElement instanceof HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.width || imageElement.naturalWidth;
        canvas.height = imageElement.height || imageElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
          targetElement = canvas;
        }
      }

      const detection = await faceapi
        .detectSingleFace(targetElement, this.tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();
      console.log('Detection finished:', detection);
      if (!detection) return [];
      const match = matcher.findBestMatch(detection.descriptor);
      return [{
        label: match.label,
        distance: match.distance,
        box: detection.detection.box
      }];
    } catch (e) {
      console.error('recognizeFace error:', e);
      return [];
    }
  }
}

export const faceService = new FaceService();
