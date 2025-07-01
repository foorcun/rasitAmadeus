/**
 * Iraq Airlines Prime Booking 21.3 - Cash Biletleme Örneği
 * 
 * Bu dosya, Amadeus NDC web servisleri kullanarak
 * Iraq Airlines için Cash ödeme yöntemiyle biletleme yapmanın örneğini gösterir.
 */

const PrimeBookingCash = require('../index');
const config = require('../config/config');

/**
 * Örnek biletleme işlemi
 */
async function exampleBooking() {
    try {
        console.log('🎯 Iraq Airlines Prime Booking 21.3 - Cash Biletleme Örneği');
        console.log('================================================================\n');

        // PrimeBookingCash instance'ı oluştur
        const primeBooking = new PrimeBookingCash();

        // Iraq Airlines için örnek biletleme verileri
        const bookingData = {
            origin: 'BGW', // Baghdad Havalimanı
            destination: 'IST', // Istanbul Havalimanı
            departureDate: '2024-02-15', // YYYY-MM-DD formatında
            passengerFirstName: 'Ahmed',
            passengerLastName: 'Al-Zahra',
            email: 'ahmed.alzahra@example.com'
        };

        // Biletleme bilgilerini göster
        console.log('📋 Iraq Airlines Biletleme Bilgileri:');
        console.log('   - Havayolu: Iraq Airlines');
        console.log('   - Office ID:', config.iraqAirlines.office.id);
        console.log('   - IATA Office ID:', config.iraqAirlines.office.iataId);
        console.log('   - Kalkış: ' + bookingData.origin);
        console.log('   - Varış: ' + bookingData.destination);
        console.log('   - Tarih: ' + bookingData.departureDate);
        console.log('   - Yolcu: ' + bookingData.passengerFirstName + ' ' + bookingData.passengerLastName);
        console.log('   - E-posta: ' + bookingData.email);
        console.log('   - Ödeme: Cash\n');

        // Biletleme sürecini başlat
        const result = await primeBooking.performBooking(bookingData);

        console.log('\n✅ Iraq Airlines örnek biletleme başarıyla tamamlandı!');
        
        return result;

    } catch (error) {
        console.error('\n❌ Örnek biletleme hatası:', error.message);
        throw error;
    }
}

/**
 * Farklı Iraq Airlines rotaları için örnek biletlemeler
 */
async function multipleBookingExamples() {
    const examples = [
        {
            name: 'Baghdad - Istanbul',
            data: {
                origin: 'BGW',
                destination: 'IST',
                departureDate: '2024-03-01',
                passengerFirstName: 'Fatima',
                passengerLastName: 'Al-Rashid',
                email: 'fatima.alrashid@example.com'
            }
        },
        {
            name: 'Erbil - Istanbul',
            data: {
                origin: 'EBL',
                destination: 'IST',
                departureDate: '2024-03-15',
                passengerFirstName: 'Mohammed',
                passengerLastName: 'Al-Khalil',
                email: 'mohammed.alkhalil@example.com'
            }
        },
        {
            name: 'Basra - Istanbul',
            data: {
                origin: 'BSR',
                destination: 'IST',
                departureDate: '2024-04-01',
                passengerFirstName: 'Aisha',
                passengerLastName: 'Al-Mahmoud',
                email: 'aisha.almahmoud@example.com'
            }
        },
        {
            name: 'Najaf - Istanbul',
            data: {
                origin: 'NJF',
                destination: 'IST',
                departureDate: '2024-04-15',
                passengerFirstName: 'Hassan',
                passengerLastName: 'Al-Saadi',
                email: 'hassan.alsaadi@example.com'
            }
        }
    ];

    console.log('🌍 Iraq Airlines Çoklu Biletleme Örnekleri');
    console.log('==========================================\n');

    for (const example of examples) {
        try {
            console.log(`📌 ${example.name} biletlemesi başlatılıyor...`);
            
            const primeBooking = new PrimeBookingCash();
            const result = await primeBooking.performBooking(example.data);
            
            console.log(`✅ ${example.name} biletlemesi tamamlandı!\n`);
            
        } catch (error) {
            console.error(`❌ ${example.name} biletlemesi hatası:`, error.message);
        }
    }
}

/**
 * WS-Security test fonksiyonu - Iraq Airlines credentials ile
 */
function testWSSecurity() {
    console.log('🔐 Iraq Airlines WS-Security Test');
    console.log('==================================\n');

    const WSSecurity = require('../utils/ws-security');
    
    // Iraq Airlines credentials ile test
    const wsSecurity = new WSSecurity('WSIAETN', 'Mohammed@1234');
    
    // Nonce oluştur
    const nonce = wsSecurity.generateNonce();
    console.log('Nonce:', nonce);
    
    // Created timestamp oluştur
    const created = wsSecurity.generateCreated();
    console.log('Created:', created);
    
    // Password digest oluştur
    const passwordDigest = wsSecurity.generatePasswordDigest(nonce, created);
    console.log('Password Digest:', passwordDigest);
    
    // Security header oluştur
    const securityHeader = wsSecurity.createSecurityHeader();
    console.log('\nSecurity Header:');
    console.log(securityHeader);
}

/**
 * Iraq Airlines konfigürasyon test fonksiyonu
 */
function testIraqAirlinesConfig() {
    console.log('🏢 Iraq Airlines Konfigürasyon Test');
    console.log('====================================\n');

    console.log('Office Bilgileri:');
    console.log('  - Office ID:', config.iraqAirlines.office.id);
    console.log('  - IATA Office ID:', config.iraqAirlines.office.iataId);
    console.log('  - Ülke:', config.iraqAirlines.office.country);
    console.log('  - Şehir:', config.iraqAirlines.office.city);
    
    console.log('\nAgency Bilgileri:');
    console.log('  - Agency Name:', config.iraqAirlines.agency.name);
    console.log('  - Sign:', config.iraqAirlines.agency.sign);
    console.log('  - Login ID:', config.iraqAirlines.agency.loginId);
    
    console.log('\nDestinasyonlar:');
    console.log('  - Istanbul:', config.iraqAirlines.destinations.istanbul);
    console.log('  - Baghdad:', config.iraqAirlines.destinations.baghdad);
    console.log('  - Erbil:', config.iraqAirlines.destinations.erbil);
    console.log('  - Basra:', config.iraqAirlines.destinations.basra);
    console.log('  - Najaf:', config.iraqAirlines.destinations.najaf);
    
    console.log('\nWS-Security Bilgileri:');
    console.log('  - Username:', config.amadeus.username);
    console.log('  - Password:', config.amadeus.password);
    console.log('  - Nonce Size:', config.wsSecurity.nonceSize);
    console.log('  - Hash Algorithm:', config.wsSecurity.hashAlgorithm);
}

// Ana fonksiyon
async function main() {
    try {
        // Iraq Airlines konfigürasyon test
        testIraqAirlinesConfig();
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // WS-Security test
        testWSSecurity();
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Tek biletleme örneği
        await exampleBooking();
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Çoklu biletleme örnekleri (isteğe bağlı)
        // await multipleBookingExamples();
        
    } catch (error) {
        console.error('Ana fonksiyon hatası:', error);
        process.exit(1);
    }
}

// Eğer bu dosya doğrudan çalıştırılırsa
if (require.main === module) {
    main();
}

module.exports = {
    exampleBooking,
    multipleBookingExamples,
    testWSSecurity,
    testIraqAirlinesConfig
}; 