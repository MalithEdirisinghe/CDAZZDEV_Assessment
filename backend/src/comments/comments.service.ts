import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(taskId: string, authorId: string, dto: CreateCommentDto) {
    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        authorId,
        body: dto.body,
      },
      include: {
        author: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return comment;
  }
}
