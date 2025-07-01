/**
 * IATA API'den gelen JSON'u Sabre formatına dönüştürür
 * @param {Object} iataResponse - IATA API yanıtı
 * @param {Array} paxList - İstekte gelen yolcu listesi
 * @returns {Object} - Sabre formatında karşılık gelen JSON
 */
function mapIATAResponse(iataResponse, paxList = []) {
    const root = iataResponse["ns4:IATA_AirShoppingRS"]?.["ns4:Response"];
    // Marketing segments'i array olarak al
    let marketingSegments = root?.DataLists?.DatedMarketingSegmentList?.DatedMarketingSegment || [];
    if (!Array.isArray(marketingSegments)) {
        marketingSegments = [marketingSegments];
    }
    
    // Pax segments'i array olarak al
    let paxSegments = root?.DataLists?.PaxSegmentList?.PaxSegment || [];
    if (!Array.isArray(paxSegments)) {
        paxSegments = [paxSegments];
    }
    
    // Journeys'i array olarak al - tek journey varsa array'e çevir
    let journeys = root?.DataLists?.PaxJourneyList?.PaxJourney || [];
    if (!Array.isArray(journeys)) {
        journeys = [journeys];
    }
    
    // Offers'i array olarak al
    let offers = root?.OffersGroup?.CarrierOffers?.Offer || [];
    if (!Array.isArray(offers)) {
        offers = [offers];
    }

    // Pax türlerini analiz et
    const paxTypes = analyzePaxTypes(paxList);

    const marketingSegmentMap = {};
    marketingSegments.forEach(seg => {
        marketingSegmentMap[seg.DatedMarketingSegmentId] = seg;
    });

    const paxSegmentMap = {};
    paxSegments.forEach(ps => {
        paxSegmentMap[ps.PaxSegmentID] = marketingSegmentMap[ps.DatedMarketingSegmentRefId];
    });

    // Temel yanıt şeması
    const mappedResponse = {
        audit: {
            test: true,
            reference: generateUUID(),
            request_ip: "127.0.0.1",
            service: "search",
            timestamp: getCurrentTimestamp()
        },
        result: {
            departure_flights: [],
            return_flights: []
        }
    };

    journeys.forEach((journey, journeyIndex) => {
        const segmentRefs = Array.isArray(journey.PaxSegmentRefID) ? journey.PaxSegmentRefID : [journey.PaxSegmentRefID];
        const segments = segmentRefs.map(id => paxSegmentMap[id]);
        
        const legs = segments.map((seg, index) => {
            const flightNumber = `${seg.CarrierDesigCode}${seg.MarketingCarrierFlightNumberText}`;
            
            // Bir sonraki leg ile arasındaki bekleme süresini hesapla
            let waitTime = 0;
            if (index < segments.length - 1) {
                const currentArrival = new Date(seg.Arrival.AircraftScheduledDateTime);
                const nextDeparture = new Date(segments[index + 1].Dep.AircraftScheduledDateTime);
                waitTime = Math.round((nextDeparture - currentArrival) / 60000);
            }
            
            return {
                flight_number: flightNumber,
                departure_info: {
                    airport_code: seg.Dep.IATA_LocationCode,
                    date: formatDate(seg.Dep.AircraftScheduledDateTime),
                    airport_name: `${seg.Dep.IATA_LocationCode} Airport`,
                    city_name: seg.Dep.IATA_LocationCode
                },
                arrival_info: {
                    airport_code: seg.Arrival.IATA_LocationCode,
                    date: formatDate(seg.Arrival.AircraftScheduledDateTime),
                    airport_name: `${seg.Arrival.IATA_LocationCode} Airport`,
                    city_name: seg.Arrival.IATA_LocationCode
                },
                time_info: {
                    leg_duration_time_minute: calculateMinutes(seg.Dep.AircraftScheduledDateTime, seg.Arrival.AircraftScheduledDateTime),
                    wait_time_in_minute_before_next_leg: waitTime,
                    flight_time_hour: 0,
                    flight_time_minute: 0,
                    layover_time_in_minutes: 0,
                    day_cross: false,
                    ...(segments.length > 1 && { number_of_stops: "0" })
                },
                airline_info: {
                    carrier_code: seg.CarrierDesigCode,
                    carrier_name: seg.CarrierDesigCode,
                    operator_code: seg.CarrierDesigCode,
                    operator_name: seg.CarrierDesigCode,
                    operating_airline_code: seg.CarrierDesigCode
                },
                baggages: [
                    {
                        "amount": 15,
                        "type": "UNKNOWN",
                        "alternative_type": "KG",
                        "class_code": "S",
                        "passenger_type": "ADULT"
                    }
                ],
                cabin_baggages: [
                    {
                        "amount": 1,
                        "type": "PIECE",
                        "alternative_type": "P",
                        "class_code": "S",
                        "passenger_type": "ADULT"
                    }
                ]
            };
        });

        const offer = offers.find(o => o.OfferItem?.Service?.OfferServiceAssociation?.PaxJourneyRef?.PaxJourneyRefID.includes(journey.PaxJourneyID));
        const price = offer?.OfferItem?.Price?.TotalAmount;

        const fare = {
            fare_key: generateUUID(),
            fare_info: {
                class_codes: legs.map((leg, index) => `Y${index + 1}`),
                cabin_types: legs.map((leg, index) => "ECONOMY"),
                fare_detail: {
                    currency_code: price?.$.CurCode || "IQD",
                    price_info: {
                        total_fare: parseFloat((parseFloat(price?._) || 0).toFixed(2)),
                        base_fare: parseFloat((parseFloat(offer?.OfferItem?.Price?.BaseAmount?._) || 0).toFixed(2)),
                        service_fee: 0,
                        agency_commission: 0,
                        tax: parseFloat((parseFloat(offer?.OfferItem?.Price?.TaxSummary?.TotalTaxAmount?._) || 0).toFixed(2)),
                        supplement: 0
                    },
                    pax_fares: generatePaxFares(price, offer, legs, paxTypes)
                },
                free_seats: 9
            }
        };

        const flightObj = {
            provider_key: "IK Global",
            package_info: {
                packaged: false,
                package_key: "XXXXXXXX"
            },
            legs,
            fares: [fare],
            office: {
                office_id: 3188,
                office_name: "IK Global Office"
            },
            book_type: "DIRECT",
            charter: false
        };

        // Gidiş - dönüş ayrımı
        const origin = legs[0].departure_info.airport_code;
        const destination = legs[legs.length - 1].arrival_info.airport_code;
        
        // Aynı yöndeki tüm uçuşları aynı kategoriye koy
        // Örnek: EBL → DXB = gidiş, DXB → EBL = dönüş
        const isDeparture = origin < destination; // Alfabetik sıralama ile belirle
        
        if (isDeparture) {
            mappedResponse.result.departure_flights.push(flightObj);
        } else {
            mappedResponse.result.return_flights.push(flightObj);
        }
    });

    return mappedResponse;
}

