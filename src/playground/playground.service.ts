import { Injectable } from '@nestjs/common';
import { ChallengesService } from '../challenges/challenges.service';

@Injectable()
export class PlaygroundService {
  constructor(private readonly challengesService: ChallengesService) {}

  async getChallenges() {
    return this.challengesService.findPublished();
  }

  async getChallengeById(id: string) {
    return this.challengesService.findPublishedById(id);
  }

  async getRandomChallenge() {
    return this.challengesService.findRandom();
  }
}
