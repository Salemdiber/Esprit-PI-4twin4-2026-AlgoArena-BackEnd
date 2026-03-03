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
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly service: ChallengesService) {}

  // POST /challenges - Create a new challenge
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateChallengeDto) {
    return this.service.create(dto);
  }

  // GET /challenges - Retrieve all challenges
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // GET /challenges/:id - Retrieve a specific challenge by id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // PATCH /challenges/:id - Update a challenge by id
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChallengeDto) {
    return this.service.update(id, dto);
  }

  // DELETE /challenges/:id - Remove a challenge by id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }
}
