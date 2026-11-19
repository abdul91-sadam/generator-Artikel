import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { JOURNAL_TEMPLATES } from '../src/data/templates.ts';
import type {
  ArticleDocument,
  ArticleLanguage,
  ArticleLength,
  ArticleOutlineSection,
  CitationStyle,
  JournalTemplateId,
  NarrativeSectionKey,
  ReferenceItem,
  ResearchType,
  WritingAssistantAction,
} from '../src/types/journal.ts';
import { formatBibliographyEntry, formatInTextCitation } from '../src/utils/citations.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY belum tersedia di lingkungan server. Silakan periksa konfigurasi pada panel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('400') || msg.includes('403') || msg.includes('API_KEY_INVALID')) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

function formatVerifiedRefsForPrompt(refs: ReferenceItem[], style: CitationStyle): string {
  if (!refs.length) {
    return 'Tidak ada referensi eksternal terverifikasi yang dilampirkan. JANGAN menciptakan sitasi, nama penulis, judul jurnal, tahun, atau DOI fiktif. Jika sebuah klaim membutuhkan rujukan empiris yang belum tersedia, tuliskan placeholder eksplisit seperti [Perlu Sitasi Terverifikasi].';
  }
  return refs
    .map((ref, i) => {
      const inText = formatInTextCitation(ref, style, i + 1);
      const fullBib = formatBibliographyEntry(ref, style, i + 1);
      const absSnippet = ref.abstract ? `\n   Ringkasan/Abstrak: ${ref.abstract.slice(0, 320)}...` : '';
      return `[#${i + 1}] Status: ${ref.verificationStatus === 'verified' ? 'TERVERIFIKASI' : 'BELUM TERVERIFIKASI'}
   Sitasi dalam teks (${style}): ${inText}
   Entri Bibliografi: ${fullBib}${absSnippet}`;
    })
    .join('\n\n');
}

export interface OutlineGenerationInput {
  topic: string;
  fieldOfStudy: string;
  researchType: ResearchType;
  language: ArticleLanguage;
  targetLength: ArticleLength;
  citationStyle: CitationStyle;
  referenceCountTarget: number;
  referenceYearStart: number;
  referenceYearEnd: number;
  journalTemplate: JournalTemplateId;
  customInstructions?: string;
}

export interface GeneratedOutlineResult {
  refinedTitle: string;
  subtitle: string;
  keywords: string[];
  outline: ArticleOutlineSection[];
}

