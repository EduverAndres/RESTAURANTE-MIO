// Prints a fresh VAPID key pair for web push. This script never reads or
// writes env files; paste the output into .env.local yourself.
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log('Paste these into .env.local:\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('VAPID_SUBJECT=mailto:ops@tienda.app')
