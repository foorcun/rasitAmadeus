const AmadeusNDCClient = require('./lib/amadeus-ndc-client');
const config = require('./config/config');
const mapper = require('./utils/mapper');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const { validateWithReference } = require('./utils/validator');
const app = express();
const port = 3050;

// Middleware
app.use(cors());
app.use(express.json());

// Constants
const AUTH_CODE = '162CFBB9D3CE237F20B04BE345413882E7470E32';
const AUTH_SECRET = 'Ketic2025@';
const endpoint = '/flight';
//const endpoint = '/flight/jastravel/flyadeal';
const isProd = false;
const tokenStorage = new Map();
const TOKEN_TTL = 3600000; // 1 saatlik token

// Fare storage for /fare endpoint
const fareStorage = new Map();
const FARE_TTL = 1800000; // 30 dakikalık fare

function generateToken() {
    return "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE3NDk5MDg3MTEsImlhdCI6MTc0OTgyMjMxMSwiYXV0aGNvZGUiOiJENkY0RThBREIxQjNGRkM4QkM4QkNDQzgxMUVGNzY0NUFFQTIxRUJFIiwiYXBwbGljYXRpb25zIjpbeyJhcHBsaWNhdGlvbkNvZGUiOiJiMmItZmxpZ2h0LmFwaS5pYXRpLmNvbSIsImNlcnRpZmljYXRlZCI6dHJ1ZSwicGVybWlzc2lvbnMiOltdfV0sInNjb3BlcyI6WyJiMmItZmxpZ2h0LmFwaS5pYXRpLmNvbSJdfQ.Aq-25GQ5S1nDP-hWEATBrPJL-21eYme6VCT004buJIg8KpQFtj2OW26zgm1GgHsN8yOc59fSlAfLkqbTRwrNGv6eOz_b5JajoDAcsCYAoabz4WjOet6Mefg0jLwScQ9vVMDzO44vg5jbi5seLn5BiTJwqiSD0MKwqsUH7dOahR-nAG7gbwfK4KAir5x0UmNn9JqpO6KKvvYUuYLOjE_nFkzvvj_Kwv_TsCAKuiVEUuk_QgbH-SVyq1qW5Lbqym-x9E8h7TPJCGmY4zVqAV0mxlVVW6A3rzy7ASjaInk3jrlcVpZxUrPvnrbWSKwCehm4rD_7GS39hoq8wflHzL9JRQ";
}

function storeToken(token) {
    const expiresAt = Date.now() + TOKEN_TTL;
    tokenStorage.set(token, {
        token: token,
        expiresAt: expiresAt,
        createdAt: Date.now()
    });
    console.log(`Token kaydedildi. Geçerlilik süresi: ${new Date(expiresAt).toLocaleString('tr-TR')}`);
}

function isTokenValid(token) {
    const tokenData = tokenStorage.get(token);
    if (!tokenData) {
        console.log('Token bulunamadı');
        return false;
    }
    
    if (Date.now() > tokenData.expiresAt) {
        console.log('Token süresi dolmuş');
        tokenStorage.delete(token);
        return false;
    }
    
    console.log(`Token geçerli. Kalan süre: ${Math.round((tokenData.expiresAt - Date.now()) / 1000)} saniye`);
    return true;
}

function cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of tokenStorage.entries()) {
        if (now > data.expiresAt) {
            tokenStorage.delete(token);
            console.log('Süresi dolmuş token silindi');
        }
    }
}

// Her 5 dakikada bir süresi dolmuş token'ları temizle
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

// Tüm gelen istek ve yanıtları loglayan middleware
app.use((req, res, next) => {
    const chunks = [];
    const oldWrite = res.write;
    const oldEnd = res.end;
  
    // İstek logu
    console.log('--- İSTEK ---');
    console.log(req.method, req.originalUrl);
    console.log('Headers:', req.headers);
    if (req.method !== 'GET') {
      console.log('Body:', req.body);
    }
  
    // Yanıt logu için response'u sarmala
    res.write = function (chunk, ...args) {
      chunks.push(Buffer.from(chunk));
      return oldWrite.apply(res, [chunk, ...args]);
    };
    res.end = function (chunk, ...args) {
      if (chunk) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString('utf8');
      console.log('--- YANIT ---');
      console.log('Status:', res.statusCode);
      try {
        console.log('Body:', JSON.stringify(JSON.parse(body), null, 2));
      } catch {
        console.log('Body:', body);
      }
      return oldEnd.apply(res, [chunk, ...args]);
    };
    next();
  });

  // Mock token endpoint
