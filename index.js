const express = require('express');
const qrcode = require('qrcode');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Credenciales de la API de Spotify de Santi
const CLIENT_ID = '2728d65ad1ed49358d08d71ea8f42dd2';
const CLIENT_SECRET = '91b2d62955b143aa84952cf6ec31d9b6';
const REDIRECT_URI = 'https://spotify-display-server.onrender.com/callback';

// Almacenamiento temporal en memoria para los tokens de Spotify de cada ESP32
const tokensDispositivos = {};
// Mapeo temporal para saber qué device_id está intentando loguearse en cada sesión OAuth
const authStates = {};

// Ruta principal: Muestra el código QR para vincular el dispositivo
app.get('/', async (req, res) => {
    const deviceId = req.query.device_id || 'default_device';
    const linkAuthSpotify = `https://spotify-display-server.onrender.com/login?device_id=${deviceId}`;

    try {
        const qrImage = await qrcode.toDataURL(linkAuthSpotify);
        res.send(`
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Vincular Spotify - ESP32</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; background-color: #121212; color: white; margin-top: 50px; }
                    .container { background: #181818; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                    img { margin: 20px 0; border-radius: 8px; }
                    a { color: #1DB954; text-decoration: none; font-weight: bold; font-size: 18px; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Vinculá tu Spotify</h1>
                    <p>Escaneá el código QR con tu celular para conectar tu cuenta al display:</p>
                    <img src="${qrImage}" alt="Código QR de Vinculación">
                    <p><a href="${linkAuthSpotify}" target="_blank">O hacé clic acá para vincularte directamente</a></p>
                    <p style="font-size: 12px; color: #b3b3b3; margin-top: 20px;">Dispositivo ID: ${deviceId}</p>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error al generar el código QR");
    }
});

// Ruta de inicio de sesión: Redirige al usuario a la página oficial de autorización de Spotify
app.get('/login', (req, res) => {
    const deviceId = req.query.device_id || 'default_device';
    const state = Math.random().toString(36).substring(7);
    
    authStates[state] = deviceId;

    const scope = 'user-read-playback-state user-read-currently-playing';
    const spotifyAuthUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;

    res.redirect(spotifyAuthUrl);
});

// Ruta Callback: Spotify redirige acá después de que el usuario acepta los permisos
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const deviceId = authStates[state] || 'default_device';

    if (!code) {
        return res.status(400).send("Error: Falta el código de autorización de Spotify.");
    }

    try {
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token } = tokenResponse.data;

        tokensDispositivos[deviceId] = {
            access_token,
            refresh_token
        };

        res.send(`
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>¡Vinculado con éxito!</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; background-color: #121212; color: white; margin-top: 50px; }
                    .container { background: #181818; padding: 40px; border-radius: 12px; display: inline-block; }
                    h1 { color: #1DB954; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>¡Cuenta vinculada con éxito!</h1>
                    <p>Ya podés cerrar esta ventana. Tu ESP32 (ID: ${deviceId}) comenzará a mostrar tu música.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Error al obtener el token de Spotify:", error.response?.data || error.message);
        res.status(500).send("Hubo un error al autenticarse con Spotify.");
    }
});

// Ruta que consulta el ESP32 cada 3 segundos para obtener la canción actual
app.get('/api/current-song', async (req, res) => {
    const deviceId = req.query.device_id;
    const sesion = tokensDispositivos[deviceId];

    if (!sesion) {
        return res.status(404).json({ error: "Dispositivo no vinculado" });
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${sesion.access_token}`
            }
        });

        if (!response.data || !response.data.item) {
            return res.json({ is_playing: false });
        }

        res.json({
            is_playing: response.data.is_playing,
            item: {
                name: response.data.item.name,
                artists: response.data.item.artists
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Error al consultar la canción actual" });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});