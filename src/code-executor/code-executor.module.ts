import { Module } from '@nestjs/common';
import { CodeExecutorService } from './code-executor.service';
import { PlagiarismDetectionService } from './plagiarism-detection.service';
import { PlagiarismDetectionController } from './plagiarism-detection.controller';
import { CodeExecutorController } from './code-executor.controller';

@Module({
    controllers: [PlagiarismDetectionController, CodeExecutorController],
    providers: [CodeExecutorService, PlagiarismDetectionService],
    exports: [CodeExecutorService, PlagiarismDetectionService],
})
export class CodeExecutorModule {}
