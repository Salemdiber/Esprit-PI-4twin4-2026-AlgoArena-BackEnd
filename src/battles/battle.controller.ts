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
} from '@nestjs/common';
import { BattlesService } from './battle.service';
import { CreateBattleDto } from './dto/create-battle.dto';
import { UpdateBattleDto } from './dto/update-battle.dto';

@Controller('battles')
export class BattlesController {
  constructor(private readonly service: BattlesService) {}

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
}
