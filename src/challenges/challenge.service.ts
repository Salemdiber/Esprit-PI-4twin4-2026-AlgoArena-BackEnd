import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Challenge } from './schemas/challenge.schema';

@Injectable()
export class ChallengeService {
  constructor(
    @InjectModel(Challenge.name) private challengeModel: Model<Challenge>,
  ) {}

  async findAll() {
    // Retourne uniquement id et title pour la liste
    return this.challengeModel.find({}, { _id: 1, title: 1 }).lean();
  }

  async findOne(id: string) {
    const challenge = await this.challengeModel.findById(id).lean();
    if (!challenge) throw new NotFoundException('Challenge not found');
    return challenge;
  }

    async runCode({ code, language, input, challengeId }: { code: string; language: string; input: string; challengeId: string }) {
    // Simulation d'exécution (mock)
    // En vrai, il faudrait appeler un service d'exécution sécurisé
    if (!code || !language) return { output: 'No code or language provided', success: false };
    // Pour la démo, on retourne un mock
    return { output: 'Mock output', success: true };
    }
}
