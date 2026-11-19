import express from 'express';
import mammoth from 'mammoth';
import {
  lookupDoiMetadata,
  searchAcademicReferences,
  verifyExistingReference,
} from './academicApis.ts';
import { generateArticleDocxBuffer } from './docxExport.ts';
import {
  convertPaperToJournal,
  generateAbstractSection,
  generateArticleOutline,
  generateNarrativeSection,
  runWritingAssistant,
} from './geminiService.ts';
import { appendActivity, readWorkspace, writeWorkspace } from './storage.ts';
import type {
  ArticleDocument,
  ArticleLanguage,
  CitationStyle,
  JournalTemplateId,
  NarrativeSectionKey,
  ReferenceItem,
  WritingAssistantAction,
} from '../src/types/journal.ts';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Workspace state
  app.get('/api/workspace', (_req, res) => {
    const data = readWorkspace();
    res.json(data);
  });

  // Articles CRUD
  app.post('/api/articles', (req, res) => {
    const article = req.body as ArticleDocument;
    if (!article || !article.id) {
      res.status(400).json({ error: 'Data artikel tidak valid.' });
      return;
    }
    const data = readWorkspace();
    const existingIdx = data.articles.findIndex((a) => a.id === article.id);
    if (existingIdx >= 0) {
      data.articles[existingIdx] = article;
    } else {
      data.articles.unshift(article);
      appendActivity(data, {
        type: 'create',
        articleId: article.id,
        articleTitle: article.title,
        description: `Membuat naskah artikel baru: "${article.title}"`,
      });
    }
    writeWorkspace(data);
    res.json({ article, activities: data.activities });
  });

  app.put('/api/articles/:id', (req, res) => {
    const { id } = req.params;
    const payload = req.body as { article: ArticleDocument; activityDescription?: string };
    if (!payload?.article) {
      res.status(400).json({ error: 'Payload artikel tidak valid.' });
      return;
    }
    const data = readWorkspace();
    const idx = data.articles.findIndex((a) => a.id === id);
    const updated: ArticleDocument = {
      ...payload.article,
      id,
      updatedAt: new Date().toISOString(),
    };

    if (idx < 0) {
      // Upsert gracefully (handles Vercel serverless cold starts)
      data.articles.unshift(updated);
    } else {
      data.articles[idx] = updated;
    }

    if (payload.activityDescription) {
      appendActivity(data, {
        type: 'edit',
        articleId: updated.id,
        articleTitle: updated.title,
        description: payload.activityDescription,
      });
    }
    writeWorkspace(data);
    res.json({ article: updated, activities: data.activities });
  });

  app.delete('/api/articles/:id', (req, res) => {
    const { id } = req.params;
    const data = readWorkspace();
    const target = data.articles.find((a) => a.id === id);
    data.articles = data.articles.filter((a) => a.id !== id);
    if (target) {
      appendActivity(data, {
        type: 'edit',
        articleTitle: target.title,
        description: `Menghapus naskah "${target.title}"`,
      });
    }
    writeWorkspace(data);
    res.json({ ok: true, activities: data.activities });
  });

  // References CRUD & Academic API Integration
  app.get('/api/references/search', async (req, res) => {
    try {
      const q = String(req.query.q ?? '').trim();
      if (!q) {
        res.status(400).json({ error: 'Kata kunci pencarian referensi wajib diisi.' });
        return;
      }
      const source =
        (req.query.source as 'all' | 'crossref' | 'openalex' | 'semanticscholar') || 'all';
      const limit = Number(req.query.limit ?? 10);
      const yearStart = req.query.yearStart ? Number(req.query.yearStart) : undefined;
      const yearEnd = req.query.yearEnd ? Number(req.query.yearEnd) : undefined;

      const results = await searchAcademicReferences(q, {
        source,
        limit,
        yearStart,
        yearEnd,
      });
      res.json({ results });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mencari referensi akademik.',
      });
    }
  });

  app.post('/api/references/doi', async (req, res) => {
    try {
      const { doi, articleId } = req.body as { doi: string; articleId?: string };
      if (!doi || !doi.trim()) {
        res.status(400).json({ error: 'Nomor DOI wajib diisi.' });
        return;
      }
      const found = await lookupDoiMetadata(doi);
      if (!found) {
        res.status(404).json({
          error:
            'DOI tidak ditemukan di Crossref maupun OpenAlex. Pastikan format DOI benar (contoh: 10.1016/j.compedu.2023.104812).',
        });
        return;
      }

      const data = readWorkspace();
      const existing = data.references.find(
        (r) => r.doi && found.doi && r.doi.toLowerCase() === found.doi.toLowerCase()
      );
      const savedRef = existing ?? found;
      if (!existing) {
        data.references.unshift(savedRef);
      }

      if (articleId) {
        const art = data.articles.find((a) => a.id === articleId);
        if (art && !art.referenceIds.includes(savedRef.id)) {
          art.referenceIds.push(savedRef.id);
          art.updatedAt = new Date().toISOString();
        }
      }

      appendActivity(data, {
        type: 'reference',
        articleId,
        description: `Mengimpor & memverifikasi DOI: ${savedRef.title.slice(0, 70)}`,
      });
      writeWorkspace(data);
      res.json({ reference: savedRef, activities: data.activities });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mengimpor DOI.',
      });
    }
  });

  app.post('/api/references', (req, res) => {
    const { reference, articleId } = req.body as {
      reference: ReferenceItem;
      articleId?: string;
    };
    if (!reference || !reference.title) {
      res.status(400).json({ error: 'Metadata referensi tidak lengkap.' });
      return;
    }

    const data = readWorkspace();
    const normalizedRef: ReferenceItem = {
      ...reference,
      id: reference.id || `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      verificationStatus:
        reference.source === 'manual' ? 'unverified' : reference.verificationStatus || 'unverified',
      verificationNote:
        reference.source === 'manual'
          ? 'Input manual — klik Verifikasi untuk mencocokkan dengan Crossref/OpenAlex.'
          : reference.verificationNote,
    };

    const dup = data.references.find(
      (r) =>
        (normalizedRef.doi && r.doi && r.doi.toLowerCase() === normalizedRef.doi.toLowerCase()) ||
        r.title.toLowerCase() === normalizedRef.title.toLowerCase()
    );

    const savedRef = dup ?? normalizedRef;
    if (!dup) {
      data.references.unshift(savedRef);
    }

    if (articleId) {
      const art = data.articles.find((a) => a.id === articleId);
      if (art && !art.referenceIds.includes(savedRef.id)) {
        art.referenceIds.push(savedRef.id);
        art.updatedAt = new Date().toISOString();
      }
    }

    appendActivity(data, {
      type: 'reference',
      articleId,
      description: `Menambahkan referensi (${
        savedRef.verificationStatus === 'verified' ? 'Terverifikasi' : 'Belum Terverifikasi'
      }): ${savedRef.title.slice(0, 65)}`,
    });

    writeWorkspace(data);
    res.json({ reference: savedRef, references: data.references, activities: data.activities });
  });

  app.put('/api/references/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body as ReferenceItem;
    const data = readWorkspace();
    const idx = data.references.findIndex((r) => r.id === id);
    if (idx < 0) {
      data.references.unshift({ ...updated, id });
      writeWorkspace(data);
      res.json({ reference: data.references[0] });
      return;
    }
    data.references[idx] = { ...updated, id };
    writeWorkspace(data);
    res.json({ reference: data.references[idx] });
  });

  app.post('/api/references/:id/verify', async (req, res) => {
    try {
      const { id } = req.params;
      const bodyRef = (req.body as { reference?: ReferenceItem })?.reference;
      const data = readWorkspace();
      const idx = data.references.findIndex((r) => r.id === id);
      const targetRef = idx >= 0 ? data.references[idx] : bodyRef;

      if (!targetRef) {
        res.status(404).json({ error: 'Referensi tidak ditemukan.' });
        return;
      }

      const verified = await verifyExistingReference(targetRef);
      if (idx >= 0) {
        data.references[idx] = verified;
      } else {
        data.references.unshift(verified);
      }

      appendActivity(data, {
        type: 'reference',
        description:
          verified.verificationStatus === 'verified'
            ? `Memverifikasi referensi: ${verified.title.slice(0, 65)}`
            : `Verifikasi gagal (ditandai Belum Terverifikasi): ${verified.title.slice(0, 60)}`,
      });
      writeWorkspace(data);
      res.json({ reference: verified, activities: data.activities });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memverifikasi referensi.',
      });
    }
  });

  app.delete('/api/references/:id', (req, res) => {
    const { id } = req.params;
    const data = readWorkspace();
    data.references = data.references.filter((r) => r.id !== id);
    data.articles.forEach((a) => {
      a.referenceIds = a.referenceIds.filter((rid) => rid !== id);
    });
    writeWorkspace(data);
    res.json({ ok: true });
  });

  // AI Endpoints
  app.post('/api/ai/outline', async (req, res) => {
    try {
      const input = req.body;
      const targetRefsCount = Math.min(Math.max(Number(input.referenceCountTarget) || 10, 5), 25);

      const realRefs = await searchAcademicReferences(input.topic, {
        source: 'all',
        limit: targetRefsCount,
        yearStart: Number(input.referenceYearStart) || undefined,
        yearEnd: Number(input.referenceYearEnd) || undefined,
      });

      const outlineResult = await generateArticleOutline(input, realRefs);

      const data = readWorkspace();
      const addedRefs: ReferenceItem[] = [];
      for (const r of realRefs) {
        const existing = data.references.find(
          (ex) =>
            (r.doi && ex.doi && ex.doi.toLowerCase() === r.doi.toLowerCase()) ||
            ex.title.toLowerCase() === r.title.toLowerCase()
        );
        if (existing) {
          addedRefs.push(existing);
        } else {
          data.references.unshift(r);
          addedRefs.push(r);
        }
      }

      const now = new Date().toISOString();
      const newArticle: ArticleDocument = {
        id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: outlineResult.refinedTitle || input.topic,
        subtitle: outlineResult.subtitle || '',
        topic: input.topic,
        fieldOfStudy: input.fieldOfStudy,
        researchType: input.researchType,
        language: input.language,
        targetLength: input.targetLength,
        citationStyle: input.citationStyle,
        referenceCountTarget: targetRefsCount,
        referenceYearStart: Number(input.referenceYearStart) || 2020,
        referenceYearEnd: Number(input.referenceYearEnd) || 2026,
        journalTemplate: input.journalTemplate,
        customInstructions: input.customInstructions || '',
        status: 'in_progress',
        authors: [
          {
            id: `auth-${Date.now()}`,
            name: 'Penulis Utama',
            affiliation: 'Institusi / Universitas',
            email: 'penulis@institusi.ac.id',
            orcid: '',
            isCorresponding: true,
          },
        ],
        abstractId: '',
        abstractEn: '',
        keywords: outlineResult.keywords || [],
        sections: {
          introduction: '',
          literatureReview: '',
          methods: '',
          resultsDiscussion: '',
          conclusion: '',
        },
        sectionStatuses: {
          title: 'saved',
          authors: 'draft',
          abstract: 'empty',
          introduction: 'empty',
          literatureReview: 'empty',
          methods: 'empty',
          resultsDiscussion: 'empty',
          conclusion: 'empty',
          references: addedRefs.length > 0 ? 'saved' : 'empty',
        },
        outline: outlineResult.outline || [],
        referenceIds: addedRefs.map((r) => r.id),
        createdAt: now,
        updatedAt: now,
      };

      data.articles.unshift(newArticle);
      appendActivity(data, {
        type: 'outline',
        articleId: newArticle.id,
        articleTitle: newArticle.title,
        description: `Menghasilkan kerangka artikel & ${addedRefs.length} referensi terverifikasi untuk "${newArticle.title}"`,
      });
      writeWorkspace(data);

      res.json({
        article: newArticle,
        references: data.references,
        matchedReferences: addedRefs,
        activities: data.activities,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menghasilkan kerangka artikel.',
      });
    }
  });

  app.post('/api/ai/section', async (req, res) => {
    try {
      const {
        articleId,
        sectionKey,
        customPrompt,
        article: clientArticle,
        articleRefs: clientRefs,
      } = req.body as {
        articleId: string;
        sectionKey: 'abstract' | NarrativeSectionKey;
        customPrompt?: string;
        article?: ArticleDocument;
        articleRefs?: ReferenceItem[];
      };

      const data = readWorkspace();
      const idx = data.articles.findIndex((a) => a.id === articleId);
      const article = idx >= 0 ? data.articles[idx] : clientArticle;

      if (!article) {
        res.status(404).json({ error: 'Artikel tidak ditemukan.' });
        return;
      }

      const storedRefs = data.references.filter((r) => article.referenceIds.includes(r.id));
      const articleRefs = storedRefs.length > 0 ? storedRefs : clientRefs ?? [];

      if (sectionKey === 'abstract') {
        const abs = await generateAbstractSection(article, articleRefs, customPrompt);
        article.abstractId = abs.abstractId;
        article.abstractEn = abs.abstractEn;
        if (abs.keywords && abs.keywords.length > 0) {
          article.keywords = abs.keywords.slice(0, 5);
        }
        article.sectionStatuses.abstract = 'draft';
      } else {
        const text = await generateNarrativeSection(article, sectionKey, articleRefs, customPrompt);
        article.sections[sectionKey] = text;
        article.sectionStatuses[sectionKey] = 'draft';
      }

      article.updatedAt = new Date().toISOString();
      if (idx >= 0) {
        data.articles[idx] = article;
      } else {
        data.articles.unshift(article);
      }

      appendActivity(data, {
        type: 'generate_section',
        articleId: article.id,
        articleTitle: article.title,
        description: `Mengembangkan bagian ${sectionKey} untuk "${article.title}"`,
      });
      writeWorkspace(data);

      res.json({ article, activities: data.activities });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mengembangkan bagian artikel.',
      });
    }
  });

  app.post('/api/ai/assistant', async (req, res) => {
    try {
      const {
        action,
        text,
        targetLanguage,
        citationStyle,
        articleId,
        article: clientArticle,
      } = req.body as {
        action: WritingAssistantAction;
        text: string;
        targetLanguage?: 'Indonesian' | 'English';
        citationStyle?: CitationStyle;
        articleId?: string;
        article?: ArticleDocument;
      };

      const data = readWorkspace();
      const article =
        (articleId ? data.articles.find((a) => a.id === articleId) : undefined) ?? clientArticle;

      const output = await runWritingAssistant({
        action,
        text: text || '',
        targetLanguage,
        citationStyle,
        articleContext: article
          ? {
              title: article.title,
              fieldOfStudy: article.fieldOfStudy,
              researchType: article.researchType,
              abstractId: article.abstractId,
              introduction: article.sections.introduction,
              literatureReview: article.sections.literatureReview,
              methods: article.sections.methods,
              resultsDiscussion: article.sections.resultsDiscussion,
              conclusion: article.sections.conclusion,
            }
          : undefined,
      });

      appendActivity(data, {
        type: 'assistant',
        articleId: article?.id,
        articleTitle: article?.title,
        description: `Menggunakan Asisten Penulisan AI (${action})`,
      });
      writeWorkspace(data);

      res.json({ ...output, activities: data.activities });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menjalankan asisten penulisan AI.',
      });
    }
  });

  app.post('/api/ai/convert-paper', async (req, res) => {
    try {
      const { rawText, docxBase64, fileName, journalTemplate, citationStyle, language } =
        req.body as {
          rawText?: string;
          docxBase64?: string;
          fileName?: string;
          journalTemplate: JournalTemplateId;
          citationStyle: CitationStyle;
          language: ArticleLanguage;
        };

      let extractedText = (rawText || '').trim();
      if (docxBase64) {
        const buffer = Buffer.from(docxBase64, 'base64');
        const mammothResult = await mammoth.extractRawText({ buffer });
        extractedText = mammothResult.value.trim();
      }

      if (!extractedText || extractedText.length < 100) {
        res.status(400).json({
          error:
            'Konten makalah terlalu pendek atau tidak terbaca. Unggah file .docx atau tempel teks minimal 100 karakter.',
        });
        return;
      }

      const converted = await convertPaperToJournal({
        rawText: extractedText,
        journalTemplate,
        citationStyle,
        language,
      });

      const verifiedRefs: ReferenceItem[] = [];
      for (const refTitle of (converted.extractedReferenceTitles || []).slice(0, 5)) {
        if (!refTitle || refTitle.length < 10) continue;
        const matches = await searchAcademicReferences(refTitle, { limit: 1 });
        if (matches[0]) {
          verifiedRefs.push(matches[0]);
        } else {
          verifiedRefs.push({
            id: `unv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: refTitle,
            authors: ['Perlu Verifikasi Penulis'],
            year: new Date().getFullYear(),
            journal: 'Dari Naskah Asli',
            source: 'manual',
            verificationStatus: 'unverified',
            verificationNote:
              'Diekstrak dari dokumen makalah asli dan belum cocok otomatis dengan Crossref/OpenAlex. Harap verifikasi manual.',
          });
        }
      }

      const data = readWorkspace();
      const refIds: string[] = [];
      for (const ref of verifiedRefs) {
        const existing = data.references.find(
          (ex) =>
            (ref.doi && ex.doi && ex.doi.toLowerCase() === ref.doi.toLowerCase()) ||
            ex.title.toLowerCase() === ref.title.toLowerCase()
        );
        if (existing) {
          refIds.push(existing.id);
        } else {
          data.references.unshift(ref);
          refIds.push(ref.id);
        }
      }

      const now = new Date().toISOString();
      const article: ArticleDocument = {
        id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: converted.title,
        subtitle: converted.subtitle || '',
        topic: converted.title,
        fieldOfStudy: converted.fieldOfStudy || 'Multidisiplin',
        researchType: converted.researchType || 'Kualitatif',
        language,
        targetLength: 'Standar (~4.500 kata)',
        citationStyle,
        referenceCountTarget: Math.max(10, refIds.length),
        referenceYearStart: 2018,
        referenceYearEnd: new Date().getFullYear(),
        journalTemplate,
        customInstructions: fileName
          ? `Dikonversi dari dokumen: ${fileName}`
          : 'Dikonversi dari teks makalah',
        status: 'in_progress',
        authors: [
          {
            id: `auth-${Date.now()}`,
            name: 'Penulis Utama',
            affiliation: 'Institusi / Universitas',
            email: 'penulis@institusi.ac.id',
            isCorresponding: true,
          },
        ],
        abstractId: converted.abstractId || '',
        abstractEn: converted.abstractEn || '',
        keywords: (converted.keywords || []).slice(0, 5),
        sections: {
          introduction: converted.sections.introduction || '',
          literatureReview: converted.sections.literatureReview || '',
          methods: converted.sections.methods || '',
          resultsDiscussion: converted.sections.resultsDiscussion || '',
          conclusion: converted.sections.conclusion || '',
        },
        sectionStatuses: {
          title: 'saved',
          authors: 'draft',
          abstract: 'draft',
          introduction: 'draft',
          literatureReview: 'draft',
          methods: 'draft',
          resultsDiscussion: 'draft',
          conclusion: 'draft',
          references: refIds.length > 0 ? 'draft' : 'empty',
        },
        outline: [],
        referenceIds: refIds,
        createdAt: now,
        updatedAt: now,
      };

      data.articles.unshift(article);
      appendActivity(data, {
        type: 'convert',
        articleId: article.id,
        articleTitle: article.title,
        description: `Mengonversi makalah${fileName ? ` (${fileName})` : ''} menjadi artikel jurnal "${article.title}"`,
      });
      writeWorkspace(data);

      res.json({ article, references: data.references, activities: data.activities });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mengonversi makalah.',
      });
    }
  });

  // Export Word (.docx)
  app.post('/api/export/docx', async (req, res) => {
    try {
      const {
        articleId,
        article: clientArticle,
        articleRefs: clientRefs,
      } = req.body as {
        articleId: string;
        article?: ArticleDocument;
        articleRefs?: ReferenceItem[];
      };

      const data = readWorkspace();
      const article = data.articles.find((a) => a.id === articleId) ?? clientArticle;
      if (!article) {
        res.status(404).json({ error: 'Artikel tidak ditemukan.' });
        return;
      }

      const storedRefs = data.references.filter((r) => article.referenceIds.includes(r.id));
      const articleRefs = storedRefs.length > 0 ? storedRefs : clientRefs ?? [];
      const buffer = await generateArticleDocxBuffer(article, articleRefs);

      appendActivity(data, {
        type: 'export',
        articleId: article.id,
        articleTitle: article.title,
        description: `Mengekspor naskah "${article.title}" ke format Word (.docx)`,
      });
      writeWorkspace(data);

      const safeFileName = (article.title || 'artikel-jurnal')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFileName || 'artikel'}.docx"`
      );
      res.send(buffer);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mengekspor dokumen .docx.',
      });
    }
  });

  app.post('/api/activities', (req, res) => {
    const { type, articleId, articleTitle, description } = req.body as {
      type: 'export' | 'edit';
      articleId?: string;
      articleTitle?: string;
      description: string;
    };
    const data = readWorkspace();
    appendActivity(data, { type, articleId, articleTitle, description });
    writeWorkspace(data);
    res.json({ activities: data.activities });
  });

  return app;
}
