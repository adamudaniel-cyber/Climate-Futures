const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

const clients = [];

// Watch directory for changes to trigger live reload
let reloadTimeout;
fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
    // Ignore hidden files and git directory
    if (filename && !filename.startsWith('.') && !filename.includes('.git') && !filename.includes('node_modules')) {
        clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(() => {
            console.log(`File changed: ${filename}. Reloading clients...`);
            clients.forEach(client => {
                try {
                    client.write('data: reload\n\n');
                } catch (e) {
                    // Client disconnected or failed
                }
            });
        }, 100);
    }
});

const server = http.createServer((req, res) => {
    // Prevent directory traversal
    let safeUrl = req.url.split('?')[0];

    // Live reload EventStream endpoint
    if (safeUrl === '/live-reload') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        clients.push(res);
        req.on('close', () => {
            const index = clients.indexOf(res);
            if (index !== -1) clients.splice(index, 1);
        });
        return;
    }

    if (safeUrl === '/') safeUrl = '/index.html';
    
    const filePath = path.join(__dirname, safeUrl);
    
    // Check if path is within workspace
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
