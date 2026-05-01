import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('Public:', keys.publicKey)
console.log('Private:', keys.privateKey)
