import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
  DrawingUtils
} from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;

export const initializeVisionModels = async () => {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU"
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 2 // Enabled 2 faces support
    });

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 4 // Up to 4 hands for 2 players
    });

    return true;
  } catch (error) {
    console.error("Error initializing vision models:", error);
    return false;
  }
};

export const detectFace = (video: HTMLVideoElement, timestamp: number) => {
  if (!faceLandmarker) return null;
  return faceLandmarker.detectForVideo(video, timestamp);
};

export const detectHands = (video: HTMLVideoElement, timestamp: number) => {
  if (!handLandmarker) return null;
  return handLandmarker.detectForVideo(video, timestamp);
};