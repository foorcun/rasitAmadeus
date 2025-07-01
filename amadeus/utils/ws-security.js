const crypto = require('crypto');

/**
 * WS-Security utility fonksiyonları
 * Amadeus NDC web servisleri için güvenlik başlıkları oluşturur
 * Prime-Booking-213---Cash.xml dosyasındaki implementasyona göre yazılmıştır
 */

class WSSecurity {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }

    /**
     * Nonce (number used once) oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     * @returns {string} Base64 encoded nonce
     */
    generateNonce() {
        // SHA1PRNG ile 16 byte nonce oluştur
        const nonceValue = crypto.randomBytes(16);
        return nonceValue.toString('base64');
    }

    /**
     * Created timestamp oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     * @returns {string} ISO 8601 formatında timestamp (Zulu timezone)
     */
    generateCreated() {
        return new Date().toISOString();
    }
    

    /**
     * Password digest oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     * @param {string} nonce - Base64 encoded nonce
     * @param {string} created - ISO 8601 timestamp
     * @returns {string} Base64 encoded password digest
     */
    generatePasswordDigest(nonce, created) {
        // Bu fonksiyon, SoapUI'deki "password_digest" ve "password_encrypt" Groovy script'lerini
        // temel alarak yeniden yazılmıştır.

        // Adım 1: "password_encrypt" script'i - Parolayı SHA-1 ile hash'le.
        // Groovy: sha.update(password.getBytes("UTF-8")); return sha.digest();
        const passwordHashBytes = crypto.createHash('sha1').update(this.password, 'utf8').digest();

        // Adım 2: "password_digest" script'i - Nonce, Created ve hash'lenmiş parolayı birleştir.
        
        // Nonce'ı Base64'ten çöz.
        // Groovy: def b1 = nonce != null ? Base64.decode(nonce) : new byte[0];
        const nonceBytes = Buffer.from(nonce, 'base64');

        // Created timestamp'ini UTF-8 byte'larına çevir.
        // Groovy: def b2 = created != null ? created.getBytes("UTF-8") : new byte[0];
        const createdBytes = Buffer.from(created, 'utf8');

        // Üç byte grubunu birleştir: nonce + created + password_hash
        // Groovy: System.arraycopy(b1, ...); System.arraycopy(b2, ...); System.arraycopy(b3, ...);
        const combinedBytes = Buffer.concat([nonceBytes, createdBytes, passwordHashBytes]);

        // Adım 3: Birleştirilmiş byte'ları tekrar SHA-1 ile hash'le.
        // Groovy: sha.update(b4);
        const finalDigestBytes = crypto.createHash('sha1').update(combinedBytes).digest();

        // Adım 4: Sonucu Base64 ile kodla.
        // Groovy: passwdDigest = Base64.encode(sha.digest());
        const passwordDigest = finalDigestBytes.toString('base64');
        
        return passwordDigest;
    }

    /**
     * WS-Security header XML'i oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     * @returns {string} WS-Security header XML
     */
    createSecurityHeader() {
        const nonce = this.generateNonce();
        const created = this.generateCreated();
        const passwordDigest = this.generatePasswordDigest(nonce, created);

        const headerXML = `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><wsse:UsernameToken><wsse:Username>${this.username}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${passwordDigest}</wsse:Password><wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</wsse:Nonce><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security>`;
        
        return {
            headerXML,
            nonce,
            created,
            passwordDigest
        };
    }

    /**
     * Amadeus Security Hosted User header'ı oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     * @returns {string} Amadeus Security header XML
     */
    createAmadeusSecurityHeader() {
        return `<sec:AMA_SecurityHostedUser xmlns:sec="http://xml.amadeus.com/2010/06/Security_v1" xmlns:iat="http://www.iata.org/IATA/2007/00/IATA2010.1" xmlns:typ="http://xml.amadeus.com/2010/06/Types_v1"><sec:UserID POS_Type="1" RequestorType="U" PseudoCityCode="BGWIA07ET" AgentDutyCode="SU"><typ:RequestorID><iat:CompanyName>IA</iat:CompanyName></typ:RequestorID></sec:UserID></sec:AMA_SecurityHostedUser>`;
    }

    /**
     * SOAP envelope oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     * @param {string} body - SOAP body içeriği
     * @param {string} action - SOAP action
     * @returns {string} Tam SOAP envelope
     */
    createSoapEnvelope(body, action = 'http://webservices.amadeus.com/NDC_AirShopping_21.3') {
        const { headerXML: securityHeader, nonce, created, passwordDigest } = this.createSecurityHeader();
        const amadeusSecurityHeader = this.createAmadeusSecurityHeader();
        const messageId = 'uuid:' + this.generateUUID();
        
        const envelope = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservices.amadeus.com"><soap:Header xmlns:si="http://www.amadeus.net/1axml-msg/schema/msg-header-1_0.xsd">${amadeusSecurityHeader}${securityHeader}<wsa:Action xmlns:wsa="http://www.w3.org/2005/08/addressing">${action}</wsa:Action><wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">${messageId}</wsa:MessageID><wsa:To xmlns:wsa="http://www.w3.org/2005/08/addressing">https://nodeA3.test.webservices.amadeus.com/1ASIWNDC4Z</wsa:To></soap:Header><soap:Body>${body}</soap:Body></soap:Envelope>`;

        return {
            envelope,
            security: {
                password: this.password, // loglama için
                nonce,
                created,
                passwordDigest
            }
        }
    }

    /**
     * UUID oluşturur
     * @returns {string} UUID string
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Debug için WS-Security bilgilerini gösterir
     */
    debugSecurityInfo() {
        const nonce = this.generateNonce();
        const created = this.generateCreated();
        const passwordDigest = this.generatePasswordDigest(nonce, created);

        console.log('🔐 WS-Security Debug Bilgileri:');
        console.log('================================');
        console.log('Username:', this.username);
        console.log('Nonce:', nonce);
        console.log('Created:', created);
        console.log('Password Digest:', passwordDigest);
        console.log('================================\n');

        return {
            username: this.username,
            nonce,
            created,
            passwordDigest
        };
    }
}

module.exports = WSSecurity; 