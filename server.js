require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const sql = require('mssql');
const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./connectionWrapper');

const app = express();
const httpServer = createServer(app);

const config = {
    user: 'DB_A46FF7_panorama_admin',         // Kullanıcı adınız
    password: 'panorama48Dd',     // Şifreniz
    server: 'sql6002.site4now.net',         // Sunucu adresiniz
    database: 'DB_A46FF7_panorama'      // Veritabanı adınız
};

// JSON içerikler için middleware ekle
app.use(express.json());

// Enable cross origin resource sharing
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

async function upsertUserCount(username, countIncrement) {
    try {
        await sql.connect(config);
        await sql.query`EXEC UpsertUserCount ${username}, ${countIncrement}`;
    } catch (err) {
        console.error('SQL error', err);
    }
}

io.on('connection', (socket) => {
    let tiktokConnectionWrapper;

    socket.on('setUniqueId', (uniqueId, options = {}) => {
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Mobile Safari/537.36"
        ];
        
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        options.requestOptions = {
            headers: {
                "User-Agent": randomUserAgent,
                "Connection": "Upgrade",
                "Upgrade": "websocket",
                "Sec-WebSocket-Version": "13"
            }
        };
        
        options.websocketOptions = {
            headers: {
                "User-Agent": randomUserAgent,
                "Connection": "Upgrade",
                "Upgrade": "websocket",
                "Sec-WebSocket-Version": "13"
            }
        };
        
    
        console.log("TikTok Connection Options:", options); // Burada çap edirik
    
        // Əgər artıq bağlantı varsa, əvvəlkini dayandır
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }
    
        try {
            tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
            tiktokConnectionWrapper.connect();
        } catch (err) {
            socket.emit('disconnected', err.toString());
            return;
        }
    
        tiktokConnectionWrapper.once('connected', state => socket.emit('tiktokConnected', state));
        tiktokConnectionWrapper.once('disconnected', reason => socket.emit('tiktokDisconnected', reason));
    });
    

    socket.on('disconnect', () => {
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }
    });
});

// Emit global connection statistics
setInterval(() => {
    io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
}, 5000);

// API Endpoint for updating user count
app.post('/upsert-count', async (req, res) => {
    try {
        const { username, countIncrement } = req.body;
        await sql.connect(config);
        await sql.query`EXEC UpsertUserCount ${username}, ${countIncrement}`;
        res.status(200).send('Count updated');
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});

// Serve frontend files
app.use(express.static('public'));

// Start http listener
const port = process.env.PORT || 2045;
httpServer.listen(port);
console.info(`Server running! Please visit http://localhost:${port}`);
