import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DockerExecutionService } from './services/docker-execution.service';

@Controller('admin/sandbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class SandboxAdminController {
  constructor(
    private readonly dockerExecutionService: DockerExecutionService,
  ) {}

  @Get('status')
  async getStatus() {
    return this.dockerExecutionService.getSandboxStatus();
  }
}
