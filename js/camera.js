export async function startCamera(videoEl) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  } catch (err) {
    throw new Error(
      err?.name === "NotAllowedError"
        ? "Camera permission was declined."
        : "Could not start the camera."
    );
  }
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
}

export function captureFrame(videoEl, maxDim = 900) {
  const vw = videoEl.videoWidth || 640;
  const vh = videoEl.videoHeight || 480;
  const scale = Math.min(1, maxDim / Math.max(vw, vh));
  const c = document.createElement("canvas");
  c.width = Math.round(vw * scale);
  c.height = Math.round(vh * scale);
  c.getContext("2d").drawImage(videoEl, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
