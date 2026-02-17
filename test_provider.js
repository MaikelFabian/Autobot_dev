const { createProvider } = require('@builderbot/bot')
const { BaileysProvider } = require('@builderbot/provider-baileys')
const qrcode = require('qrcode-terminal')

const main = async () => {
    console.log('Test initializing provider with custom browser...')
    try {
        const adapterProvider = createProvider(BaileysProvider, {
            browser: ['Mac OS', 'Chrome', '14.4.1']
        })
        
        adapterProvider.on('require_action', (payload) => {
            console.log('⚡ Require Action:', payload)
            const qr = payload.qr || payload.payload?.qr
            if (qr) {
                console.log('📷 QR Code received')
                qrcode.generate(qr, { small: true }, (q) => console.log(q))
            }
        })
        
        adapterProvider.on('ready', () => console.log('✅ Provider ready'))
        adapterProvider.on('auth_failure', (e) => console.log('❌ Auth failure', e))
        
        console.log('Calling initVendor...')
        await adapterProvider.initVendor()
        console.log('initVendor completed')
        
        setInterval(() => {}, 1000)
    } catch (e) {
        console.error('Error during test:', e)
    }
}

main()
