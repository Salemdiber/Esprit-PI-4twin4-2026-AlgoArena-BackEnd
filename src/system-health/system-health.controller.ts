import { Controller, Get } from '@nestjs/common';
import { SystemHealthService } from './system-health.service';

@Controller('system-health')
export class SystemHealthController {
    constructor(private readonly systemHealthService: SystemHealthService) { }

    @Get()
    //@UseGuards(AuthGuard) // Ensure only authenticated users can access, but removed for ease unless strict validation is required
    async getHealth() {
        return await this.systemHealthService.getHealthMetrics();
    }
}
