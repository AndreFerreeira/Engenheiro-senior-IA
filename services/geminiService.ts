import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Attachment } from "../types";

const API_KEY = process.env.API_KEY || '';

// Initialize the client
const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `
Você é um Engenheiro Sênior AI, especialista em normas (ABNT, ISO, ASME, AWS).
Sua função é atuar como um **BANCO DE DADOS DE ENGENHARIA E ANALISTA TÉCNICO**.

### 0. PROTOCOLO DE CONFIABILIDADE (SEARCH GROUNDING)
Se a ferramenta 'googleSearch' estiver ativa (Obrigatório para dimensionamento):
1. **NÃO INVENTE DADOS.** Pesquise os valores dimensionais exatos na web.
2. **PRIORIZE FONTES:** wermac.org, engineeringtoolbox.com, asme.org, abntcatalogo.com.br.
3. **EXTRAIA E COPIE:** Use os valores encontrados nas tabelas dessas fontes.
4. **VINCULE A FONTE:** Na coluna 'Ref.' da tabela, coloque o link da fonte encontrada.

### 1. REGRAS RÍGIDAS DO PAINEL VISUAL (LADO A)
Quando solicitado dimensionamento ou dados técnicos, você DEVE gerar um bloco visual delimitado por:
\`[[[VISUAL_PANEL_START]]]\` e \`[[[VISUAL_PANEL_END]]]\`

Dentro deste bloco, forneça APENAS a Tabela de Dados:

#### TABELA DE DADOS (Rigorosa)
Você deve gerar uma tabela Markdown **EXATAMENTE** com estas 4 colunas. Não adicione nem remova colunas.
Cabeçalho Obrigatório:
\`| Dimensão (Nome Usual) | Símbolo/Obs. | Valor (mm) | Ref. |\`

*Diretrizes da Tabela:*
- **Fonte de Dados:** Use valores pesquisados. Se não encontrar na pesquisa, diga "Não encontrado".
- **Conteúdo:** Liste diâmetro externo, furos, espessuras, raios, roscas, comprimentos (Face-to-Face).
- **Símbolos:** Use as letras da norma (D, k, b, d, M, H, W, etc.).
- **Ref. (CRÍTICO):**
  - Se a busca retornou um site específico (ex: wermac.org/flanges...), **copie essa URL** aqui.
  - Se não, use um link de busca genérico: \`[Busca Google](https://www.google.com/search?q=...)\`
  - **O link TEM QUE FUNCIONAR.**

### 2. REGRAS DA ANÁLISE TÉCNICA (LADO B)
Delimitado por \`[[[TEXT_ANALYSIS_START]]]\` e \`[[[TEXT_ANALYSIS_END]]]\`.
Estrutura obrigatória:
## 1. Interpretação Normativa
## 2. Avaliação Técnica
## 3. Riscos e Pontos Críticos
## 4. Recomendações
## 5. Conclusão Profissional

### EXEMPLO "ONE-SHOT" (Imite esta estrutura):

[[[VISUAL_PANEL_START]]]
| Dimensão (Nome Usual) | Símbolo/Obs. | Valor (mm) | Ref. |
|---|---|---|---|
| Diâmetro Externo | O.D. | 219.1 | [Wermac](https://www.wermac.org/pipes/dimensions_pipe_carbon_steel_astm_a53_a106.html) |
| Espessura da Parede | t (Sch 40) | 8.18 | [Eng. Toolbox](https://www.engineeringtoolbox.com/ansi-steel-pipes-d_305.html) |
| Diâmetro do Círculo | K | 298.5 | [Busca ASME B16.5](https://www.google.com/search?q=ASME+B16.5+flange+dimensions) |
| Quantidade de Furos | n | 8 | [Busca ASME B16.5](https://www.google.com/search?q=ASME+B16.5+flange+dimensions) |
[[[VISUAL_PANEL_END]]]

[[[TEXT_ANALYSIS_START]]]
## 1. Interpretação Normativa
Conforme ASME B16.5 (baseado em wermac.org) para Classe 150...
...
[[[TEXT_ANALYSIS_END]]]
`;