export async function generateArticleOutline(
  input: OutlineGenerationInput,
  verifiedRefs: ReferenceItem[]
): Promise<GeneratedOutlineResult> {
  const ai = getGeminiClient();
  const template = JOURNAL_TEMPLATES[input.journalTemplate];
  const refsContext = formatVerifiedRefsForPrompt(verifiedRefs, input.citationStyle);

  const prompt = `Susunlah kerangka (outline) artikel jurnal ilmiah yang terstruktur, logis, dan siap dikembangkan menjadi naskah lengkap.

PARAMETER PENELITIAN:
- Judul / Topik Awal: ${input.topic}
- Bidang Keilmuan: ${input.fieldOfStudy}
- Jenis Penelitian: ${input.researchType}
- Bahasa Artikel: ${input.language}
- Target Panjang Artikel: ${input.targetLength}
- Gaya Sitasi: ${input.citationStyle}
- Target Jumlah Referensi: ${input.referenceCountTarget} referensi (${input.referenceYearStart}–${input.referenceYearEnd})
- Template Jurnal Tujuan: ${template.name} (${template.formattingNotes})
- Instruksi Khusus Penulis: ${input.customInstructions?.trim() || 'Tidak ada'}

REFERENSI AKADEMIK TERVERIFIKASI YANG TERSEDIA:
${refsContext}

ATURAN KETAT:
1. Hasilkan kerangka terstruktur untuk bagian: title, abstract, introduction, literatureReview, methods, resultsDiscussion, conclusion.
2. Pada bagian Pendahuluan (introduction), poin rencana WAJIB mencakup: Latar belakang, Fenomena & permasalahan, Research gap, State of the art, Kebaruan penelitian, dan Rumusan tujuan penelitian.
3. Pada Tinjauan Pustaka (literatureReview), wajib mencakup: Teori utama, Penelitian terdahulu (merujuk HANYA pada referensi terverifikasi di atas bila relevan), Kerangka konseptual, dan Hipotesis (jika kuantitatif/relevan).
4. Pada Metode Penelitian (methods), wajib mencakup: Pendekatan, Jenis penelitian, Lokasi & waktu, Populasi & sampel/informan, Sumber data, Teknik pengumpulan data, dan Teknik analisis data sesuai jenis penelitian (${input.researchType}).
5. Pada Hasil dan Pembahasan (resultsDiscussion), wajib mencakup: Penyajian hasil, Analisis data, Interpretasi temuan, Perbandingan dengan penelitian terdahulu, dan Implikasi penelitian.
6. Pada Kesimpulan (conclusion), wajib mencakup: Kesimpulan utama, Implikasi, Keterbatasan penelitian, dan Saran penelitian selanjutnya.
7. JANGAN PERNAH mengarang referensi, DOI, nama penulis, atau angka hasil penelitian palsu. Jika naskah membutuhkan data empiris spesifik penulis, cantumkan panduan placeholder data yang jelas agar penulis mengisinya.
8. Gunakan bahasa akademik ${input.language === 'English' ? 'Inggris' : 'Indonesia'} yang natural, objektif, dan berstandar jurnal terindeks.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Anda adalah Academic Research Specialist dan Editor Jurnal Ilmiah bereputasi internasional. Selalu berikan kerangka artikel yang tajam, metodologis, dan patuh pada integritas akademik (anti-fabrikasi referensi).',
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refinedTitle: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            outline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionKey: {
                    type: Type.STRING,
                    description:
                      'One of: title, abstract, introduction, literatureReview, methods, resultsDiscussion, conclusion',
                  },
                  heading: { type: Type.STRING },
                  plannedPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  targetWords: { type: Type.INTEGER },
                  guidance: { type: Type.STRING },
                },
                required: ['sectionKey', 'heading', 'plannedPoints', 'targetWords', 'guidance'],
              },
            },
          },
          required: ['refinedTitle', 'subtitle', 'keywords', 'outline'],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? '{}').trim()) as GeneratedOutlineResult;
  return parsed;
}

export async function generateAbstractSection(
  article: ArticleDocument,
  refs: ReferenceItem[],
  customPrompt?: string
): Promise<{ abstractId: string; abstractEn: string; keywords: string[] }> {
  const ai = getGeminiClient();
  const template = JOURNAL_TEMPLATES[article.journalTemplate];
  const outlineItem = article.outline?.find((o) => o.sectionKey === 'abstract');

  const prompt = `Susunlah Abstrak dwibahasa (Bahasa Indonesia dan Bahasa Inggris) serta 3–5 kata kunci akademik untuk artikel berikut.

INFORMASI ARTIKEL:
- Judul: ${article.title}
- Bidang Keilmuan: ${article.fieldOfStudy}
- Jenis Penelitian: ${article.researchType}
- Template Jurnal: ${template.name} (Batas kata abstrak: ${template.abstractWordLimit})
- Rencana Kerangka Abstrak: ${outlineItem ? outlineItem.plannedPoints.join('; ') : 'Latar belakang singkat, tujuan, metode, temuan utama/kerangka hasil, dan implikasi.'}
- Ringkasan Konten yang Sudah Ada:
  * Pendahuluan: ${(article.sections.introduction || '').slice(0, 600)}
  * Metode: ${(article.sections.methods || '').slice(0, 600)}
  * Hasil & Pembahasan: ${(article.sections.resultsDiscussion || '').slice(0, 600)}
  * Kesimpulan: ${(article.sections.conclusion || '').slice(0, 400)}
- Referensi Terkait: ${refs.slice(0, 5).map((r) => r.title).join('; ')}
- Instruksi Tambahan Pengguna: ${customPrompt || article.customInstructions || 'Tidak ada'}

KETENTUAN:
- Tulis dalam satu paragraf padat (150–250 kata) untuk masing-masing bahasa.
- Abstrak harus mencakup latar belakang/urgensi, tujuan, metode, temuan/kontribusi utama, dan implikasi.
- Jangan membuat klaim angka statistik fiktif jika data penelitian belum diisikan; gunakan formulasi metodologis atau penanda yang jujur.
- Sediakan 3 hingga 5 kata kunci yang relevan dan spesifik.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Anda adalah editor jurnal ilmiah dwibahasa. Hasilkan abstrak Bahasa Indonesia dan Abstract Bahasa Inggris yang presisi, kohesif, dan sesuai kaidah penulisan jurnal akademik.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            abstractId: { type: Type.STRING },
            abstractEn: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['abstractId', 'abstractEn', 'keywords'],
        },
      },
    })
  );

  return JSON.parse((response.text ?? '{}').trim()) as {
    abstractId: string;
    abstractEn: string;
    keywords: string[];
  };
}

