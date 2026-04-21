import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BattlesService } from './battle.service';
import { BattleAiService } from './battle-ai.service';
import { BattleGateway } from './battle.gateway';
import { CreateBattleDto } from './dto/create-battle.dto';
import { UpdateBattleDto } from './dto/update-battle.dto';
import { SubmitRoundResultDto } from './dto/submit-round-result.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('battles')
export class BattlesController {
  constructor(
    private readonly service: BattlesService,
    private readonly battleAiService: BattleAiService,
    private readonly battleGateway: BattleGateway,
  ) {}

  // POST /battles - Create a new battle
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBattleDto) {
    return this.service.create(dto);
  }

  // GET /battles - Retrieve all battles
  @Get()
  async findAll() {
    const battles = await this.service.findAll();
    return { battles };
  }

  // GET /battles/me - Retrieve battles for current user
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMine(@CurrentUser() user: { userId: string }) {
    const battles = await this.service.findByUserId(user.userId);
    return { battles };
  }

  // GET /battles/lobby - Retrieve joinable 1vs1 battles
  @UseGuards(JwtAuthGuard)
  @Get('lobby')
  async findLobby(@CurrentUser() user: { userId: string }) {
    const battles = await this.service.findJoinableBattles(user.userId);
    return { battles };
  }

  // POST /battles/:id/join - Join a pending 1vs1 battle
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinBattle(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    const battle = await this.service.joinBattle(id, user.userId);
    this.battleGateway.emitBattleJoined({
      battleId: String((battle as any)?._id || (battle as any)?.idBattle || id),
      userId: String((battle as any)?.userId || ''),
      opponentId: (battle as any)?.opponentId || null,
      battleStatus: String((battle as any)?.battleStatus || 'ACTIVE'),
    });
    return battle;
  }

  // GET /battles/:id/round-results - Retrieve persisted 1vs1 round results
  @UseGuards(JwtAuthGuard)
  @Get(':id/round-results')
  async getRoundResults(@Param('id') id: string) {
    const results = await this.service.getRoundResults(id);
    return { results };
  }

  // POST /battles/:id/round-result - Persist and broadcast 1vs1 round result
  @UseGuards(JwtAuthGuard)
  @Post(':id/round-result')
  async submitRoundResult(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() body: SubmitRoundResultDto,
  ) {
    const packet = await this.service.submitRoundResult(id, user.userId, {
      roundIndex: body.roundIndex,
      result: body.result,
    });
    this.battleGateway.emitBattleRoundResult(packet);
    return packet;
  }

  // GET /battles/:id - Retrieve a specific battle by id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // PATCH /battles/:id - Update a battle by id
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBattleDto) {
    return this.service.update(id, dto);
  }

  // DELETE /battles/:id - Remove a battle by id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }

  // POST /battles/:id/ai-submit - Generate and submit AI solution
  @Post(':id/ai-submit')
  async submitAiSolution(
    @Param('id') id: string,
    @Body() body: { language?: 'javascript' | 'python' },
  ) {
    return this.battleAiService.submitAiSolution(
      id,
      body?.language || 'javascript',
    );
  }
}