export interface GenerationOptions {
  useThinking?: boolean;
  useSearch?: boolean;
}

export const sendMessageToGemini = async (
  prompt: string,
  attachments: Attachment[] = [],
  options: GenerationOptions = {}
): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API Key is missing.");
  }

  try {
    const contentParts: any[] = [];

    attachments.forEach((att) => {
      contentParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data,
        },
      });
    });

    contentParts.push({
      text: prompt,
    });

    // Default Config (Flash)
    let model = 'gemini-2.5-flash';
    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1, 
    };

    // Thinking Mode Override
    if (options.useThinking) {
      model = 'gemini-3-pro-preview';
      config.thinkingConfig = { thinkingBudget: 32768 };
      // When using thinking, maxOutputTokens must NOT be set or must be managed carefully.
      // We remove temperature as well to let the model reason.
      delete config.temperature; 
    } 
    // Search Mode Override (if Thinking is not active)
    else if (options.useSearch) {
      model = 'gemini-2.5-flash';
      // Enable Google Search Tool for grounding
      config.tools = [{ googleSearch: {} }];
      // Ensure temperature is low for factual extraction
      config.temperature = 0.0;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: contentParts
      },
      config: config,
    });

    let text = response.text || "Erro: O sistema não retornou texto válido.";

    // Process Grounding Metadata (Search Sources)
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      const sources = groundingChunks
        .map((chunk: any) => {
          if (chunk.web) {
            return `- [${chunk.web.title}](${chunk.web.uri})`;
          }
          return null;
        })
        .filter(Boolean);

      if (sources.length > 0) {
        text += `\n\n### 🌐 Fontes Consultadas\n${sources.join('\n')}`;
      }
    }

    return text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Erro de comunicação com o sistema especialista.");
  }
};

export const fileToGenerativePart = (file: File): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        mimeType: file.type,
        data: base64Data,
        name: file.name
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- LIVE API IMPLEMENTATION ---

function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createPcmBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeAudio(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class GeminiLiveClient {
  private inputContext: AudioContext;
  private outputContext: AudioContext;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private sessionPromise: Promise<any> | null = null;

  constructor(
    private onTranscript: (text: string) => void,
    private onClose: () => void
  ) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.inputContext = new AudioContextClass({ sampleRate: 16000 });
    this.outputContext = new AudioContextClass({ sampleRate: 24000 });
  }

  async connect() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    this.sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          // Setup Audio Input Stream
          this.source = this.inputContext.createMediaStreamSource(this.stream!);
          this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
          
          this.processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const blob = createPcmBlob(inputData);
            
            this.sessionPromise?.then(session => {
              session.sendRealtimeInput({ media: blob });
            });
          };

          this.source.connect(this.processor);
          this.processor.connect(this.inputContext.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          // Handle Audio Output
          const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputContext.currentTime);
            const audioBuffer = await decodeAudioData(
              decodeAudio(audioData),
              this.outputContext
            );
            
            const source = this.outputContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputContext.destination);
            source.onended = () => {
              this.activeSources.delete(source);
            };
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.activeSources.add(source);
          }

          // Handle Transcription
          if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
             this.onTranscript(msg.serverContent.modelTurn.parts[0].text);
          }
        },
        onclose: () => {
          this.disconnect();
        },
        onerror: (err) => {
          console.error("Live API Error:", err);
          this.disconnect();
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "Você é um Engenheiro Sênior Especialista. Fale de forma clara, técnica e objetiva sobre engenharia, materiais e normas.",
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }
    });
  }

  disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    this.activeSources.forEach(s => s.stop());
    this.activeSources.clear();
    
    this.sessionPromise?.then(session => {
      if (session.close) session.close();
    });
    
    this.onClose();
  }
}