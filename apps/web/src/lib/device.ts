const DEVICE_KEY = "cv_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "default";
  }
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = window.crypto.randomUUID().replace(/-/g, "").slice(0, 32);
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id.slice(0, 80);
  } catch {
    return "default";
  }
}

export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") {
    return "AmarPin";
  }
  const ua = navigator.userAgent || "AmarPin";
  return ua.slice(0, 80);
}

export function playbackDevicePayload() {
  return {
    deviceId: getDeviceId(),
    deviceLabel: getDeviceLabel(),
  };
}