app.get(`${endpoint}/auth/token`, (req, res) => {
    try {
      // Eğer production değilse, kontrolleri atla
      if (!isProd) {
        const mockToken = generateToken();
        storeToken(mockToken);
  
        // Dinamik alanlar
        const reference = crypto.randomUUID();
        const request_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
        const response = {
          "audit": {
            "test": true,
            "reference": reference,
            "request_ip": request_ip,
            "service": "get-jwt-token",
            "timestamp": timestamp
          },
          "result": {
            "token": mockToken
          }
        };
  
        return res.status(200).json(response);
      }

      // Production modunda normal kontroller
      // Get Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({
          error: {
            status: 401,
            statusText: 'Unauthorized',
            message: 'Missing or invalid authorization header'
          }
        });
      }
  
      // Decode base64 auth string
      const base64Auth = authHeader.split(' ')[1];
      const authString = Buffer.from(base64Auth, 'base64').toString();
      const [code, secret] = authString.split(':');
  
      // Validate credentials
      if (code !== AUTH_CODE || secret !== AUTH_SECRET) {
        return res.status(401).json({
          error: {
            status: 401,
            statusText: 'Unauthorized',
            message: 'Invalid credentials'
          }
        });
      }
  
      // Yeni token üret ve kaydet
      const mockToken = generateToken();
      storeToken(mockToken);
  
      // Dinamik alanlar
      const reference = crypto.randomUUID();
      const request_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
      const response = {
        "audit": {
          "test": true,
          "reference": reference,
          "request_ip": request_ip,
          "service": "get-jwt-token",
          "timestamp": timestamp
        },
        "result": {
          "token": mockToken
        }
      };
  
      return res.status(200).json(response);
  
    } catch (error) {
      console.error('Token alma hatası:', error);
      return res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Bilinmeyen hata',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  });

// XML şablonu oluşturma fonksiyonu
function createXmlTemplate(hasReturnFlight) {
    const returnFlightXml = hasReturnFlight ? `
                <cns:OriginDestCriteria><!--For a OneWay Trip, remove this second OriginDestCriteria node-->
                    <cns:CabinType>	                        	                       
                        <cns:CabinTypeCode>5</cns:CabinTypeCode>
                        <cns:PrefLevel>
                        	<cns:PrefLevelCode>Preferred</cns:PrefLevelCode>
                        </cns:PrefLevel>                     	
                    </cns:CabinType>
                    <cns:DestArrivalCriteria>
                        <cns:IATA_LocationCode>##ORIGIN##</cns:IATA_LocationCode>
                    </cns:DestArrivalCriteria>
                    <cns:OriginDepCriteria>
                        <cns:Date>##RETURN_DATE##</cns:Date>
                        <cns:IATA_LocationCode>##DESTINATION##</cns:IATA_LocationCode>
                    </cns:OriginDepCriteria>
                </cns:OriginDestCriteria>` : '';

    return `
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservices.amadeus.com">
	<soap:Header xmlns:si="http://www.amadeus.net/1axml-msg/schema/msg-header-1_0.xsd">    
	<sec:AMA_SecurityHostedUser xmlns:sec="http://xml.amadeus.com/2010/06/Security_v1"  xmlns:iat="http://www.iata.org/IATA/2007/00/IATA2010.1" xmlns:typ="http://xml.amadeus.com/2010/06/Types_v1">        
		<sec:UserID POS_Type="1" RequestorType="U" PseudoCityCode="BGWIA07ET" AgentDutyCode="SU">            
			<typ:RequestorID>                
				<iat:CompanyName>IA</iat:CompanyName>           
			</typ:RequestorID>        
		</sec:UserID>    
	</sec:AMA_SecurityHostedUser>        
	<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">        
		<wsse:UsernameToken>            
			<wsse:Username>WSIAETN</wsse:Username>            
			<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">##PASSWORD_DIGEST##</wsse:Password>            
			<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">##NONCE##</wsse:Nonce>            
			<wsu:Created>##CREATED##</wsu:Created>        
		</wsse:UsernameToken>    
	</wsse:Security>        
		<wsa:Action xmlns:wsa="http://www.w3.org/2005/08/addressing">http://webservices.amadeus.com/NDC_AirShopping_21.3</wsa:Action>
		<wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">uuid:eb3d0bac-b5a3-42cd-a5ae-96a87ef88e64</wsa:MessageID>    
		<wsa:To xmlns:wsa="http://www.w3.org/2005/08/addressing">https://nodeA3.test.webservices.amadeus.com/1ASIWNDCIAW</wsa:To>    
	</soap:Header>
<soap:Body> 
        <n1:IATA_AirShoppingRQ xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:n2="http://www.altova.com/samplexml/other-namespace" xmlns:n1="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage" xmlns:cns="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersCommonTypes" xsi:schemaLocation="http://www.iata.org/IATA/2015/EASD/00/IATA_OffersAndOrdersMessage">
	 <n1:DistributionChain>
           <cns:DistributionChainLink>
                <cns:Ordinal>1</cns:Ordinal>
                <cns:OrgRole>Seller</cns:OrgRole>
                <cns:ParticipatingOrg>
                    <cns:OrgID>34492776</cns:OrgID>
                </cns:ParticipatingOrg>
            </cns:DistributionChainLink>
            <cns:DistributionChainLink>
                <cns:Ordinal>2</cns:Ordinal>
                <cns:OrgRole>Distributor</cns:OrgRole>
                <cns:ParticipatingOrg>
                    <cns:OrgID>ETN</cns:OrgID>
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
	            <cns:CountryCode>IQ</cns:CountryCode>
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
	                        <cns:IATA_LocationCode>##DESTINATION##</cns:IATA_LocationCode>
	                    </cns:DestArrivalCriteria>
	                    <cns:OriginDepCriteria>
	                        <cns:Date>##DEPARTURE_DATE##</cns:Date>
	                        <cns:IATA_LocationCode>##ORIGIN##</cns:IATA_LocationCode>
	                    </cns:OriginDepCriteria>
	                </cns:OriginDestCriteria>${returnFlightXml}
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
	</n1:IATA_AirShoppingRQ>
    </soap:Body>
</soapenv:Envelope>
`;
}

const client = new AmadeusNDCClient(config.amadeus);

// Test için arama kriterleri
const searchCriteria = {
    origin: 'BGW',
    destination: 'EBL',
    departureDate: '2025-08-15',
    returnDate: '2025-08-25',
};

function mapperx(data) {
	const root = data["ns4:IATA_AirShoppingRS"]["ns4:Response"];
	const marketingSegments = root.DataLists.DatedMarketingSegmentList.DatedMarketingSegment;
	const journeys = root.DataLists.PaxJourneyList.PaxJourney;
	const paxSegments = root.DataLists.PaxSegmentList.PaxSegment;
	const offers = root.OffersGroup.CarrierOffers.Offer;
  
	const marketingMap = Object.fromEntries(
	  marketingSegments.map(seg => [seg.DatedMarketingSegmentId, seg])
	);
  
	const paxSegmentMap = Object.fromEntries(
	  paxSegments.map(ps => [ps.PaxSegmentID, marketingMap[ps.DatedMarketingSegmentRefId]])
	);
  
	journeys.forEach((journey, idx) => {
	  console.log("\n📦 Uçuş " + (idx + 1));
	  const segments = journey.PaxSegmentRefID.map(id => paxSegmentMap[id]);
  
	  const airlineSet = new Set();
	  const flightCodes = [];
  
	  let firstDep = segments[0].Dep.IATA_LocationCode;
	  let lastArr = segments[segments.length - 1].Arrival.IATA_LocationCode;
	  let depTime = segments[0].Dep.AircraftScheduledDateTime;
	  let arrTime = segments[segments.length - 1].Arrival.AircraftScheduledDateTime;
  
	  segments.forEach(seg => {
		const flightCode = `${seg.CarrierDesigCode}${seg.MarketingCarrierFlightNumberText}`;
		flightCodes.push(flightCode);
		airlineSet.add(seg.CarrierDesigCode);
  
		console.log(`   ✈️ ${flightCode}: ${seg.Dep.IATA_LocationCode} (${seg.Dep.AircraftScheduledDateTime}) -> ${seg.Arrival.IATA_LocationCode} (${seg.Arrival.AircraftScheduledDateTime})`);
	  });
  
	  console.log(`   📍 Rota: ${firstDep} → ${lastArr}`);
	  console.log(`   ⏱️ Süre: ${journey.Duration}`);
	  console.log(`   🏢 Havayolu: ${[...airlineSet].join(", ")}`);
	  console.log(`   🔁 Aktarma: ${segments.length > 1 ? "Evet" : "Hayır"}`);
	  console.log(`   🔢 Uçuş Kodları: ${flightCodes.join(", ")}`);
  
	  const relatedOffer = offers.find(o =>
		o.OfferItem.Service.OfferServiceAssociation.PaxJourneyRef.PaxJourneyRefID.includes(journey.PaxJourneyID)
	  );
  
	  if (relatedOffer) {
		const price = relatedOffer.OfferItem.Price.TotalAmount;
		console.log(`   💰 Fiyat: ${price._} ${price.$.CurCode}`);
	  }
	});
  }

async function runRawTest() {
    try {
        console.log('--- Starting Raw XML Test ---');
        const hasReturnFlight = !!searchCriteria.returnDate;
        const xmlTemplate = createXmlTemplate(hasReturnFlight);
        const response = await client.sendRawRequest(xmlTemplate, searchCriteria);
        mapper(response, [{type: 'ADULT', count: 1}]);
        //console.log('✅ Raw Test Succeeded:', JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('❌ Raw Test Failed:', error.message);
    }
}

//runRawTest(); 


// Mock flight search endpoint
app.post(`${endpoint}/flight/v2/search`, async (req, res) => {
	try {
	  // Eğer production değilse, token kontrollerini atla
	  if (isProd) {
		// Bearer token kontrolü
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
		  return res.status(401).json({
			error: {
			  status: 401,
			  statusText: 'Unauthorized',
			  message: 'Missing or invalid Bearer token'
			}
		  });
		}
  
		// Token kontrolü - yeni storage sistemi ile
		const token = authHeader.split(' ')[1];
		if (!isTokenValid(token)) {
		  return res.status(401).json({
			error: {
			  status: 401,
			  statusText: 'Unauthorized',
			  message: 'Invalid or expired Bearer token'
			}
		  });
		}
	  }
  
	  // İstekten parametreleri çek
	  const origin = req.body.from_destination?.code || 'IST';
	  const destination = req.body.to_destination?.code || 'AYT';
	  const departureDate = req.body.departure_date || '2025-06-20';
	  const returnDate = req.body.return_date || null;

	  const searchCriteria2 = {
		origin: origin,
		destination: destination,
		departureDate: departureDate,
		returnDate: returnDate,
	};

	  
  
	  // pax_list'i işle
	  let adultCount = 0, childCount = 0, infantCount = 0;
	  if (Array.isArray(req.body.pax_list)) {
		req.body.pax_list.forEach(pax => {
		  if (pax.type === 'ADULT') adultCount += pax.count || 0;
		  if (pax.type === 'CHILD') childCount += pax.count || 0;
		  if (pax.type === 'INFANT') infantCount += pax.count || 0;
		});
	  } else {
		adultCount = 1;
	  }
  
	  // Gerçek Sabre uçuş araması ve mapping
	  try {
		// Return flight var mı kontrol et
		const hasReturnFlight = !!returnDate;
		const xmlTemplate = createXmlTemplate(hasReturnFlight);
		
		const response = await client.sendRawRequest(xmlTemplate, searchCriteria2);
		const flights = mapper.mapIATAResponse(response, req.body.pax_list);
		const reference = JSON.parse(fs.readFileSync('response.json', 'utf8'));
        // Karşılaştır ve sonucu yazdır
        validateWithReference(flights, reference);
		
		// Fare'ları store et
		if (flights.result && flights.result.departure_flights) {
			flights.result.departure_flights.forEach(flight => {
				if (flight.fares && flight.fares.length > 0) {
					flight.fares.forEach(fare => {
						storeFare(fare.fare_key, {
							flights: flight.legs,
							fare_info: fare.fare_info
						});
					});
				}
			});
		}
		
		if (flights.result && flights.result.return_flights) {
			flights.result.return_flights.forEach(flight => {
				if (flight.fares && flight.fares.length > 0) {
					flight.fares.forEach(fare => {
						storeFare(fare.fare_key, {
							flights: flight.legs,
							fare_info: fare.fare_info
						});
					});
				}
			});
		}
		
		//const gecici = fs.readFileSync('response.json', 'utf8');
		return res.status(200).json(flights);
	  } catch (err) {
		return res.status(500).json({
		  error: {
			message: err instanceof Error ? err.message : 'Mapping/validation hatası',
			stack: err instanceof Error ? err.stack : undefined
		  }
		});
	  }
	} catch (error) {
	  console.error('Flight search error:', error);
	  return res.status(500).json({
		error: {
		  message: error instanceof Error ? error.message : 'Unknown error',
		  stack: error instanceof Error ? error.stack : undefined
		}
	  });
	}
  });


  // Mock fare detail endpoint
