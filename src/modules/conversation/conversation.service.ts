import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { RagService } from '../rag/rag.service';
import { UserService } from '../user/user.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private readonly ragService: RagService,
    private readonly userService: UserService,
  ) {}

  async chat(userId: string, message: string): Promise<{
    response: string;
    recipes: any[];
    extractedIngredients: string[];
    sessionId: string;
  }> {
    // 세션 ID 생성 (오늘 날짜 기반)
    const today = new Date().toISOString().split('T')[0];
    const sessionId = `${userId}-${today}`;

    // 사용자 메시지 저장
    await this.addMessage(userId, sessionId, 'user', message);

    // RAG 처리
    const ragResponse = await this.ragService.processQuery(userId, message);

    // AI 응답 저장
    await this.addMessage(userId, sessionId, 'assistant', ragResponse.answer, {
      extractedIngredients: ragResponse.extractedIngredients,
      recommendedRecipes: ragResponse.recipes.map(r => r.id?.toString() || r._id),
      allergyWarnings: ragResponse.safetyInfo.unsafeIngredients.map(
        ui => `${ui.name}: ${ui.allergens.join(', ')}`
      )
    });

    return {
      response: ragResponse.answer,
      recipes: ragResponse.recipes,
      extractedIngredients: ragResponse.extractedIngredients,
      sessionId
    };
  }

  private async addMessage(
    userId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      extractedIngredients?: string[];
      recommendedRecipes?: string[];
      allergyWarnings?: string[];
    }
  ): Promise<void> {
    await this.conversationModel.updateOne(
      { userId, sessionId },
      {
        $push: {
          messages: {
            role,
            content,
            timestamp: new Date(),
            ...metadata
          }
        }
      },
      { upsert: true }
    );
  }

  async getConversationHistory(userId: string, sessionId?: string): Promise<Conversation[]> {
    const filter: any = { userId };
    if (sessionId) {
      filter.sessionId = sessionId;
    }

    return this.conversationModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(10)
      .exec();
  }
}