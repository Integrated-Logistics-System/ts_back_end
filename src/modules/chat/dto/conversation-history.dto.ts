import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class ConversationMetadataDto {
  @ApiProperty({ description: 'Intent of the conversation', required: false })
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiProperty({ description: 'Processing time in milliseconds', required: false })
  @IsOptional()
  @IsNumber()
  processingTime?: number;
}

export class ConversationItemDto {
  @ApiProperty({ description: 'User message' })
  @IsString()
  message!: string; // ! 추가

  @ApiProperty({ description: 'AI response' })
  @IsString()
  response!: string; // ! 추가

  @ApiProperty({ description: 'Timestamp of the conversation (ISO string)' })
  @IsString()
  timestamp!: string; // ! 추가

  @ApiProperty({ description: 'Metadata of the conversation', required: false })
  @IsOptional()
  metadata?: ConversationMetadataDto;
}

export class ConversationHistoryResponseDto {
  @ApiProperty({ type: [ConversationItemDto], description: 'List of conversation items' })
  conversations!: ConversationItemDto[]; // ! 추가
}