app.post(`${endpoint}/flight/v2/fare`, async (req, res) => {
	try {
	  // Eğer production değilse, token kontrollerini atla
	  if (isProd) {
		// Bearer token kontrolü
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
		  return res.status(401).json({
			error: {
			  status: 401,
			  statusText: 'Unauthorized',
			  message: 'Missing or invalid Bearer token'
			}
		  });
		}
  
		// Token kontrolü - yeni storage sistemi ile
		const token = authHeader.split(' ')[1];
		if (!isTokenValid(token)) {
		  return res.status(401).json({
			error: {
			  status: 401,
			  statusText: 'Unauthorized',
			  message: 'Invalid or expired Bearer token'
			}
		  });
		}
	  }

  
	  // İstekten parametreleri çek
	  const { departure_fare_key, return_fare_key, pax_list } = req.body;
  
	  if (!departure_fare_key) {
		return res.status(400).json({
		  error: {
			status: 400,
			statusText: 'Bad Request',
			message: 'departure_fare_key is required'
		  }
		});
	  }
  
	  // Departure fare'ı al
	  const departureFare = getFare(departure_fare_key);
	  if (!departureFare) {
		return res.status(404).json({
		  error: {
			status: 404,
			statusText: 'Not Found',
			message: 'Departure fare not found or expired'
		  }
		});
	  }
  
	  // Return fare'ı al (eğer varsa)
	  let returnFare = null;
	  if (return_fare_key) {
		returnFare = getFare(return_fare_key);
		if (!returnFare) {
		  return res.status(404).json({
			error: {
			  status: 404,
			  statusText: 'Not Found',
			  message: 'Return fare not found or expired'
			}
		  });
		}
	  }
  
	  // Yolcu listesini işle
	  let adultCount = 0, childCount = 0, infantCount = 0;
	  if (Array.isArray(pax_list)) {
		pax_list.forEach(pax => {
		  if (pax.type === 'ADULT') adultCount += pax.count || 0;
		  if (pax.type === 'CHILD') childCount += pax.count || 0;
		  if (pax.type === 'INFANT') infantCount += pax.count || 0;
		});
	  } else {
		adultCount = 1;
	  }
  
	  // Fare detail response'unu oluştur
	  const fareDetailKey = `TQzOTUtYmM1NC0zMjEwZGFhNDkwZTE6YjM1ZTBhNzUtZ${Date.now()}`;
	  
	  const response = {
		  "audit": {
			  "test": true,
			  "reference": generateUUID(),
			  "request_ip": req.headers['x-forwarded-for'] || req.socket.remoteAddress || '45.157.16.26',
			  "service": "fare",
			  "timestamp": new Date().toISOString().replace('T', ' ').substring(0, 19)
		  },
		  "result": {
			  "fare_detail_key": fareDetailKey,
			  "fare_detail": {
				  "currency_code": departureFare.fare_info?.fare_detail?.currency_code || "IQD",
				  "price_info": {
					  "total_fare": departureFare.fare_info?.fare_detail?.price_info?.total_fare || 150.5,
					  "base_fare": departureFare.fare_info?.fare_detail?.price_info?.base_fare || 110.5,
					  "service_fee": departureFare.fare_info?.fare_detail?.price_info?.service_fee || 10,
					  "agency_commission": departureFare.fare_info?.fare_detail?.price_info?.agency_commission || 5,
					  "tax": departureFare.fare_info?.fare_detail?.price_info?.tax || 20,
					  "supplement": departureFare.fare_info?.fare_detail?.price_info?.supplement || 5
				  },
				  "pax_fares": departureFare.fare_info?.fare_detail?.pax_fares?.map(paxFare => ({
					  "currency_code": paxFare.currency_code,
					  "price_info": paxFare.price_info,
					  "pax_type": paxFare.pax_type,
					  "number_of_pax": paxFare.number_of_pax,
					  "baggage_allowances": paxFare.baggage_allowances || [],
					  "cabin_baggage_allowances": paxFare.cabin_baggage_allowances || []
				  })) || []
			  },
			  "offers": [
				  {
					  "offer_key": `ZTAwNi00N2M4LTlmZGEtMDZjM${Date.now()}`,
					  "offer_details": [
						  {
							  "name": "KK.economypromo",
						  }
					  ],
					  "fares": departureFare.fare_info?.fare_detail?.pax_fares?.map(paxFare => ({
						  "currency_code": paxFare.currency_code,
						  "price_info": paxFare.price_info,
						  "pax_type": paxFare.pax_type,
						  "number_of_pax": paxFare.number_of_pax,
						  "baggage_allowances": paxFare.baggage_allowances || [],
						  "cabin_baggage_allowances": paxFare.cabin_baggage_allowances || []
					  })) || [],
					  "services": departureFare.flights?.map(flight => ({
						  "service_id": generateUUID(),
						  "service_type": "Baggage",
						  "description": "Checked baggage allowance",
						  "chargeable_type": "INCLUDED_IN_PRICE",
						  "media_items": [
							  "baggage_icon.png"
						  ],
						  "explanation_texts": [
							  "15 kg checked baggage included"
						  ],
						  "offer_legs": [
							  {
								  "from": flight.departure_info?.airport_code || flight.from,
								  "to": flight.arrival_info?.airport_code || flight.to,
								  "departure_time": flight.departure_info?.date || flight.departure_time,
								  "arrival_time": flight.arrival_info?.date || flight.arrival_time,
								  "flight_number": flight.flight_number,
								  "flight_class": flight.airline_info?.carrier_code || flight.class_code,
								  "operator_airline_code": flight.airline_info?.operator_code || flight.operator_airline_code,
								  "marketing_airline_code": flight.airline_info?.carrier_code || flight.marketing_airline_code,
								  "segment_status": "CONFIRMED",
								  "fare_basis_code": flight.airline_info?.carrier_code || flight.class_code
							  }
						  ],
						  "supplier_code": "IA"
					  })) || [],
					  "total_price": departureFare.fare_info?.fare_detail?.price_info?.total_fare || 150.5,
					  "currency_code": departureFare.fare_info?.fare_detail?.currency_code || "EUR",
					  "fare_type": "ECONOMY",
					  "non_refundable": true,
					  "can_book": true,
					  "can_rezerve": true,
					  "last_ticket_date": "2019-12-20 07:57:19.000+0000",
					  "change_rules": [
						  {
							  "type": "REFUND",
							  "before_departure_status": "PERMITTED",
							  "after_departure_status": "PERMITTED"
						  }
					  ],
					  "offer_type": "FLIGHT_OFFER",
					  "default_offer": true,
					  "booking_classes": departureFare.flights?.map(flight => ({
						  "departure_airport": flight.departure_info?.airport_code || flight.from,
						  "arrival_airport": flight.arrival_info?.airport_code || flight.to,
						  "carrier": flight.airline_info?.operator_code || flight.operator_airline_code,
						  "flight_number": flight.flight_number,
						  "class_code": flight.airline_info?.carrier_code || flight.class_code
					  })) || []
				  }
			  ],
			  "departure_selected_flights": departureFare.flights?.map(flight => ({
				  "flight": {
					  "from": flight.departure_info?.airport_code || flight.from,
					  "to": flight.arrival_info?.airport_code || flight.to,
					  "departure_time": flight.departure_info?.date || flight.departure_time,
					  "arrival_time": flight.arrival_info?.date || flight.arrival_time,
					  "flight_number": flight.flight_number,
					  "operator_airline_code": flight.airline_info?.operator_code || flight.operator_airline_code,
					  "marketing_airline_code": flight.airline_info?.carrier_code || flight.marketing_airline_code,
					  "class_code": flight.airline_info?.carrier_code || flight.class_code,
					  "cabin_type": "ECONOMY"
				  },
				  "stop_airports": [
					  {
						  "airport_code": flight.departure_info?.airport_code || flight.from,
						  "notes": [
							  "Direct flight"
						  ]
					  }
				  ],
				  "change_rules": [
					  {
						  "type": "REFUND",
						  "before_departure_status": "PERMITTED",
						  "after_departure_status": "PERMITTED"
					  }
				  ]
			  })) || [],
			  "return_selected_flight": returnFare?.flights?.map(flight => ({
				  "flight": {
					  "from": flight.departure_info?.airport_code || flight.from,
					  "to": flight.arrival_info?.airport_code || flight.to,
					  "departure_time": flight.departure_info?.date || flight.departure_time,
					  "arrival_time": flight.arrival_info?.date || flight.arrival_time,
					  "flight_number": flight.flight_number,
					  "operator_airline_code": flight.airline_info?.operator_code || flight.operator_airline_code,
					  "marketing_airline_code": flight.airline_info?.carrier_code || flight.marketing_airline_code,
					  "class_code": flight.airline_info?.carrier_code || flight.class_code,
					  "cabin_type": "ECONOMY"
				  },
				  "stop_airports": [
					  {
						  "airport_code": flight.departure_info?.airport_code || flight.from,
						  "notes": [
							  "Direct flight"
						  ]
					  }
				  ],
				  "change_rules": [
					  {
						  "type": "REFUND",
						  "before_departure_status": "PERMITTED",
						  "after_departure_status": "PERMITTED"
					  }
				  ]
			  })) || [],
			  "flight_informations": [
				  {
					  "provider_key": "string",
					  "provider_warnings": [
						  {
							  "operator_code": "string",
							  "operator_name": "string",
							  "description": "string"
						  }
					  ],
					  "baggage_warnings": [
						  {
							  "operator_code": "string",
							  "operator_name": "string",
							  "description": "string"
						  }
					  ],
					  "change_infos": [
						  "PRICE_CHANGED"
					  ],
					  "permitted_actions": [
						  "REFUND"
					  ],
					  "pnr_requirements": [
						  "CONTACT_EMAIL"
					  ],
					  "pax_requirements": [
						  {
							  "pax_type": "ADULT",
							  "pax_requirements": [
								  "MILES_MEMBER_ID"
							  ]
						  }
					  ]
				  }
			  ],
			  "office": {
				  "office_id": 0,
				  "office_name": "string"
			  },
			  "multiprovider": true
		  }
	  };
  
	  return res.status(200).json(response);
  
	} catch (error) {
	  console.error('Fare detail error:', error);
	  return res.status(500).json({
		error: {
		  message: error instanceof Error ? error.message : 'Unknown error',
		  stack: error instanceof Error ? error.stack : undefined
		}
	  });
	}
  });
  

  // Start server
