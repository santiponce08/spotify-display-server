const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const PORT = process.env.PORT || 3000;

// Credenciales de tu app de Spotify Developer
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '2728d65ad1ed49358d08d71ea8f42dd2';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '91b2d62955b143aa84952cf6ec31d9b6';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback'; // Para pruebas locales, luego se cambia por el de la nube

// Base de datos en memoria para guardar los vínculos: { "device_id": "refresh_token" }
const databaseVinculos = {};

// 1. Ruta para que el cliente inicie la vinculación desde el navegador
app.get('/link', (req, res) => {
    const deviceId = req.query.device_id;
    if (!deviceId) return res.status(400).send("Falta el device_id del dispositivo.");

    const scope = 'user-read-playback-state user-read-currently-playing';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            state: deviceId
        }));
});

// 2. Callback donde Spotify devuelve el código y se guarda el Refresh Token
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const deviceId = req.query.state || null;

    if (!code || !deviceId) {
        return res.status(400).send("Error en la autenticación con Spotify.");
    }

    try {
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            code: code,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
            }
        });

        const refreshToken = tokenResponse.data.refresh_token;
        databaseVinculos[deviceId] = refreshToken;

        res.send("<h1>¡Dispositivo vinculado con éxito!</h1><p>Ya podés cerrar esta ventana y tu ESP32 comenzará a mostrar tu música.</p>");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error interno al vincular la cuenta.");
    }
});

// 3. API que consulta el ESP32
app.get('/api/current-song', async (req, res) => {
    const deviceId = req.query.device_id;
    const refreshToken = databaseVinculos[deviceId];

    if (!refreshToken) {
        return res.status(404).json({ error: "Dispositivo no vinculado" });
    }

    try {
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
            }
        });

        const accessToken = tokenResponse.data.access_token;

        const playerResponse = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });

        if (playerResponse.status === 204 || !playerResponse.data) {
            return res.json({ is_playing: false });
        }

        res.json(playerResponse.data);
    } catch (error) {
        res.json({ is_playing: false });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});