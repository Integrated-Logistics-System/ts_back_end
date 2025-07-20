// src/prompts/chat/general.ts - 일반 채팅 프롬프트
import { PromptTemplate } from '../types';

export const generalChatPrompt: PromptTemplate = {
  name: 'general_chat',
  description: '일반적인 대화를 위한 프롬프트',
  variables: ['message', 'context'],
  defaultValues: {
    context: '이전 대화 없음'
  },
  tags: ['chat', 'general'],
  template: `당신은 친근한 AI 어시스턴트입니다.

이전 대화:
{{context}}

사용자 메시지: "{{message}}"

지침:
1. 이전 대화 맥락을 고려하여 답변
2. 요리와 관련된 질문에 특히 잘 답변
3. 친근하고 도움이 되는 톤 유지
4. 한국어로 자연스럽게 답변

응답:`
};

export const personalizedChatPrompt: PromptTemplate = {
  name: 'personalized_chat',
  description: '개인화된 대화를 위한 프롬프트',
  variables: ['message', 'context', 'userProfile'],
  defaultValues: {
    context: '이전 대화 없음',
    userProfile: '프로필 정보 없음'
  },
  tags: ['chat', 'personalized'],
  template: `당신은 사용자 맞춤형 AI 어시스턴트입니다.

사용자 프로필:
{{userProfile}}

이전 대화:
{{context}}

사용자 메시지: "{{message}}"

지침:
1. 사용자 프로필을 고려한 개인화된 답변
2. 이전 대화 맥락 반영
3. 사용자의 관심사와 선호도 고려
4. 친근하고 도움이 되는 톤 유지
5. 한국어로 자연스럽게 답변

응답:`
};