const SECTION_REQUIREMENTS: Record<NarrativeSectionKey, string> = {
  introduction: `Bagian D: PENDAHULUAN. Wajib menguraikan secara mengalir dalam paragraf akademik yang utuh (bukan sekadar poin-poin datar):
1. Latar belakang penelitian yang kuat dan kontekstual.
2. Fenomena empiris dan permasalahan penelitian yang spesifik.
3. Research gap (kesenjangan penelitian dari literatur terdahulu).
4. State of the art (posisi terkini penelitian di bidang ini).
5. Kebaruan (novelty) dan kontribusi ilmiah penelitian ini.
6. Rumusan tujuan penelitian secara eksplisit di paragraf penutup.`,

  literatureReview: `Bagian E: TINJAUAN PUSTAKA. Wajib mencakup sub-bagian terstruktur:
1. Teori Utama (Grand/Middle Theory yang melandasi variabel atau fenomena).
2. Penelitian Terdahulu (sintesis kritis komparatif dari literatur terverifikasi—bukan sekadar daftar ringkasan satu per satu).
3. Kerangka Konseptual (penjelasan alur relasi antar konsep/variabel).
4. Hipotesis Penelitian (sertakan jika penelitian bersifat kuantitatif/eksperimental, atau proposisi konseptual jika kualitatif/studi pustaka).`,

  methods: `Bagian F: METODE PENELITIAN. Wajib memaparkan secara rinci dan dapat direplikasi:
1. Pendekatan penelitian dan rasionalisasinya.
2. Jenis atau desain penelitian.
3. Lokasi dan waktu penelitian (gunakan placeholder terstruktur seperti [Nama Lokasi/Institusi] jika belum ditentukan pengguna).
4. Populasi dan sampel atau informan beserta teknik penentuannya.
5. Sumber data (primer dan/atau sekunder).
6. Teknik dan instrumen pengumpulan data.
7. Teknik analisis data serta uji keabsahan/validitas data.`,

  resultsDiscussion: `Bagian G: HASIL DAN PEMBAHASAN. Wajib memaparkan secara analitis:
1. Penyajian hasil penelitian secara sistematis (jika data lapangan belum diinput oleh penulis, sediakan narasi struktur penyajian hasil lengkap dengan penanda jelas seperti [Masukkan Tabel/Data Hasil Observasi Penulis] tanpa mengarang angka palsu).
2. Analisis data yang logis dan tajam.
3. Interpretasi temuan secara teoretis.
4. Perbandingan dan dialog temuan dengan penelitian terdahulu (hanya merujuk referensi terverifikasi yang disediakan).
5. Implikasi teoretis maupun praktis penelitian.`,

  conclusion: `Bagian H: KESIMPULAN. Wajib mencakup:
1. Kesimpulan utama yang menjawab langsung tujuan penelitian (tanpa mengulang angka mentah secara berlebihan).
2. Implikasi penelitian bagi ilmu pengetahuan dan praktik kebijakan/industri.
3. Keterbatasan penelitian secara jujur dan objektif.
4. Saran penelitian selanjutnya yang konkret dan terarah.`,
};

