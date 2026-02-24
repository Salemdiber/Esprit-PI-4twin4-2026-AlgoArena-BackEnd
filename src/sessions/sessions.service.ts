import { Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SessionsService {
    detectActiveSession(req: Request) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const userAgent = (req.headers['user-agent'] || 'Unknown').toString();

        // Parse user agent minimally for browser/os details
        let browser = 'Unknown Browser';
        if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';

        let os = 'Unknown OS';
        if (userAgent.includes('Windows')) os = 'Windows';
        else if (userAgent.includes('Mac OS')) os = 'macOS';
        else if (userAgent.includes('Linux')) os = 'Linux';
        else if (userAgent.includes('Android')) os = 'Android';
        else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

        const isMobile = os === 'Android' || os === 'iOS';

        // Simple heuristical detection of "refreshed" based on Cache-Control or sec-fetch-dest
        const isRefreshed = req.headers['cache-control'] === 'max-age=0' ||
            req.headers['sec-fetch-dest'] === 'document';

        // We emulate "active time" since it would otherwise require state/db
        const activeTimeSeconds = Math.floor(Math.random() * 3600) + 120; // random up to 1 hr + 2 mins

        // Hardcode mock location based on IP (In reality, we'd use GeoIP)
        const mockLocations = ['Paris, France', 'New York, USA', 'Tokyo, Japan', 'Berlin, Germany', 'London, UK'];
        const location = mockLocations[ip ? ip.toString().length % mockLocations.length : 0] || 'Unknown Region';

        return {
            ip,
            browser,
            os,
            device: isMobile ? 'Mobile' : 'Desktop',
            userAgent,
            location,
            riskLevel: isRefreshed ? 'Low' : 'Minimal',
            activeTime: `${Math.floor(activeTimeSeconds / 60)}m ${activeTimeSeconds % 60}s`,
            refreshed: isRefreshed,
            timestamp: new Date().toISOString()
        };
    }
}
