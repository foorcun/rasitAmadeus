/**
 * Amadeus NDC Konfigürasyon Dosyası
 * Iraq Airlines için özel konfigürasyon
 */

module.exports = {
    // Amadeus NDC Web Servis Konfigürasyonu
    amadeus: {
        // Test ortamı endpoint'i
        endpoint: 'https://nodeA3.test.webservices.amadeus.com/1ASIWNDC4Z',
        
        // Production ortamı endpoint'i (kullanım için)
        // endpoint: 'https://production.webservices.amadeus.com/1ASIWNDC4Z',
        
        // WS-Security bilgileri - Iraq Airlines
        username: process.env.AMADEUS_USERNAME || 'WSIAETN',
        password: process.env.AMADEUS_PASSWORD || 'Mohammed@1234',
        
        // Iraq Airlines bilgileri
        loginId: 'WSIAETN',
        sign: '9999WS',
        officeId: 'BGWIA07ET',
        iataOfficeId: '34492776',
        countryCode: 'IQ',
        aggregator: 'ETN',
        
        // Pseudo City Code
        pseudoCity: 'BGWIA07ET',
        
        // Consumer ID
        consumer: '1ASIWNDC4Z'
    },

    // Uygulama konfigürasyonu
    app: {
        // Log seviyesi
        logLevel: process.env.LOG_LEVEL || 'info',
        
        // Timeout süreleri (milisaniye)
        timeouts: {
            request: 30000, // 30 saniye
            connection: 10000 // 10 saniye
        },
        
        // Retry konfigürasyonu
        retry: {
            maxAttempts: 3,
            delay: 1000 // 1 saniye
        }
    },

    // Varsayılan biletleme ayarları
    booking: {
        // Varsayılan ülke kodu - Iraq
        defaultCountryCode: 'IQ',
        
        // Varsayılan para birimi
        defaultCurrency: 'USD',
        
        // Varsayılan kabin sınıfı
        defaultCabinClass: 'Economy',
        
        // Varsayılan yolcu tipi
        defaultPassengerType: 'ADT',
        
        // Iraq Airlines varsayılan ayarları
        defaultOrigin: 'BGW', // Baghdad
        defaultDestination: 'IST', // Istanbul
        defaultAgency: 'ETN'
    },

    // WS-Security konfigürasyonu
    wsSecurity: {
        // Nonce boyutu (byte) - Utilities.xml'deki gibi
        nonceSize: 16,
        
        // Hash algoritması
        hashAlgorithm: 'sha1',
        
        // Password digest type
        passwordDigestType: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest',
        
        // Nonce encoding type
        nonceEncodingType: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary',
        
        // Username token ID
        usernameTokenId: 'UsernameToken-1'
    },

    // Iraq Airlines özel ayarları
    iraqAirlines: {
        // Office bilgileri
        office: {
            id: 'BGWIA07ET',
            iataId: '34492776',
            country: 'IQ',
            city: 'BGW'
        },
        
        // Agency bilgileri
        agency: {
            name: 'ETN',
            sign: '9999WS',
            loginId: 'WSIAETN'
        },
        
        // Destinasyonlar
        destinations: {
            istanbul: 'IST',
            baghdad: 'BGW',
            erbil: 'EBL',
            basra: 'BSR',
            najaf: 'NJF'
        }
    }
}; 