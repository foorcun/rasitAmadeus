# Iraq Airlines Amadeus NDC Prime Booking 21.3 - Cash Biletleme

Bu proje, Iraq Airlines için Amadeus NDC (New Distribution Capability) web servisleri kullanarak Prime Booking 21.3 ile Cash ödeme yöntemiyle biletleme yapan Node.js uygulamasıdır.

**Prime-Booking-213---Cash.xml** dosyasındaki gerçek SOAP UI implementasyonuna göre geliştirilmiştir.

## 🚀 Özellikler

- **WS-Security** ile güvenli kimlik doğrulama (Prime-Booking-213---Cash.xml'e göre)
- **NDC_AirShopping** - Uçuş arama (Test Case 1)
- **NDC_OfferPrice** - Fiyat sorgulama (Test Case 2)
- **NDC_OrderCreate** - Cash ödeme ile biletleme (Test Case 3)
- **Prime Booking 21.3** standardına uygun
- **Iraq Airlines** özel konfigürasyonu
- **Modüler yapı** ile kolay genişletilebilir kod

## 📋 Gereksinimler

- Node.js 14.x veya üzeri
- npm veya yarn
- Iraq Airlines Amadeus NDC hesabı ve kimlik bilgileri

## 🛠️ Kurulum

1. Projeyi klonlayın:
```bash
git clone <repository-url>
cd amadeus-ndc
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Ortam değişkenlerini ayarlayın (isteğe bağlı):
```bash
# .env dosyası oluşturun
AMADEUS_USERNAME=WSIAETN
AMADEUS_PASSWORD=Mohammed@1234
LOG_LEVEL=info
```

## 🔧 Konfigürasyon

`config/config.js` dosyasında Iraq Airlines için özel ayarlar bulunmaktadır:

- **Iraq Airlines Credentials**: WSIAETN / Mohammed@1234
- **Office ID**: BGWIA07ET
- **IATA Office ID**: 34492776
- **Country Code**: IQ
- **Aggregator**: ETN
- **Destinations**: BGW, EBL, BSR, NJF → IST

## 🎯 Kullanım

### Temel Kullanım

```javascript
const PrimeBookingCash = require('./index');

const primeBooking = new PrimeBookingCash();

const bookingData = {
    origin: 'BGW', // Baghdad
    destination: 'IST', // Istanbul
    departureDate: '2024-02-15',
    returnDate: '2024-02-22', // İsteğe bağlı
    passengerFirstName: 'Ahmed',
    passengerLastName: 'Al-Zahra',
    email: 'ahmed.alzahra@example.com'
};

// Biletleme sürecini başlat
const result = await primeBooking.performBooking(bookingData);
```

### Komut Satırından Çalıştırma

```bash
# Ana uygulama
npm start

# Örnek kullanım
npm run example

# Test
npm test
```

### Örnek Kullanım

```bash
node examples/booking-example.js
```

## 📁 Proje Yapısı

```
amadeus-ndc/
├── config/
│   └── config.js                    # Iraq Airlines konfigürasyonu
├── lib/
│   └── amadeus-ndc-client.js        # Amadeus NDC client
├── utils/
│   └── ws-security.js               # WS-Security utility
├── examples/
│   └── booking-example.js           # Iraq Airlines örnekleri
├── Prime-Booking-213---Cash.xml     # SOAP UI proje dosyası
├── index.js                         # Ana uygulama
├── package.json                     # Proje bağımlılıkları
└── README.md                        # Bu dosya
```

## 🔐 WS-Security (Prime-Booking-213---Cash.xml'e Göre)

Bu uygulama, Prime-Booking-213---Cash.xml dosyasındaki WS-Security implementasyonunu tam olarak takip eder:

### SOAP Header Yapısı
```xml
<soap:Header xmlns:si="http://www.amadeus.net/1axml-msg/schema/msg-header-1_0.xsd">
    <sec:AMA_SecurityHostedUser xmlns:sec="http://xml.amadeus.com/2010/06/Security_v1">
        <sec:UserID POS_Type="1" RequestorType="U" PseudoCityCode="BGWIA07ET" AgentDutyCode="SU">
            <typ:RequestorID>
                <iat:CompanyName>IA</iat:CompanyName>
            </typ:RequestorID>
        </sec:UserID>
    </sec:AMA_SecurityHostedUser>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
        <wsse:UsernameToken>
            <wsse:Username>WSIAETN</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">...</wsse:Password>
            <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">...</wsse:Nonce>
            <wsu:Created>...</wsu:Created>
        </wsse:UsernameToken>
    </wsse:Security>
    <wsa:Action>http://webservices.amadeus.com/NDC_AirShopping_21.3</wsa:Action>
    <wsa:MessageID>uuid:...</wsa:MessageID>
    <wsa:To>https://nodeA3.test.webservices.amadeus.com/1ASIWNDC4Z</wsa:To>
</soap:Header>
```

## 🏢 Iraq Airlines Bilgileri

- **Login ID**: WSIAETN
- **Sign**: 9999WS
- **Office ID**: BGWIA07ET
- **Password**: Mohammed@1234
- **IATA Office ID**: 34492776
- **Country Code**: IQ
- **Aggregator**: ETN
- **Carrier Code**: IA

## 📊 Biletleme Süreci (Prime-Booking-213---Cash.xml)

### 1. NDC_AirShopping (Test Case 1)
- Uçuş arama ve offer listesi alma
- Distribution Chain: Seller → Distributor → Carrier
- Cabin Type: Economy (5)
- Response'dan OfferID ve OfferItemID çıkarma

### 2. NDC_OfferPrice (Test Case 2)
- Seçilen offer için fiyat sorgulama
- SelectedOffer ve SelectedOfferItem kullanımı
- Response'dan TotalAmount ve CurCode çıkarma

### 3. NDC_OrderCreate (Test Case 3)
- Cash ödeme ile biletleme
- PaymentTypeCode: CA (Cash)
- ContactInfo ve PaxList detayları
- IdentityDoc bilgileri

## 🛡️ Güvenlik

- WS-Security ile güvenli iletişim (Prime-Booking-213---Cash.xml standardına uygun)
- Environment variables ile hassas bilgi koruması
- SSL/TLS şifreleme
- Nonce ve timestamp ile güvenlik
- SHA-1 hash algoritması
- UsernameToken authentication

## 🐛 Hata Ayıklama

Hata ayıklama için log seviyesini ayarlayabilirsiniz:

```bash
LOG_LEVEL=debug npm start
```

WS-Security debug bilgileri otomatik olarak gösterilir.

## 📝 Notlar

- Bu uygulama Iraq Airlines test ortamı için tasarlanmıştır
- Production kullanımı için ek güvenlik önlemleri alınmalıdır
- Prime-Booking-213---Cash.xml dosyasındaki implementasyon tam olarak takip edilmiştir
- XML response parsing kısımları gerçek response yapısına göre güncellenmelidir
- Cash ödeme yöntemi (CA) kullanılmaktadır

## 🌍 Destinasyonlar

Iraq Airlines için desteklenen destinasyonlar:
- **BGW** - Baghdad International Airport
- **EBL** - Erbil International Airport
- **BSR** - Basra International Airport
- **NJF** - Najaf International Airport
- **IST** - Istanbul Airport (hedef)

## 🔄 Test Case'ler

### Test Case 1: NDC_AirShopping
```xml
<wsa:Action>http://webservices.amadeus.com/NDC_AirShopping_21.3</wsa:Action>
```

### Test Case 2: NDC_OfferPrice
```xml
<wsa:Action>http://webservices.amadeus.com/NDC_OfferPrice_21.3</wsa:Action>
```

### Test Case 3: NDC_OrderCreate
```xml
<wsa:Action>http://webservices.amadeus.com/NDC_OrderCreate_21.3</wsa:Action>
```

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje ISC lisansı altında lisanslanmıştır.

## 📞 Destek

Sorularınız için issue açabilir veya iletişime geçebilirsiniz.

---

**Not**: Bu uygulama Iraq Airlines için eğitim amaçlıdır. Gerçek kullanım için Amadeus'un resmi dokümantasyonunu takip edin. Prime-Booking-213---Cash.xml dosyasındaki implementasyon tam olarak takip edilmiştir. 