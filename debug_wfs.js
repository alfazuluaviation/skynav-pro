
const https = require('https');

const url = 'https://geoaisweb.decea.mil.br/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=ICA:airport&maxFeatures=1&outputFormat=application/json';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.features && json.features.length > 0) {
                console.log('Properties:', Object.keys(json.features[0].properties));
                console.log('Sample:', json.features[0].properties);
            } else {
                console.log('No features found');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            console.log('Raw data:', data.slice(0, 200));
        }
    });
}).on('error', (e) => {
    console.error('Error:', e);
});
