const apiKey = '5b3ce3597851110001cf62480447199f1d1f457c92d3c0d57cecc5b1';  // Dein OpenRouteService API-Schlüssel

// Stadtbezogene Daten mit Koordinaten
const cityData = {
    'Würzburg': {
        grundpreis: 5.2,
        kilometer_preise: [2.5, 2.5, 2.5, 1.8, 1.8, 1.8],
        meter_pro_20ct: [80, 80, 80, 111.11, 111.11, 111.11],
        folgende_km_preis: 1.8,
        meter_pro_20ct_folgende_km: 111.11,
        wartezeit_preis_pro_stunde: 36,
        coordinates: [49.7913, 9.9534]
    },
    'Erlangen': {
        grundpreis: 4.7,
        kilometer_preise: [4.7, 2.5, 2.5, 2.5, 2.5, 2.0],
        meter_pro_20ct: [42.55, 80, 80, 100, 100, 100],
        folgende_km_preis: 2.0,
        meter_pro_20ct_folgende_km: 100,
        wartezeit_preis_pro_stunde: 33,
        coordinates: [49.5986, 11.0048]
    },
    'Regensburg': {
        grundpreis: 4.6,
        kilometer_preise: [2.3, 2.3, 2.3, 2.3, 2.0, 2.0],
        meter_pro_20ct: [86.9, 86.9, 86.9, 86.9, 100, 100],
        folgende_km_preis: 2.0,
        meter_pro_20ct_folgende_km: 100,
        wartezeit_preis_pro_stunde: 30,
        coordinates: [49.0134, 12.1016]
    },
    'Augsburg': {
        grundpreis: 3.7,
        kilometer_preise: [3.0, 2.0, 2.0, 2.0, 2.0, 2.0],
        meter_pro_20ct: [66.67, 100, 100, 100, 100, 100],
        folgende_km_preis: 2.0,
        meter_pro_20ct_folgende_km: 100,
        wartezeit_preis_pro_stunde: 30,
        coordinates: [48.3705, 10.8978]
    }
};

// Karte zentriert auf Bayern
var map = L.map('map').setView([48.7904, 11.4979], 7);

// OpenStreetMap-Kachel-Layer hinzufügen
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Liste der erstellten Isochronen, um sie später zu löschen
let isochroneLayers = [];

// Funktion zur Berechnung der Isochrone
async function calculateIsochrone(city, maxDistanceMeters) {
    const coordinates = cityData[city].coordinates;
    const url = `https://api.openrouteservice.org/v2/isochrones/driving-car`;

    const requestData = {
        locations: [[coordinates[1], coordinates[0]]],
        range: [maxDistanceMeters],
        range_type: "distance",
        units: "m"
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        const data = await response.json();

        if (response.ok) {
            const isochrone = data.features[0].geometry;
            const layer = L.geoJSON(isochrone, { style: { color: 'blue', weight: 2, opacity: 0.6 } });
            layer.addTo(map);
            isochroneLayers.push(layer);
        } else {
            alert(`Fehler bei der API-Anfrage: ${data.error.message}`);
        }
    } catch (error) {
        alert('Ein Fehler ist aufgetreten. Bitte überprüfe die Konsole für mehr Details.');
    }
}

// Funktion, um alle Isochronen zu entfernen
function clearIsochrones() {
    isochroneLayers.forEach(layer => map.removeLayer(layer));
    isochroneLayers = [];
    document.getElementById("result").innerHTML = ''; // Leere das Ergebnisfeld
}

// Berechnungsfunktion für alle Städte gleichzeitig
function calculateDistance() {
    const budget = parseFloat(document.getElementById("budget").value);
    const wartezeit = parseFloat(document.getElementById("wartezeit").value);
    const hin_und_rueckfahrt = true;  // Festlegen, dass es sich um Hin- und Rückfahrt handelt

    if (isNaN(budget) || budget <= 0) {
        alert("Bitte ein gültiges Budget eingeben.");
        return;
    }

    if (isNaN(wartezeit) || wartezeit < 0) {
        alert("Bitte eine gültige Wartezeit eingeben.");
        return;
    }

    let resultText = ''; // Leeres Ergebnis-Textfeld

    // Berechne für jede Stadt
    Object.keys(cityData).forEach(async (city) => {
        const cityInfo = cityData[city];
        const wartezeitKosten = (wartezeit / 60) * cityInfo.wartezeit_preis_pro_stunde;

        const maxDistance = calculateMaxDistance(
            budget,
            cityInfo.grundpreis,
            cityInfo.kilometer_preise,
            cityInfo.meter_pro_20ct,
            cityInfo.folgende_km_preis,
            cityInfo.meter_pro_20ct_folgende_km,
            wartezeitKosten,
            hin_und_rueckfahrt
        );

        // Zeige die Kilometerdistanz im Ergebnis an
        resultText += `${city}: ${maxDistance.toFixed(2)} km Einzugsradius<br>`;
        
        // Berechne und zeichne die Isochrone
        await calculateIsochrone(city, maxDistance * 1000);  // Umwandlung von km zu Metern
    });

    document.getElementById("result").innerHTML = resultText; // Zeige die Ergebnisse an
}

// Funktion zur Berechnung der maximalen Distanz mit Hin- und Rückfahrt und Wartezeit
function calculateMaxDistance(budget, grundpreis, kilometer_preise, meter_pro_20ct, folgende_km_preis, meter_pro_20ct_folgende_km, wartezeitKosten, hin_und_rueckfahrt) {
    let remainingBudget = budget - (hin_und_rueckfahrt ? 2 * grundpreis : grundpreis) - wartezeitKosten;
    let totalDistance = 0;

    // Abbruch, falls Budget zu gering
    if (remainingBudget < 0) {
        return 0;
    }

    // Kilometerbereiche durchlaufen
    for (let i = 0; i < kilometer_preise.length; i++) {
        const costPerKm = hin_und_rueckfahrt ? 2 * kilometer_preise[i] : kilometer_preise[i];
        if (remainingBudget >= costPerKm) {
            totalDistance += 1;  // 1 Kilometer hinzufügen
            remainingBudget -= costPerKm;
        } else {
            const metersForRemainingBudget = (remainingBudget / costPerKm) * 1000;
            totalDistance += metersForRemainingBudget / 1000;  // Meter zu Kilometer umrechnen
            remainingBudget = 0;
            break;
        }
    }

    // Zusätzliche Kilometer behandeln
    while (remainingBudget > 0) {
        const costPerFollowingKm = hin_und_rueckfahrt ? 2 * folgende_km_preis : folgende_km_preis;
        if (remainingBudget >= costPerFollowingKm) {
            totalDistance += 1;
            remainingBudget -= costPerFollowingKm;
        } else {
            const metersForRemainingBudget = (remainingBudget / costPerFollowingKm) * 1000;
            totalDistance += metersForRemainingBudget / 1000;
            remainingBudget = 0;
        }
    }

    return totalDistance;
}
