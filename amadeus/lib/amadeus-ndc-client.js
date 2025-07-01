const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { parseStringPromise } = require('xml2js');
const WSSecurity = require('../utils/ws-security');
const config = require('../config/config');

/**
 * Amadeus NDC Client
 * Prime Booking 21.3 web servisleri için client sınıfı
 * Prime-Booking-213---Cash.xml dosyasındaki implementasyona göre yazılmıştır
 * SOAP istekleri için `axios` ve cookie yönetimi kullanır.
 */
class AmadeusNDCClient {
    constructor(clientConfig) {
        this.endpoint = clientConfig.endpoint || 'https://nodeA3.test.webservices.amadeus.com/1ASIWNDC4Z';
        this.username = clientConfig.username;
        this.password = clientConfig.password;
        this.wsSecurity = new WSSecurity(this.username, this.password);

        // Cookie'leri yönetecek axios istemcisi oluştur
        const jar = new CookieJar();
        this.client = wrapper(axios.create({ jar }));
    }

    /**
     * Ortak SOAP isteği gönderen metod
     * @param {string} action - SOAP Action
     * @param {string} requestBody - SOAP Body XML
     * @param {string} callName - Çağrıyı yapan fonksiyonun adı (loglama için)
     */
    async sendRequest(action, requestBody, callName) {
        try {
            const { envelope: soapEnvelope, security } = this.wsSecurity.createSoapEnvelope(requestBody, action);

            console.log(`\n--- 🔐 ${callName} Security Info ---`);
            console.log(`Password: ${security.password}`);
            console.log(`Nonce: ${security.nonce}`);
            console.log(`Created: ${security.created}`);
            console.log(`PasswordDigest: ${security.passwordDigest}`);
            console.log('-------------------------------------\n');

            console.log(`--- 📤 Sending ${callName} Request ---`);
            console.log(soapEnvelope);
            console.log(`--- 📤 End of ${callName} Request ---\n`);

            const { data } = await this.client.post(this.endpoint, soapEnvelope, {
                headers: {
                    'Content-Type': 'text/xml;charset=UTF-8',
                    'SOAPAction': action,
                },
            });

            console.log(`\n--- 📥 Received ${callName} Response ---`);
            console.log(data);
            console.log(`--- 📥 End of ${callName} Response ---\n`);

            const result = await parseStringPromise(data, {
                explicitArray: false,
                tagNameProcessors: [ (name) => name.replace(/^(soap:|ns3:|n1:)/, '') ]
            });
            
            return result.Envelope.Body;

        } catch (error) {
            console.error(`❌ Error in ${callName}:`);
            if (error.response) {
                console.error('Received Response (Error):', error.response.data);
            } else {
                console.error('Error Message:', error.message);
            }
            throw new Error(`An error occurred during ${callName}.`);
        }
    }

