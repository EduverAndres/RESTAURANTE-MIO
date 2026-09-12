// Pure conversion from the URL-safe base64 VAPID public key (as published in
// NEXT_PUBLIC_VAPID_PUBLIC_KEY) into the raw bytes `PushManager.subscribe`
// expects for `applicationServerKey`. No env access, no DOM dependency other
// than the ambient `atob` global (present in both browsers and jsdom).

/** Decodes a URL-safe, unpadded base64 string into a `Uint8Array`. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
