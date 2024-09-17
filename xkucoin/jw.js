const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const FormData = require('form-data');
const { HttpsProxyAgent } = require('https-proxy-agent');
const TelegramBot = require('node-telegram-bot-api');

// Ganti dengan token bot Telegram Anda
const TELEGRAM_TOKEN = '12121:ggjfgg';
// Ganti dengan ID chat Telegram Anda
const CHAT_ID = '087666';

// Buat instansi bot Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

class KucoinAPIClient {
    constructor() {
        this.headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Origin": "https://www.kucoin.com",
            "Referer": "https://www.kucoin.com/miniapp/tap-game?inviterUserId=376905749&rcode=QBSLTEH5",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?1",
            "Sec-Ch-Ua-Platform": '"Android"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36"
        };
        this.proxies = this.loadProxies();
    }

    loadProxies() {
        const proxyFile = path.join(__dirname, './../data/proxy.txt');
        return fs.readFileSync(proxyFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
    }

    removeEscapeSequences(str) {
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }

    removeTimestamp(str) {
        return str.replace(/^\[\d{2}:\d{2}:\d{2} (AM|PM)\] \[\*\] /, '');
    }

    async sendTelegramLog(msg, type = 'info') {
        let formattedMsg;

        switch(type) {
            case 'success':
                formattedMsg = `[${msg}`.green;
                break;
            case 'custom':
                formattedMsg = `[${msg}`.magenta;
                break;        
            case 'error':
                formattedMsg = `[${msg}`.red;
                break;
            case 'warning':
                formattedMsg = `[${msg}`.yellow;
                break;
            default:
                formattedMsg = `[${msg}`.blue;
        }

        // Hilangkan kode warna lan timestamp
        const cleanedMsg = this.removeEscapeSequences(formattedMsg);
        const messageWithoutTimestamp = this.removeTimestamp(cleanedMsg);

        // Kirim log ke Telegram
        await bot.sendMessage(CHAT_ID, messageWithoutTimestamp);
    }

    log(msg, type = 'info') {
        switch(type) {
            case 'success':
                console.log(msg.green);
                break;
            case 'custom':
                console.log(msg.magenta);
                break;        
            case 'error':
                console.log(msg.red);
                break;
            case 'warning':
                console.log(msg.yellow);
                break;
            default:
                console.log(msg.blue);
        }

        // Kirim log ke Telegram
        this.sendTelegramLog(msg, type).catch(err => console.error('Error sending log to Telegram:', err));
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`Ngenteni ${i} detik kanggo nerusake...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    generateRandomPoints(totalPoints, numRequests) {
        let points = new Array(numRequests).fill(0);
        let remainingPoints = totalPoints;

        for (let i = 0; i < numRequests - 1; i++) {
            const maxPoint = Math.min(60, remainingPoints - (numRequests - i - 1));
            const point = Math.floor(Math.random() * (maxPoint + 1));
            points[i] = point;
            remainingPoints -= point;
        }

        points[numRequests - 1] = remainingPoints;

        for (let i = points.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [points[i], points[j]] = [points[j], points[i]];
        }

        return points;
    }

    async increaseGold(cookie, increment, molecule, proxyAgent) {
        const url = "https://www.kucoin.com/_api/xkucoin/platform-telebot/game/gold/increase?lang=en_US";
        
        const formData = new FormData();
        formData.append('increment', increment);
        formData.append('molecule', molecule);
        const headers = {
            ...this.headers,
            "Cookie": cookie,
            ...formData.getHeaders()
        };

        try {
            const response = await axios.post(url, formData, { 
                headers,
                httpsAgent: proxyAgent
            });
            if (response.status === 200) {
                return { success: true, data: response.data };
            } else {
                return { success: false, error: `HTTP Error: ${response.status}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Ora bisa mriksa IP proxy. Kode status: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Kesalahan nalika mriksa IP proxy: ${error.message}`);
        }
    }

    formatProxy(proxy) {
        // saka ip:port:user:pass menyang http://user:pass@ip:port
        if (proxy.startsWith('http')) {
            return proxy;
        }
        const parts = proxy.split(':');
        if (parts.length === 4) {
            return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`
        } else {
            return `http://${parts[0]}:${parts[1]}`;
        }
    }

    async main() {
        const dataFile = path.join(__dirname, './../data/xkucoin.txt');
        const cookies = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i];
                const proxyIndex = i % this.proxies.length;
                const proxy = this.formatProxy(this.proxies[proxyIndex]);
                const proxyAgent = new HttpsProxyAgent(proxy);
                
                let proxyIP = "Ora Dikenal";
                try {
                    proxyIP = await this.checkProxyIP(proxy);
                } catch (error) {
                    this.log(`Ora bisa mriksa IP proxy: ${error.message}`, 'warning');
                    continue;
                }

                console.log(`========== Akun ${i+1}/${cookies.length} | ip: ${proxyIP} ==========`);

                const points = this.generateRandomPoints(3000, 55);
                let totalPoints = 0;
                let currentMolecule = 3000;

                for (let j = 0; j < points.length; j++) {
                    const increment = points[j];
                    currentMolecule -= increment; 

                    this.log(`Tindakan ${j + 1}: Maringi ${increment} ulat kanggo kodhok...`, 'info');
                    
                    const result = await this.increaseGold(cookie, increment, currentMolecule, proxyAgent);
                    if (result.success) {
                        this.log(`Maringi sukses, wis maringi ${result.data.data} ulat`, 'success');
                        totalPoints += increment;
                        this.log(`Jumlah ulat sing isih ana: ${currentMolecule}`, 'custom');
                    } else {
                        this.log(`Ora bisa maringi ulat: ${result.error}`, 'error');
                    }

                    await this.countdown(3);
                }

                this.log(`Jumlah emas sing wis nambah: ${totalPoints}`, 'custom');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            await this.countdown(300);
        }
    }
}

const client = new KucoinAPIClient();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});
