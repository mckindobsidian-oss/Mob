export function nativeMessage(type, data = {}) {
  if (!window.MobAndroid) return false;
  window.MobAndroid.postMessage(JSON.stringify({ type, ...data }));
  return true;
}

export function extensionMessage(type, data = {}) {
  window.postMessage({ source: "mob-web", type, ...data }, location.origin);
}
