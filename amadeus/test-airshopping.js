/**
 * Tek Adımlık AirShopping Test Script'i
 * 
 * Bu script, yalnızca WS-Security ve NDC_AirShopping adımlarını test ederek
 * '11|Session|' hatasını ayıklamak için kullanılır.
 */

const AmadeusNDCClient = require('./lib/amadeus-ndc-client');
const config = require('./config/config');

async function testAirShopping() {
    console.log('--- 🧪 Starting Isolated AirShopping Test ---');

    try {
        // 1. Amadeus Client'ı doğrudan oluştur
        const clientConfig = {
            endpoint: config.amadeus.endpoint,
            username: config.amadeus.username,
            password: config.amadeus.password
        };
        const client = new AmadeusNDCClient(clientConfig);

        // 2. Arama kriterlerini tanımla (SoapUI projesindeki gibi gidiş-dönüş)
        const searchCriteria = {
            origin: 'BGW',
            destination: 'IST',
            departureDate: '2024-08-01', // Gelecek bir tarih
            returnDate: '2024-08-08'      // Gelecek bir tarih
        };

        console.log('\nSearch Criteria:');
        console.log(searchCriteria);

        // 3. Yalnızca AirShopping isteğini gönder
        console.log('\n--- 🚀 Calling NDC_AirShopping... ---');
        const airShoppingResult = await client.airShopping(searchCriteria);

        console.log('\n--- ✅ AirShopping Test Successful ---');
        console.log('Full Response:', JSON.stringify(airShoppingResult, null, 2));

    } catch (error) {
        console.error('\n--- ❌ AirShopping Test Failed ---');
        console.error(error.message);
    } finally {
        console.log('\n--- 🧪 End of Isolated AirShopping Test ---');
    }
}

// Testi çalıştır
testAirShopping(); 