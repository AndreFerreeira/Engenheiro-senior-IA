export enum Sender {
  User = 'user',
  Bot = 'bot'
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64
  name?: string;
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
  isThinking?: boolean;
}

export interface SectionParsed {
  title: string;
  content: string;
  type: 'normal' | 'warning' | 'success' | 'info';
}

export type FilterKey = 'analise' | 'normas' | 'riscos' | 'recomendacoes' | 'conclusao';
