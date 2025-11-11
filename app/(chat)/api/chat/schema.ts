import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  text: z.string().min(1).max(100000), // Augmenté de 2000 à 100000 pour supporter le texte collé
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum([
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    // Documents
    'application/pdf',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/x-javascript',
    'text/x-typescript',
    'application/json',
    'text/markdown',
    // Audio
    'audio/wav',
    'audio/mp3',
    'audio/aiff',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    // Video
    'video/mp4',
    'video/mpeg',
    'video/mov',
    'video/avi',
    'video/x-flv',
    'video/mpg',
    'video/webm',
    'video/wmv',
    'video/3gpp',
    'video/*' // Wildcard for YouTube videos and other video types
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  // Optional videoMetadata for YouTube videos
  videoMetadata: z.object({
    startOffset: z.string().optional(),
    endOffset: z.string().optional(),
    fps: z.number().optional(),
  }).optional(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    parts: z.array(partSchema),
    data: z.object({
      groundingType: z.enum(['none', 'search', 'maps', 'legal']).optional(),
      isReasoningEnabled: z.boolean().optional(),
    }).optional(),
  }),
  selectedChatModel: z.enum(['chat-model-small', 'chat-model-medium', 'chat-model-large']),
  selectedVisibilityType: z.enum(['public', 'private']),
  groundingType: z.enum(['none', 'search', 'maps', 'legal']).optional(),
  isReasoningEnabled: z.boolean().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