export async function generateNarrativeSection(
  article: ArticleDocument,
  sectionKey: NarrativeSectionKey,
  refs: ReferenceItem[],
  customPrompt?: string
): Promise<string> {
  const ai = getGeminiClient();
  const template = JOURNAL_TEMPLATES[article.journalTemplate];
  const outlineItem = article.outline?.find((o) => o.sectionKey === sectionKey);
  const refsContext = formatVerifiedRefsForPrompt(refs, article.citationStyle);
  const langLabel =
    article.language === 'English'
      ? 'Bahasa Inggris akademik (formal academic English)'
      : 'Bahasa Indonesia akademik baku sesuai EYD V';

  const existingSummary = Object.entries(article.sections)
    .filter(([k, v]) => k !== sectionKey && v && v.trim().length > 0)
    .map(([k, v]) => `- ${k}: ${v.slice(0, 450)}...`)
    .join('\n');

  const wordGuidance =
    article.targetLength === 'Komprehensif (~7.000 kata)'
      ? 'Sekitar 900–1.400 kata yang mendalam dan kaya argumen.'
      : article.targetLength === 'Standar (~4.500 kata)'
        ? 'Sekitar 600–950 kata yang padat dan terstruktur.'
        : 'Sekitar 400–650 kata yang ringkas namun utuh.';

  const prompt = `Tuliskan naskah lengkap untuk bagian artikel jurnal berikut dalam ${langLabel}.

IDENTITAS ARTIKEL:
- Judul: ${article.title}
- Topik: ${article.topic}
- Bidang Keilmuan: ${article.fieldOfStudy}
- Jenis Penelitian: ${article.researchType}
- Template Jurnal: ${template.name} (${template.formattingNotes})
- Gaya Sitasi: ${article.citationStyle}
- Target Panjang Bagian Ini: ${outlineItem?.targetWords ? `~${outlineItem.targetWords} kata` : wordGuidance}

TUGAS BAGIAN INI:
${SECTION_REQUIREMENTS[sectionKey]}

POIN KERANGKA YANG HARUS DIKEMBANGKAN:
${outlineItem ? outlineItem.plannedPoints.map((p, idx) => `${idx + 1}. ${p}`).join('\n') : 'Ikuti struktur standar bagian ini secara menyeluruh.'}

KONTEKS BAGIAN LAIN YANG SUDAH ADA (UNTUK KONSISTENSI):
${existingSummary || 'Belum ada bagian lain yang ditulis.'}

REFERENSI TERVERIFIKASI YANG BOLEH DISITASI:
${refsContext}

INSTRUKSI TAMBAHAN PENGGUNA:
${customPrompt || article.customInstructions || 'Tidak ada'}

ATURAN INTEGRITAS AKADEMIK & KUALITAS BAHASA:
1. Gunakan gaya bahasa akademik yang natural, logis, objektif, kohesif antarparagraf, dan tidak repetitif.
2. Gunakan format sitasi dalam teks yang persis sesuai gaya ${article.citationStyle} dan HANYA sitasikan referensi dari daftar REFERENSI TERVERIFIKASI di atas.
3. DILARANG KERAS menciptakan referensi fiktif, DOI palsu, nama penulis fiktif, atau data/angka hasil survei palsu.
4. Gunakan subjudul Markdown sederhana (misalnya ### Subjudul) bila membantu keterbacaan struktur bagian (seperti pada Tinjauan Pustaka atau Metode), tanpa menuliskan judul utama bagian lagi di baris paling atas.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Anda adalah penulis dan penyunting artikel jurnal ilmiah bereputasi. Tuliskan prosa akademik yang mengalir, argumentatif, objektif, serta 100% jujur dalam penggunaan sitasi dan data.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    })
  );

  return (response.text ?? '').trim();
}

export async function runWritingAssistant(params: {
  action: WritingAssistantAction;
  text: string;
  targetLanguage?: 'Indonesian' | 'English';
  citationStyle?: CitationStyle;
  articleContext?: {
    title: string;
    fieldOfStudy: string;
    researchType: ResearchType;
    abstractId?: string;
    introduction?: string;
    literatureReview?: string;
    methods?: string;
    resultsDiscussion?: string;
    conclusion?: string;
  };
}): Promise<{ result: string; notes?: string }> {
  const ai = getGeminiClient();

  const actionPrompts: Record<WritingAssistantAction, string> = {
    paraphrase:
      'Lakukan parafrase akademik tingkat tinggi terhadap teks berikut agar bebas plagiarisme, mempertahankan makna ilmiah asli, dengan struktur kalimat yang lebih elegan dan bervariasi.',
    grammar:
      'Perbaiki tata bahasa, ejaan (EYD V untuk Indonesia / Academic Grammar untuk Inggris), tanda baca, kejelasan sintaksis, dan kohesi kalimat pada teks berikut tanpa mengubah substansi ilmiah.',
    formalize:
      'Ubah bahasa yang masih bersifat informal, kasual, atau deskriptif umum pada teks berikut menjadi gaya bahasa akademik ilmiah yang formal, objektif, dan presisi.',
    expand_paragraph:
      'Kembangkan paragraf berikut menjadi uraian akademik yang lebih mendalam, lengkap dengan kalimat topik, elaborasi analitis, transisi logis, dan kalimat penegas tanpa bertele-tele atau mengarang fakta palsu.',
    summarize_journal:
      'Ringkas artikel atau teks jurnal berikut secara terstruktur: (1) Fokus & Masalah Penelitian, (2) Metode yang Digunakan, (3) Temuan Utama, (4) Kontribusi & Keterbatasan.',
    research_gap:
      'Analisis teks/topik berikut untuk merumuskan kesenjangan penelitian (Research Gap) yang tajam: identifikasi apa yang sudah banyak dikaji, apa yang belum terjawab (empirical/theoretical/methodological gap), dan posisi kebaruan penelitian.',
    problem_statement:
      'Susunlah rumusan masalah penelitian yang tajam, spesifik, dapat diteliti (researchable), dan selaras dengan pendekatan ilmiah berdasarkan konteks berikut.',
    research_objectives:
      'Susunlah rumusan tujuan penelitian yang operasional, terukur, dan berkorespondensi langsung dengan rumusan masalah serta metode yang direncanakan.',
    develop_discussion:
      'Kembangkan bagian pembahasan dari temuan atau poin berikut dengan mengaitkan interpretasi logis, makna teoretis, komparasi analitis dengan literatur (gunakan penanda [Tambahkan Sitasi Terverifikasi] jika butuh rujukan baru), dan implikasi praktis.',
    consistency_check:
      'Lakukan audit konsistensi menyeluruh antarbagian naskah (Judul ↔ Tujuan ↔ Metode ↔ Hasil & Pembahasan ↔ Kesimpulan). Berikan laporan terstruktur mengenai: (1) Keselarasan yang sudah kuat, (2) Ketidakkonsistenan atau celah logika yang ditemukan, dan (3) Rekomendasi perbaikan konkret per bagian.',
    translate: `Terjemahkan teks akademik berikut ke dalam bahasa ${params.targetLanguage === 'Indonesian' ? 'Indonesia akademik baku' : 'Inggris akademik standar jurnal internasional (Q1/Q2)'} dengan mempertahankan terminologi teknis dan nada ilmiah.`,
  };

  let contentInput = params.text;
  if (params.action === 'consistency_check' && params.articleContext) {
    const ctx = params.articleContext;
    contentInput = `JUDUL: ${ctx.title}
BIDANG & JENIS PENELITIAN: ${ctx.fieldOfStudy} (${ctx.researchType})
ABSTRAK: ${ctx.abstractId || '(kosong)'}
PENDAHULUAN: ${(ctx.introduction || '(kosong)').slice(0, 1500)}
TINJAUAN PUSTAKA: ${(ctx.literatureReview || '(kosong)').slice(0, 1200)}
METODE PENELITIAN: ${(ctx.methods || '(kosong)').slice(0, 1200)}
HASIL & PEMBAHASAN: ${(ctx.resultsDiscussion || '(kosong)').slice(0, 1500)}
KESIMPULAN: ${(ctx.conclusion || '(kosong)').slice(0, 1000)}
${params.text ? `\nCATATAN TAMBAHAN PENGGUNA:\n${params.text}` : ''}`;
  }

  const prompt = `${actionPrompts[params.action]}

${params.articleContext && params.action !== 'consistency_check' ? `KONTEKS ARTIKEL: ${params.articleContext.title} (${params.articleContext.fieldOfStudy}, ${params.articleContext.researchType})\n` : ''}
TEKS / DATA MASUKAN:
"""
${contentInput}
"""

Berikan hasil dalam format yang bersih dan siap pakai. Jangan membuat referensi atau DOI palsu.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Anda adalah AI Academic Writing Assistant yang teliti, objektif, dan berstandar publikasi jurnal ilmiah.',
        thinkingConfig: {
          thinkingLevel:
            params.action === 'consistency_check' || params.action === 'research_gap'
              ? ThinkingLevel.HIGH
              : ThinkingLevel.LOW,
        },
      },
    })
  );

  return { result: (response.text ?? '').trim() };
}

