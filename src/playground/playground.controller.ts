import { Controller, Get, Param } from '@nestjs/common';
import { PlaygroundService } from './playground.service';

@Controller('playground/challenges')
export class PlaygroundController {
  constructor(private readonly playgroundService: PlaygroundService) {}

  @Get()
  async getChallenges() {
    return this.playgroundService.getChallenges();
  }

  @Get('random')
  async getRandomChallenge() {
    return this.playgroundService.getRandomChallenge();
  }

  @Get(':id')
  async getChallengeById(@Param('id') id: string) {
    return this.playgroundService.getChallengeById(id);
  }
}
