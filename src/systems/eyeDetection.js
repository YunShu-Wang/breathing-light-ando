import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const LEFT = [33, 160, 158, 133, 153, 144];
const RIGHT = [362, 385, 387, 263, 373, 380];

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function eyeAspectRatio(points, indices) {
  const p = indices.map((index) => points[index]);
  const verticalA = distance(p[1], p[5]);
  const verticalB = distance(p[2], p[4]);
  const horizontal = distance(p[0], p[3]);
  return (verticalA + verticalB) / (2 * horizontal);
}

function blinkScore(blendshapes) {
  const categories = blendshapes?.[0]?.categories;
  if (!categories) return null;
  const left = categories.find((category) => category.categoryName === "eyeBlinkLeft")?.score;
  const right = categories.find((category) => category.categoryName === "eyeBlinkRight")?.score;
  if (typeof left !== "number" || typeof right !== "number") return null;
  return (left + right) / 2;
}

async function createLandmarker(fileset, delegate) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
      delegate
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false
  });
}

export function createEyeDetection({ onEyeState }) {
  let video = null;
  let stream = null;
  let landmarker = null;
  let raf = 0;
  let closedSince = 0;
  let mode = "open";
  let lastVideoTime = -1;
  let disposed = false;

  const emit = (next, ratio) => {
    if (next === mode) return;
    mode = next;
    onEyeState?.({ state: next, ratio, time: performance.now() });
  };

  const frame = () => {
    if (disposed) return;
    const now = performance.now();
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, now);
      const face = result.faceLandmarks?.[0];
      if (face) {
        const left = eyeAspectRatio(face, LEFT);
        const right = eyeAspectRatio(face, RIGHT);
        const ratio = (left + right) / 2;
        const blink = blinkScore(result.faceBlendshapes);
        const closed = blink === null ? ratio < 0.19 : blink > 0.56 || ratio < 0.15;

        if (closed) {
          if (!closedSince) closedSince = now;
          const duration = now - closedSince;
          if (duration > 950) {
            emit("closed", ratio);
          } else if (duration > 80) {
            emit("blink", ratio);
          }
        } else {
          closedSince = 0;
          emit("open", ratio);
        }
      }
    }
    raf = requestAnimationFrame(frame);
  };

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
      );
      try {
        landmarker = await createLandmarker(fileset, "GPU");
      } catch (error) {
        console.warn("FaceLandmarker GPU setup failed, falling back to CPU", error);
        landmarker = await createLandmarker(fileset, "CPU");
      }
      if (disposed) return;
      frame();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (landmarker) {
        landmarker.close();
      }
    }
  };
}