function calculateMinutes(start, end) {
    const d1 = new Date(start);
    const d2 = new Date(end);
    return Math.round((d2 - d1) / 60000);
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getCurrentTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Pax türlerini analiz eder
 * @param {Array} paxList - Yolcu listesi
 * @returns {Object} - Pax türleri ve sayıları
 */
function analyzePaxTypes(paxList) {
    const paxTypes = {
        ADULT: 0,
        CHILD: 0,
        INFANT: 0
    };
    
    if (Array.isArray(paxList)) {
        paxList.forEach(pax => {
            const type = pax.type?.toUpperCase();
            const count = pax.count || 0;
            if (paxTypes.hasOwnProperty(type)) {
                paxTypes[type] = count;
            }
        });
    }
    
    // Eğer hiç pax yoksa, varsayılan olarak 1 adult
    if (paxTypes.ADULT === 0 && paxTypes.CHILD === 0 && paxTypes.INFANT === 0) {
        paxTypes.ADULT = 1;
    }
    
    return paxTypes;
}

/**
 * Pax fare'larını oluşturur
 * @param {Object} price - Fiyat bilgisi
 * @param {Object} offer - Offer bilgisi
 * @param {Array} legs - Uçuş bacakları
 * @param {Object} paxTypes - Pax türleri
 * @returns {Array} - Pax fare'ları
 */
function generatePaxFares(price, offer, legs, paxTypes) {
    const paxFares = [];
    const currency = price?.$.CurCode || "IQD";
    const basePrice = parseFloat(price?._) || 0;
    const baseAmount = parseFloat(offer?.OfferItem?.Price?.BaseAmount?._) || 0;
    const taxAmount = parseFloat(offer?.OfferItem?.Price?.TaxSummary?.TotalTaxAmount?._) || 0;
    
    // ADULT fare'ları
    if (paxTypes.ADULT > 0) {
        paxFares.push({
            "currency_code": currency,
            "price_info": {
                "total_fare": parseFloat(basePrice.toFixed(2)),
                "base_fare": parseFloat(baseAmount.toFixed(2)),
                "service_fee": 0,
                "agency_commission": 0,
                "tax": parseFloat(taxAmount.toFixed(2)),
                "supplement": 0
            },
            "pax_type": "ADULT",
            "number_of_pax": paxTypes.ADULT,
            "baggage_allowances": legs.map((leg, index) => ({
                "amount": 15,
                "type": "UNKNOWN",
                "alternative_type": "KG",
                "class_code": "S",
                "departure_airport": leg.departure_info.airport_code,
                "arrival_airport": leg.arrival_info.airport_code,
                "carrier": leg.airline_info.carrier_code,
                "flight_number": leg.flight_number
            })),
            "cabin_baggage_allowances": legs.map((leg, index) => ({
                "amount": 1,
                "type": "PIECE",
                "alternative_type": "P",
                "class_code": "S",
                "departure_airport": leg.departure_info.airport_code,
                "arrival_airport": leg.arrival_info.airport_code,
                "carrier": leg.airline_info.carrier_code,
                "flight_number": leg.flight_number
            }))
        });
    }
    
    // CHILD fare'ları
    if (paxTypes.CHILD > 0) {
        paxFares.push({
            "currency_code": currency,
            "price_info": {
                "total_fare": parseFloat((basePrice * 0.75).toFixed(2)),
                "base_fare": parseFloat((baseAmount * 0.75).toFixed(2)),
                "service_fee": 0,
                "agency_commission": 0,
                "tax": parseFloat((taxAmount * 0.75).toFixed(2)),
                "supplement": 0
            },
            "pax_type": "CHILD",
            "number_of_pax": paxTypes.CHILD,
            "baggage_allowances": legs.map((leg, index) => ({
                "amount": 15,
                "type": "UNKNOWN",
                "alternative_type": "KG",
                "class_code": "S",
                "departure_airport": leg.departure_info.airport_code,
                "arrival_airport": leg.arrival_info.airport_code,
                "carrier": leg.airline_info.carrier_code,
                "flight_number": leg.flight_number
            })),
            "cabin_baggage_allowances": legs.map((leg, index) => ({
                "amount": 1,
                "type": "PIECE",
                "alternative_type": "P",
                "class_code": "S",
                "departure_airport": leg.departure_info.airport_code,
                "arrival_airport": leg.arrival_info.airport_code,
                "carrier": leg.airline_info.carrier_code,
                "flight_number": leg.flight_number
            }))
        });
    }
    
    // INFANT fare'ları
    if (paxTypes.INFANT > 0) {
        paxFares.push({
            "currency_code": currency,
            "price_info": {
                "total_fare": parseFloat((basePrice * 0.1).toFixed(2)),
                "base_fare": parseFloat((baseAmount * 0.1).toFixed(2)),
                "service_fee": 0,
                "agency_commission": 0,
                "tax": parseFloat((taxAmount * 0.1).toFixed(2)),
                "supplement": 0
            },
            "pax_type": "INFANT",
            "number_of_pax": paxTypes.INFANT,
            "baggage_allowances": legs.map((leg, index) => ({
                "amount": 10,
                "type": "UNKNOWN",
                "alternative_type": "KG",
                "class_code": "S",
                "departure_airport": leg.departure_info.airport_code,
                "arrival_airport": leg.arrival_info.airport_code,
                "carrier": leg.airline_info.carrier_code,
                "flight_number": leg.flight_number
            })),
            "cabin_baggage_allowances": legs.map((leg, index) => ({
                "amount": 1,
                "type": "PIECE",
                "alternative_type": "P",
                "class_code": "S",
                "departure_airport": leg.departure_info.airport_code,
                "arrival_airport": leg.arrival_info.airport_code,
                "carrier": leg.airline_info.carrier_code,
                "flight_number": leg.flight_number
            }))
        });
    }
    
    return paxFares;
}

module.exports = {
    mapIATAResponse
};