const express = require('express');
const qrcode = require('qrcode');
const app = express();
const PORT = process.env.PORT || 3000;

// Almacenamiento temporal en memoria para los tokens de Spotify de cada ESP32 (por device_id)
const tokensDispositivos = {};

// Ruta principal: Muestra un código QR amigable para que el usuario vincule su dispositivo
app.get('/', async (req, res) => {
    // Tomamos el device_id por parámetro o usamos uno por defecto de prueba
    const deviceId = req.query.device_id || 'default_device';
    
    // URL a la que redirigirá el QR para iniciar sesión en Spotify
    const linkAuthSpotify = `https://spotify-display-server.onrender.com/login?device_id=${deviceId}`;

    try {
        // Generar un código QR en formato HTML visual
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

// Ruta de inicio de sesión (la que faltaba para evitar el error Cannot GET /login)
app.get('/login', (req, res) => {
    const deviceId = req.query.device_id || 'default_device';
    
    res.send(`
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Conectar Spotify</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; background-color: #121212; color: white; margin-top: 50px; }
                .container { background: #181818; padding: 30px; border-radius: 12px; display: inline-block; }
                h1 { color: #1DB954; }
                p { color: #b3b3b3; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Conectando con Spotify...</h1>
                <p>Dispositivo vinculado ID: <strong>${deviceId}</strong></p>
                <p>Aquí se integrará el flujo de autenticación de la API de Spotify.</p>
            </div>
        </body>
        </html>
    `);
});

// Ruta que consulta el ESP32 cada 3 segundos
app.get('/api/current-song', (req, res) => {
    const deviceId = req.query.device_id;
    
    // Verificamos si el dispositivo tiene una sesión activa guardada
    const sesion = tokensDispositivos[deviceId];

    if (!sesion) {
        // Si no está vinculado, devolvemos 404 para que el ESP32 muestre "Vincular en web"
        return res.status(404).json({ error: "Dispositivo no vinculado" });
    }

    // Simulación de respuesta de la canción actual
    res.json({
        is_playing: true,
        item: {
            name: "Nombre de Canción",
            artists: [{ name: "Artista de Ejemplo" }]
        }
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});