app.listen(port, () => {
	console.log(`Mock API server running at http://localhost:${port}`);
  }); 

function generateUUID() {
    return crypto.randomUUID();
}

function storeFare(fareKey, fareData) {
    const expiresAt = Date.now() + FARE_TTL;
    fareStorage.set(fareKey, {
        ...fareData,
        expiresAt: expiresAt,
        createdAt: Date.now()
    });
    console.log(`Fare kaydedildi. Geçerlilik süresi: ${new Date(expiresAt).toLocaleString('tr-TR')}`);
}

function getFare(fareKey) {
    const fareData = fareStorage.get(fareKey);
    if (!fareData) {
        console.log('Fare bulunamadı');
        return null;
    }
    
    if (Date.now() > fareData.expiresAt) {
        console.log('Fare süresi dolmuş');
        fareStorage.delete(fareKey);
        return null;
    }
    
    console.log(`Fare geçerli. Kalan süre: ${Math.round((fareData.expiresAt - Date.now()) / 1000)} saniye`);
    return fareData;
}

function cleanupExpiredFares() {
    const now = Date.now();
    for (const [fareKey, data] of fareStorage.entries()) {
        if (now > data.expiresAt) {
            fareStorage.delete(fareKey);
            console.log('Süresi dolmuş fare silindi');
        }
    }
}

// Her 5 dakikada bir süresi dolmuş fare'ları temizle
setInterval(cleanupExpiredFares, 5 * 60 * 1000); 