export interface PaperConversionOutput {
  title: string;
  subtitle: string;
  fieldOfStudy: string;
  researchType: ResearchType;
  abstractId: string;
  abstractEn: string;
  keywords: string[];
  sections: {
    introduction: string;
    literatureReview: string;
    methods: string;
    resultsDiscussion: string;
    conclusion: string;
  };
  extractedReferenceTitles: string[];
}

export async function convertPaperToJournal(params: {
  rawText: string;
  journalTemplate: JournalTemplateId;
  citationStyle: CitationStyle;
  language: ArticleLanguage;
}): Promise<PaperConversionOutput> {
  const ai = getGeminiClient();
  const template = JOURNAL_TEMPLATES[params.journalTemplate];
  const truncatedText = params.rawText.slice(0, 28000);

  const prompt = `Konversikan dokumen makalah/laporan penelitian mentah berikut menjadi artikel jurnal ilmiah terstruktur sesuai template ${template.name} (${template.formattingNotes}), gaya sitasi ${params.citationStyle}, dan bahasa ${params.language}.

TEKS DOKUMEN MAKALAH ASLI:
"""
${truncatedText}
"""

TUGAS KONVERSI:
1. Ekstrak dan sempurnakan judul artikel ilmiah yang ringkas dan representatif.
2. Susun Abstrak Bahasa Indonesia (150–250 kata), Abstract Bahasa Inggris (150–250 kata), dan 3–5 kata kunci.
3. Restrukturisasi isi makalah menjadi 5 bagian naratif jurnal yang kohesif dan padat (tanpa bahasa laporan tugas/skripsi yang bertele-tele):
   - introduction (Latar belakang, fenomena, research gap, state of the art, kebaruan, tujuan)
   - literatureReview (Teori utama, sintesis kajian terdahulu, kerangka konseptual)
   - methods (Pendekatan, desain, lokasi/sampel, sumber data, teknik pengumpulan & analisis data)
   - resultsDiscussion (Penyajian hasil, analisis, interpretasi, perbandingan dengan literatur, implikasi)
   - conclusion (Kesimpulan utama, implikasi, keterbatasan, saran)
4. Pertahankan seluruh data, temuan, dan fakta asli dari dokumen makalah. JANGAN mengarang angka atau referensi baru.
5. Ekstrak daftar judul/referensi yang tercantum di dalam makalah asli ke dalam field extractedReferenceTitles agar sistem dapat memverifikasinya secara otomatis melalui API akademik.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Anda adalah editor jurnal akademik ahli dalam mengonversi makalah, laporan riset, atau tugas akhir menjadi artikel jurnal siap kirim (publication-ready).',
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            fieldOfStudy: { type: Type.STRING },
            researchType: {
              type: Type.STRING,
              description: 'One of: Kualitatif, Kuantitatif, Mixed Methods, Studi Pustaka',
            },
            abstractId: { type: Type.STRING },
            abstractEn: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            sections: {
              type: Type.OBJECT,
              properties: {
                introduction: { type: Type.STRING },
                literatureReview: { type: Type.STRING },
                methods: { type: Type.STRING },
                resultsDiscussion: { type: Type.STRING },
                conclusion: { type: Type.STRING },
              },
              required: [
                'introduction',
                'literatureReview',
                'methods',
                'resultsDiscussion',
                'conclusion',
              ],
            },
            extractedReferenceTitles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'title',
            'subtitle',
            'fieldOfStudy',
            'researchType',
            'abstractId',
            'abstractEn',
            'keywords',
            'sections',
            'extractedReferenceTitles',
          ],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? '{}').trim()) as PaperConversionOutput;
  const validTypes: ResearchType[] = ['Kualitatif', 'Kuantitatif', 'Mixed Methods', 'Studi Pustaka'];
  if (!validTypes.includes(parsed.researchType)) {
    parsed.researchType = 'Kualitatif';
  }
  return parsed;
}
