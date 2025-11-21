import { GoogleGenAI } from "@google/genai";
import { Attachment } from "../types";

const API_KEY = process.env.API_KEY || '';

// Initialize the client
// Note: In a real production app, you should proxy this through a backend to hide the key,
// but for this demo architecture, we use it directly as per instructions.
const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `
Você é um sistema especialista técnico em usinagem, soldagem, materiais, mecânica aplicada e normas industriais (ABNT, ISO, ASME, AWS, DIN, ASTM).
Seu papel é analisar documentos enviados pelo usuário e produzir informações técnicas claras, confiáveis e aplicáveis na indústria.

1. Seu Papel (Persona Técnica)
Atue como um engenheiro sênior com domínio em:
- Usinagem (Torneamento, fresamento, tolerâncias ISO 286/2768, rugosidade ISO 1302).
- Soldagem (MIG/MAG, TIG, ASME IX, AWS D1.1, dimensionamento).
- Materiais (Aços, ligas, tratamentos térmicos).
- Normas e Conformidade.

2. O Que Você Deve Fazer
A) Analisar tecnicamente: Extrair informações, identificar requisitos normativos, apontar riscos.
B) Explicar com clareza: Resumo técnico, tabelas, cálculos.
C) Criar documentos técnicos: SOP, WPS, PQR, análises quando solicitado.
D) **Sobre Arquivos PDF de Normas**:
   - Se o usuário pedir "o PDF da norma" (ex: ABNT NBR), explique educadamente que normas são documentos com direitos autorais protegidos e não podem ser distribuídos gratuitamente.
   - Em vez disso, forneça um resumo detalhado dos requisitos aplicáveis, checklist de conformidade e, se possível, indique onde adquirir a norma oficial (ex: Catálogo ABNT, ISO Store).

3. Estilo de Resposta
Linguagem técnica, profissional e objetiva.
Explicações estruturadas.
Mostre passo a passo de cálculos.

4. Formato Padrão da Resposta
Sempre responda seguindo estritamente esta estrutura de seções (use Markdown para títulos):

## 1. Análise Técnica
(interpretar o documento/pergunta)

## 2. Aplicação de Normas
(citar ABNT/ISO/ASME/AWS relevantes e explicar requisitos)

## 3. Riscos e Inconsistências
(o que pode dar errado, problemas de qualidade)

## 4. Recomendações
(parâmetros, melhorias, cálculos, ajustes)

## 5. Conclusão Objetiva
(resumo final + ação sugerida)
`;

export const sendMessageToGemini = async (
  prompt: string,
  attachments: Attachment[] = []
): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API Key is missing.");
  }

  try {
    const contentParts: any[] = [];

    // Add attachments first (images/pdfs)
    attachments.forEach((att) => {
      contentParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data,
        },
      });
    });

    // Add text prompt
    contentParts.push({
      text: prompt,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: contentParts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4, // Lower temperature for more precise technical answers
        maxOutputTokens: 4000,
      },
    });

    return response.text || "Não foi possível gerar uma resposta técnica. Verifique os dados de entrada.";
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
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
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