    /**
     * Ham XML şablonu ile istek gönderir.
     * @param {string} xmlTemplate - Değişkenler içeren XML şablonu.
     * @param {Object} searchCriteria - Uçuş arama kriterleri.
     */
    async sendRawRequest(xmlTemplate, searchCriteria) {
        // 1. Güvenlik ve diğer dinamik değerleri oluştur.
        const nonce = this.wsSecurity.generateNonce();
        const created = this.wsSecurity.generateCreated();
        const passwordDigest = this.wsSecurity.generatePasswordDigest(nonce, created);
        const messageId = 'uuid:' + this.wsSecurity.generateUUID();
        const action = 'http://webservices.amadeus.com/NDC_AirShopping_21.3';

        // 2. Loglama için güvenlik bilgilerini hazırla ve yazdır.
        console.log(`\n--- 🔐 Raw Test Request Security Info ---`);
        console.log(`Password: ${this.password}`);
        console.log(`Nonce: ${nonce}`);
        console.log(`Created: ${created}`);
        console.log(`PasswordDigest: ${passwordDigest}`);
        console.log('------------------------------------------\n');
        
        // 3. XML şablonundaki değişkenleri doldur.
        let soapEnvelope = xmlTemplate
            // Security Header
            .replace('##USER##', this.username)
            .replace('##PASSWORD_DIGEST##', passwordDigest)
            .replace('##NONCE##', nonce)
            .replace('##CREATED##', created)
            
            // Addressing Header
            .replace('##MESSAGE_ID##', messageId)
            .replace('##WSAP##', '1ASIWNDC4Z') // Endpoint'in sabit kısmı

            // AMA_SecurityHostedUser Header
            .replace('##OID##', config.amadeus.officeId)
            .replace(/##ORG##/g, 'IA') // CompanyName (birden çok yerde geçebilir)

            // Body - DistributionChain
            .replace('##SELLER_ID##', config.amadeus.officeId)
            .replace('##AGGREGATOR_ID##', config.amadeus.aggregator)

            // Body - POS
            .replace('##COUNTRY_CODE##', config.amadeus.countryCode)

            // Body - Flight Criteria
            .replace(/##DESTINATION##/g, searchCriteria.destination)
            .replace('##DEPARTURE_DATE##', searchCriteria.departureDate)
            .replace(/##ORIGIN##/g, searchCriteria.origin)
            .replace('##RETURN_DATE##', searchCriteria.returnDate);

        // Sonunda soapenv:Envelope etiketini soap:Envelope olarak düzeltelim.
        soapEnvelope = soapEnvelope.replace('</soapenv:Envelope>', '</soap:Envelope>');

        try {
            console.log(`--- 📤 Sending Raw Test Request ---`);
            console.log(soapEnvelope);
            console.log(`--- 📤 End of Raw Test Request ---\n`);

            const { data } = await this.client.post(this.endpoint, soapEnvelope, {
                headers: {
                    'Content-Type': 'text/xml;charset=UTF-8',
                    'SOAPAction': action,
                },
            });

            console.log(`\n--- 📥 Received Raw Test Response ---`);
            console.log(data);
            console.log(`--- 📥 End of Raw Test Response ---\n`);

            const result = await parseStringPromise(data, {
                explicitArray: false,
                tagNameProcessors: [(name) => name.replace(/^(soap:|ns3:|n1:|env:)/, '')]
            });

            return result.Envelope.Body;

        } catch (error) {
            console.error(`❌ Error in Raw Test Request:`);
            if (error.response) {
                console.error('Received Response (Error):', error.response.data);
            } else {
                console.error('Error Message:', error.message);
            }
            throw new Error(`An error occurred during Raw Test Request.`);
        }
    }

    /**
     * Air Shopping isteği gönderir
     * @param {Object} searchCriteria - Arama kriterleri
     */
    async airShopping(searchCriteria) {
        const action = 'http://webservices.amadeus.com/NDC_AirShopping_21.3';
        const requestBody = this.createAirShoppingRequest(searchCriteria);
        return this.sendRequest(action, requestBody, 'NDC_AirShopping');
    }

    /**
     * Offer Price isteği gönderir
     * @param {Object} offerData - Offer bilgileri
     */
    async offerPrice(offerData) {
        const action = 'http://webservices.amadeus.com/NDC_OfferPrice_21.3';
        const requestBody = this.createOfferPriceRequest(offerData);
        return this.sendRequest(action, requestBody, 'NDC_OfferPrice');
    }

    /**
     * Order Create isteği gönderir (Cash ödeme)
     * @param {Object} orderData - Sipariş bilgileri
     */
    async orderCreate(orderData) {
        const action = 'http://webservices.amadeus.com/NDC_OrderCreate_21.3';
        const requestBody = this.createOrderCreateRequest(orderData);
        return this.sendRequest(action, requestBody, 'NDC_OrderCreate');
    }

    /**
     * Air Shopping request XML'i oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     */
    createAirShoppingRequest(searchCriteria) {
        // SoapUI'den alınan ve çalıştığı teyit edilen XML şablonu kullanılıyor.
        return `
<n1:IATA_AirShoppingRQ xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:n2="http://www.altova.com/samplexml/other-namespace" xmlns:n1="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage" xmlns:cns="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersCommonTypes" xsi:schemaLocation="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage">
    <n1:DistributionChain>
        <cns:DistributionChainLink>
            <cns:Ordinal>1</cns:Ordinal>
            <cns:OrgRole>Seller</cns:OrgRole>
            <cns:ParticipatingOrg>
                <cns:OrgID>${config.amadeus.iataOfficeId}</cns:OrgID>
            </cns:ParticipatingOrg>
        </cns:DistributionChainLink>
        <cns:DistributionChainLink>
            <cns:Ordinal>2</cns:Ordinal>
            <cns:OrgRole>Distributor</cns:OrgRole>
            <cns:ParticipatingOrg>
                <cns:OrgID>${config.amadeus.aggregator}</cns:OrgID>
            </cns:ParticipatingOrg>
        </cns:DistributionChainLink>
        <cns:DistributionChainLink>
            <cns:Ordinal>3</cns:Ordinal>
            <cns:OrgRole>Carrier</cns:OrgRole>
            <cns:ParticipatingOrg>
                <cns:OrgID>IA</cns:OrgID>
            </cns:ParticipatingOrg>
        </cns:DistributionChainLink>
    </n1:DistributionChain>
    <n1:PayloadAttributes>
        <cns:VersionNumber>21.3</cns:VersionNumber>
    </n1:PayloadAttributes>
    <n1:POS>
        <cns:Country>
            <cns:CountryCode>${config.amadeus.countryCode}</cns:CountryCode>
        </cns:Country>
    </n1:POS>
    <n1:Request>
        <cns:FlightRequest>
            <cns:FlightRequestOriginDestinationsCriteria>
                <cns:OriginDestCriteria>
                    <cns:CabinType>
                        <cns:CabinTypeCode>5</cns:CabinTypeCode>
                        <cns:PrefLevel>
                            <cns:PrefLevelCode>Preferred</cns:PrefLevelCode>
                        </cns:PrefLevel>
                    </cns:CabinType>
                    <cns:DestArrivalCriteria>
                        <cns:IATA_LocationCode>${searchCriteria.destination}</cns:IATA_LocationCode>
                    </cns:DestArrivalCriteria>
                    <cns:OriginDepCriteria>
                        <cns:Date>${searchCriteria.departureDate}</cns:Date>
                        <cns:IATA_LocationCode>${searchCriteria.origin}</cns:IATA_LocationCode>
                    </cns:OriginDepCriteria>
                </cns:OriginDestCriteria>
                <cns:OriginDestCriteria>
                    <cns:CabinType>
                        <cns:CabinTypeCode>5</cns:CabinTypeCode>
                        <cns:PrefLevel>
                            <cns:PrefLevelCode>Preferred</cns:PrefLevelCode>
                        </cns:PrefLevel>
                    </cns:CabinType>
                    <cns:DestArrivalCriteria>
                        <cns:IATA_LocationCode>${searchCriteria.origin}</cns:IATA_LocationCode>
                    </cns:DestArrivalCriteria>
                    <cns:OriginDepCriteria>
                        <cns:Date>${searchCriteria.returnDate}</cns:Date>
                        <cns:IATA_LocationCode>${searchCriteria.destination}</cns:IATA_LocationCode>
                    </cns:OriginDepCriteria>
                </cns:OriginDestCriteria>
            </cns:FlightRequestOriginDestinationsCriteria>
        </cns:FlightRequest>
        <cns:PaxList>
            <cns:Pax>
                <cns:PaxID>PAX1</cns:PaxID>
                <cns:PTC>ADT</cns:PTC>
            </cns:Pax>
        </cns:PaxList>
        <cns:ResponseParameters>
            <cns:LangUsage>
                <cns:LangCode>EN</cns:LangCode>
            </cns:LangUsage>
        </cns:ResponseParameters>
    </n1:Request>
</n1:IATA_AirShoppingRQ>`.trim();
    }

    /**
     * Offer Price request XML'i oluşturur
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     */
    createOfferPriceRequest(offerData) {
        return `
            <n1:IATA_OfferPriceRQ xsi:schemaLocation="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:n1="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage" xmlns:cns="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersCommonTypes">
                <n1:DistributionChain>
                    <cns:DistributionChainLink>
                        <cns:Ordinal>1</cns:Ordinal>
                        <cns:OrgRole>Seller</cns:OrgRole>
                        <cns:ParticipatingOrg>
                            <cns:OrgID>${config.iraqAirlines.agency.name}</cns:OrgID>
                        </cns:ParticipatingOrg>
                    </cns:DistributionChainLink>
                    <cns:DistributionChainLink>
                        <cns:Ordinal>2</cns:Ordinal>
                        <cns:OrgRole>Distributor</cns:OrgRole>
                        <cns:ParticipatingOrg>
                            <cns:OrgID>${config.iraqAirlines.agency.name}</cns:OrgID>
                        </cns:ParticipatingOrg>
                    </cns:DistributionChainLink>
                    <cns:DistributionChainLink>
                        <cns:Ordinal>3</cns:Ordinal>
                        <cns:OrgRole>Carrier</cns:OrgRole>
                        <cns:ParticipatingOrg>
                            <cns:OrgID>IA</cns:OrgID>
                        </cns:ParticipatingOrg>
                    </cns:DistributionChainLink>
                </n1:DistributionChain>
                <n1:POS>
                    <cns:Country>
                        <cns:CountryCode>${config.booking.defaultCountryCode}</cns:CountryCode>
                    </cns:Country>
                </n1:POS>
                <n1:Request>
                    <cns:DataLists>
                        <cns:PaxList>
                            <cns:Pax>
                                <cns:PaxID>PAX1</cns:PaxID>
                                <cns:PTC>ADT</cns:PTC>
                            </cns:Pax>
                        </cns:PaxList>
                    </cns:DataLists>
                    <cns:PricedOffer>
                        <cns:SelectedOfferList>
                            <cns:SelectedOffer>
                                <cns:OfferRefID>${offerData.offerRefId}</cns:OfferRefID>
                                <cns:OwnerCode>IA</cns:OwnerCode>
                                <cns:SelectedOfferItem>
                                    <cns:OfferItemRefID>${offerData.offerItemRefId}</cns:OfferItemRefID>
                                    <cns:PaxRefID>PAX1</cns:PaxRefID>
                                </cns:SelectedOfferItem>
                            </cns:SelectedOffer>
                        </cns:SelectedOfferList>
                    </cns:PricedOffer>
                </n1:Request>
            </n1:IATA_OfferPriceRQ>
        `;
    }

    /**
     * Order Create request XML'i oluşturur (Cash ödeme)
     * Prime-Booking-213---Cash.xml'deki implementasyona göre
     */
    createOrderCreateRequest(orderData) {
        return `
            <n1:IATA_OrderCreateRQ xsi:schemaLocation="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:n1="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage" xmlns:cns="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersCommonTypes">
                <n1:DistributionChain xmlns="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersCommonTypes">
                    <DistributionChainLink>
                        <Ordinal>1</Ordinal>
                        <OrgRole>Seller</OrgRole>
                        <ParticipatingOrg>
                            <OrgID>${config.iraqAirlines.agency.name}</OrgID>
                        </ParticipatingOrg>
                    </DistributionChainLink>
                    <DistributionChainLink>
                        <Ordinal>2</Ordinal>
                        <OrgRole>Distributor</OrgRole>
                        <ParticipatingOrg>
                            <OrgID>${config.iraqAirlines.agency.name}</OrgID>
                        </ParticipatingOrg>
                    </DistributionChainLink>
                    <DistributionChainLink>
                        <Ordinal>3</Ordinal>
                        <OrgRole>Carrier</OrgRole>
                        <ParticipatingOrg>
                            <OrgID>IA</OrgID>
                        </ParticipatingOrg>
                    </DistributionChainLink>
                </n1:DistributionChain>
                <n1:POS xmlns="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage">
                    <cns:Country>
                        <cns:CountryCode>${config.booking.defaultCountryCode}</cns:CountryCode>
                    </cns:Country>
                </n1:POS>
                <n1:Request>
                    <cns:CreateOrder>
                        <cns:AcceptSelectedQuotedOfferList>
                            <cns:SelectedPricedOffer>
                                <cns:OfferRefID>${orderData.offerRefId}</cns:OfferRefID>
                                <cns:OwnerCode>IA</cns:OwnerCode>
                                <cns:SelectedOfferItem>
                                    <cns:OfferItemRefID>${orderData.offerItemRefId}</cns:OfferItemRefID>
                                    <cns:PaxRefID>PAX1</cns:PaxRefID>
                                </cns:SelectedOfferItem>
                            </cns:SelectedPricedOffer>
                        </cns:AcceptSelectedQuotedOfferList>
                    </cns:CreateOrder>
                    <cns:DataLists>
                        <cns:ContactInfoList>
                            <cns:ContactInfo>
                                <cns:ContactInfoID>CTCPAX1_1</cns:ContactInfoID>
                                <cns:EmailAddress>
                                    <cns:ContactTypeText>Home</cns:ContactTypeText>
                                    <cns:EmailAddressText>${orderData.email}</cns:EmailAddressText>
                                </cns:EmailAddress>
                                <cns:Individual>
                                    <cns:Surname>${orderData.passengerLastName}</cns:Surname>
                                </cns:Individual>
                                <cns:IndividualRefID>PAX1</cns:IndividualRefID>
                                <cns:Phone>
                                    <cns:AreaCodeNumber>813</cns:AreaCodeNumber>
                                    <cns:ContactTypeText>Mobile</cns:ContactTypeText>
                                    <cns:CountryDialingCode>964</cns:CountryDialingCode>
                                    <cns:PhoneNumber>+964123456789</cns:PhoneNumber>
                                </cns:Phone>
                            </cns:ContactInfo>
                            <cns:ContactInfo>
                                <cns:ContactInfoID>CTCPAX1_2</cns:ContactInfoID>
                                <cns:ContactPurposeText>NTF</cns:ContactPurposeText>
                                <cns:EmailAddress>
                                    <cns:EmailAddressText>${orderData.email}</cns:EmailAddressText>
                                </cns:EmailAddress>
                                <cns:Individual>
                                    <cns:Surname>${orderData.passengerLastName}</cns:Surname>
                                </cns:Individual>
                                <cns:IndividualRefID>PAX1</cns:IndividualRefID>
                            </cns:ContactInfo>
                        </cns:ContactInfoList>
                        <cns:PaxList>
                            <cns:Pax>
                                <cns:IdentityDoc>
                                    <cns:ExpiryDate>2025-08-13</cns:ExpiryDate>
                                    <cns:IdentityDocID>0123456789</cns:IdentityDocID>
                                    <cns:IdentityDocTypeCode>PT</cns:IdentityDocTypeCode>
                                    <cns:IssuingCountryCode>${config.booking.defaultCountryCode}</cns:IssuingCountryCode>
                                    <cns:ResidenceCountryCode>${config.booking.defaultCountryCode}</cns:ResidenceCountryCode>
                                    <cns:Surname>${orderData.passengerLastName}</cns:Surname>
                                </cns:IdentityDoc>
                                <cns:Individual>
                                    <cns:Birthdate>1990-01-01</cns:Birthdate>
                                    <cns:GenderCode>M</cns:GenderCode>
                                    <cns:GivenName>${orderData.passengerFirstName}</cns:GivenName>
                                    <cns:IndividualID>PAX1</cns:IndividualID>
                                    <cns:Surname>${orderData.passengerLastName}</cns:Surname>
                                    <cns:TitleName>MR</cns:TitleName>
                                </cns:Individual>
                                <cns:LangUsage>
                                    <cns:LangCode>EN</cns:LangCode>
                                </cns:LangUsage>
                                <cns:PaxID>PAX1</cns:PaxID>
                                <cns:PTC>ADT</cns:PTC>
                                <cns:Remark>
                                    <cns:RemarkText>TESTPDT</cns:RemarkText>
                                </cns:Remark>
                            </cns:Pax>
                        </cns:PaxList>
                    </cns:DataLists>
                    <cns:PaymentFunctions>
                        <cns:PaymentProcessingDetails>
                            <cns:Amount CurCode="${orderData.currency || 'USD'}">${orderData.totalAmount || '1500.00'}</cns:Amount>
                            <cns:PaymentMethod>
                                <cns:SettlementPlan>
                                    <cns:PaymentTypeCode>CA</cns:PaymentTypeCode>
                                </cns:SettlementPlan>
                            </cns:PaymentMethod>
                        </cns:PaymentProcessingDetails>
                    </cns:PaymentFunctions>
                </n1:Request>
            </n1:IATA_OrderCreateRQ>
        `;
    }

    /**
     * Benzersiz correlation ID oluşturur
     */
    generateCorrelationId() {
        return 'CORR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = AmadeusNDCClient; 