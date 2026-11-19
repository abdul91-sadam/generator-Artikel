import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Loader2,
  PenTool,
  ShieldAlert,
  Wand2,
} from 'lucide-react';
import { JOURNAL_TEMPLATES } from '../data/templates';
import type {
  ActivityLog,
  ArticleDocument,
  ArticleLanguage,
  ArticleLength,
  CitationStyle,
  JournalTemplateId,
  NarrativeSectionKey,
  ReferenceItem,
  ResearchType,
} from '../types/journal';

interface ArticleGeneratorViewProps {
  onArticleCreated: (
    article: ArticleDocument,
    references: ReferenceItem[],
    activities: ActivityLog[]
  ) => void;
  onArticleUpdated: (article: ArticleDocument, activities: ActivityLog[]) => void;
  onOpenInEditor: (articleId: string) => void;
}

const FIELD_SUGGESTIONS = [
  'Teknik Informatika & Kecerdasan Buatan',
  'Pendidikan & Teknologi Pembelajaran',
  'Ekonomi, Manajemen & Bisnis Digital',
  'Kesehatan Masyarakat & Kedokteran',
  'Ilmu Sosial, Hukum & Kebijakan Publik',
  'Pertanian, Pangan & Lingkungan',
];

export const ArticleGeneratorView: React.FC<ArticleGeneratorViewProps> = ({
  onArticleCreated,
  onArticleUpdated,
  onOpenInEditor,
}) => {
  const [topic, setTopic] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('Pendidikan & Teknologi Pembelajaran');
  const [researchType, setResearchType] = useState<ResearchType>('Kuantitatif');
  const [language, setLanguage] = useState<ArticleLanguage>('Bilingual (Abstrak ID+EN)');
  const [targetLength, setTargetLength] = useState<ArticleLength>('Standar (~4.500 kata)');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA 7');
  const [referenceCountTarget, setReferenceCountTarget] = useState<number>(10);
  const [referenceYearStart, setReferenceYearStart] = useState<number>(2020);
  const [referenceYearEnd, setReferenceYearEnd] = useState<number>(2026);
  const [journalTemplate, setJournalTemplate] = useState<JournalTemplateId>('imrad-sinta');
  const [customInstructions, setCustomInstructions] = useState('');

  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedArticle, setGeneratedArticle] = useState<ArticleDocument | null>(null);
  const [matchedRefs, setMatchedRefs] = useState<ReferenceItem[]>([]);
  const [expandingSection, setExpandingSection] = useState<string | null>(null);
  const [isExpandingAll, setIsExpandingAll] = useState(false);

  const selectedTemplate = JOURNAL_TEMPLATES[journalTemplate];

  const handleTemplateChange = (id: JournalTemplateId) => {
    setJournalTemplate(id);
    setCitationStyle(JOURNAL_TEMPLATES[id].defaultCitationStyle);
  };

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Masukkan judul atau topik penelitian terlebih dahulu.');
      return;
    }
    setIsGeneratingOutline(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          fieldOfStudy: fieldOfStudy.trim() || 'Multidisiplin',
          researchType,
          language,
          targetLength,
          citationStyle,
          referenceCountTarget,
          referenceYearStart,
          referenceYearEnd,
          journalTemplate,
          customInstructions,
        }),
      });
      const data = (await res.json()) as {
        article?: ArticleDocument;
        references?: ReferenceItem[];
        matchedReferences?: ReferenceItem[];
        activities?: ActivityLog[];
        error?: string;
      };
      if (!res.ok || !data.article) {
        throw new Error(data.error || 'Gagal membuat kerangka artikel.');
      }
      setGeneratedArticle(data.article);
      setMatchedRefs(data.matchedReferences ?? []);
      onArticleCreated(data.article, data.references ?? [], data.activities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat kerangka.');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleExpandSection = async (sectionKey: 'abstract' | NarrativeSectionKey) => {
    if (!generatedArticle) return;
    setExpandingSection(sectionKey);
    setError(null);
    try {
      const res = await fetch('/api/ai/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: generatedArticle.id,
          sectionKey,
          article: generatedArticle,
          articleRefs: matchedRefs,
        }),
      });
      const data = (await res.json()) as {
        article?: ArticleDocument;
        activities?: ActivityLog[];
        error?: string;
      };
      if (!res.ok || !data.article) {
        throw new Error(data.error || `Gagal mengembangkan bagian ${sectionKey}.`);
      }
      setGeneratedArticle(data.article);
      onArticleUpdated(data.article, data.activities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengembangkan bagian.');
    } finally {
      setExpandingSection(null);
    }
  };

  const handleExpandAllSections = async () => {
    if (!generatedArticle) return;
    setIsExpandingAll(true);
    setError(null);
    const keys: Array<'abstract' | NarrativeSectionKey> = [
      'abstract',
      'introduction',
      'literatureReview',
      'methods',
      'resultsDiscussion',
      'conclusion',
    ];
    let currentArticle = generatedArticle;
    try {
      for (const key of keys) {
        setExpandingSection(key);
        const res = await fetch('/api/ai/section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId: currentArticle.id,
            sectionKey: key,
            article: currentArticle,
            articleRefs: matchedRefs,
          }),
        });
        const data = (await res.json()) as {
          article?: ArticleDocument;
          activities?: ActivityLog[];
          error?: string;
        };
        if (!res.ok || !data.article) {
          throw new Error(data.error || `Gagal mengembangkan bagian ${key}.`);
        }
        currentArticle = data.article;
        setGeneratedArticle(currentArticle);
        onArticleUpdated(currentArticle, data.activities ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengembangkan seluruh bagian.');
    } finally {
      setExpandingSection(null);
      setIsExpandingAll(false);
    }
  };

  const isSectionGenerated = (sectionKey: string): boolean => {
    if (!generatedArticle) return false;
    if (sectionKey === 'title') return Boolean(generatedArticle.title);
    if (sectionKey === 'abstract') return Boolean(generatedArticle.abstractId || generatedArticle.abstractEn);
    if (sectionKey in generatedArticle.sections) {
      return Boolean(generatedArticle.sections[sectionKey as NarrativeSectionKey]);
    }
    return false;
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
          AI Article Generator
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
          Tentukan parameter penelitian dan template jurnal tujuan. Sistem akan mencari referensi terverifikasi dari Crossref, OpenAlex, dan Semantic Scholar, lalu menyusun kerangka ilmiah sebelum dikembangkan per bagian.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Generator Form */}
        <form onSubmit={handleGenerateOutline} className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div>
              <label htmlFor="gen-topic" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Judul atau Topik Penelitian
              </label>
              <textarea
                id="gen-topic"
                rows={3}
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Pengaruh Pembelajaran Adaptif Berbasis Kecerdasan Buatan terhadap Kemampuan Berpikir Kritis Mahasiswa Teknik"
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="gen-field" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Bidang Keilmuan
              </label>
              <input
                id="gen-field"
                type="text"
                list="field-suggestions"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
              <datalist id="field-suggestions">
                {FIELD_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gen-type" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Jenis Penelitian
                </label>
                <select
                  id="gen-type"
                  value={researchType}
                  onChange={(e) => setResearchType(e.target.value as ResearchType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="Kuantitatif">Kuantitatif</option>
                  <option value="Kualitatif">Kualitatif</option>
                  <option value="Mixed Methods">Mixed Methods</option>
                  <option value="Studi Pustaka">Studi Pustaka</option>
                </select>
              </div>

              <div>
                <label htmlFor="gen-lang" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Bahasa Artikel
                </label>
                <select
                  id="gen-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as ArticleLanguage)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="Bilingual (Abstrak ID+EN)">Bahasa Indonesia (Abstrak ID+EN)</option>
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                  <option value="English">English (International)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gen-length" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Target Panjang Artikel
                </label>
                <select
                  id="gen-length"
                  value={targetLength}
                  onChange={(e) => setTargetLength(e.target.value as ArticleLength)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="Ringkas (~2.500 kata)">Ringkas (~2.500 kata)</option>
                  <option value="Standar (~4.500 kata)">Standar (~4.500 kata)</option>
                  <option value="Komprehensif (~7.000 kata)">Komprehensif (~7.000 kata)</option>
                </select>
              </div>

              <div>
                <label htmlFor="gen-citation" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Gaya Sitasi
                </label>
                <select
                  id="gen-citation"
                  value={citationStyle}
                  onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="APA 7">APA 7th Edition</option>
                  <option value="IEEE">IEEE</option>
                  <option value="Chicago">Chicago</option>
                  <option value="Harvard">Harvard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="gen-refcount" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Jumlah Referensi
                </label>
                <select
                  id="gen-refcount"
                  value={referenceCountTarget}
                  onChange={(e) => setReferenceCountTarget(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value={6}>6 referensi</option>
                  <option value={10}>10 referensi</option>
                  <option value={15}>15 referensi</option>
                  <option value={20}>20 referensi</option>
                  <option value={25}>25 referensi</option>
                </select>
              </div>

              <div>
                <label htmlFor="gen-year-start" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Tahun Awal
                </label>
                <input
                  id="gen-year-start"
                  type="number"
                  min={1990}
                  max={2026}
                  value={referenceYearStart}
                  onChange={(e) => setReferenceYearStart(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="gen-year-end" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Tahun Akhir
                </label>
                <input
                  id="gen-year-end"
                  type="number"
                  min={1990}
                  max={2026}
                  value={referenceYearEnd}
                  onChange={(e) => setReferenceYearEnd(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="gen-template" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Target Jurnal / Template Jurnal
              </label>
              <select
                id="gen-template"
                value={journalTemplate}
                onChange={(e) => handleTemplateChange(e.target.value as JournalTemplateId)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                {Object.values(JOURNAL_TEMPLATES).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                {selectedTemplate.formattingNotes}
              </p>
            </div>

            <div>
              <label htmlFor="gen-custom" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Instruksi Khusus Penulis (Opsional)
              </label>
              <textarea
                id="gen-custom"
                rows={2}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Contoh: Fokuskan pada studi kasus perguruan tinggi vokasi di Indonesia; gunakan uji SEM-PLS pada metode."
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isGeneratingOutline}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {isGeneratingOutline ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Mencari Referensi Resmi & Menyusun Kerangka...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  GENERATE KERANGKA ARTIKEL
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right: Outline & Per-Section Expansion Workspace */}
        <section className="lg:col-span-7">
          {!generatedArticle ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <PenTool className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
              <h2 className="mt-4 font-display text-xl font-semibold text-slate-900">
                Kerangka Artikel & Referensi Terverifikasi
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500 leading-relaxed">
                Isi parameter penelitian di sebelah kiri lalu tekan <strong className="text-slate-800">GENERATE KERANGKA ARTIKEL</strong>. Sistem akan terlebih dahulu menarik metadata jurnal asli dari Crossref, OpenAlex, dan Semantic Scholar sebelum menyusun kerangka A–I.
              </p>
              <div className="mx-auto mt-6 max-w-md border-t border-slate-100 pt-5 text-left text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">Jaminan Integritas Akademik:</p>
                <p>1. Kerangka dibuat terlebih dahulu agar alur logika penelitian dapat ditinjau.</p>
                <p>2. Setiap bagian (Abstrak, Pendahuluan, Tinjauan Pustaka, Metode, Hasil & Pembahasan, Kesimpulan) dapat dikembangkan satu per satu.</p>
                <p>3. Tidak ada referensi, DOI, atau nama penulis palsu yang diciptakan oleh AI.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Generated Header Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-emerald-700">Kerangka Siap Dikembangkan</span>
                      <span aria-hidden="true">·</span>
                      <span>{JOURNAL_TEMPLATES[generatedArticle.journalTemplate]?.name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{matchedRefs.length} referensi terverifikasi</span>
                    </div>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900 text-balance">
                      {generatedArticle.title}
                    </h2>
                    {generatedArticle.subtitle && (
                      <p className="mt-1 text-sm italic text-slate-600">{generatedArticle.subtitle}</p>
                    )}
                    {generatedArticle.keywords.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        Kata Kunci: {generatedArticle.keywords.join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleExpandAllSections}
                      disabled={isExpandingAll || Boolean(expandingSection)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isExpandingAll ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Mengembangkan ({expandingSection})...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Kembangkan Semua Bagian
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenInEditor(generatedArticle.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Buka di Editor Naskah
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Outline Sections */}
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
                {generatedArticle.outline.map((sec) => {
                  const isGenerated = isSectionGenerated(sec.sectionKey);
                  const canExpand = sec.sectionKey !== 'title';
                  const isExpandingThis = expandingSection === sec.sectionKey;

                  return (
                    <div key={sec.sectionKey} className="p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-900 text-sm">
                              {sec.heading}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">~{sec.targetWords} kata</span>
                            {isGenerated && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Tersedia
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{sec.guidance}</p>
                          <ul className="mt-2.5 space-y-1 text-xs text-slate-700 list-disc pl-4">
                            {sec.plannedPoints.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        </div>

                        {canExpand && (
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleExpandSection(
                                  sec.sectionKey as 'abstract' | NarrativeSectionKey
                                )
                              }
                              disabled={isExpandingThis || isExpandingAll}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {isExpandingThis ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                  Menulis...
                                </>
                              ) : isGenerated ? (
                                <>
                                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                                  Buat Ulang Bagian
                                </>
                              ) : (
                                <>
                                  <Wand2 className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                                  Kembangkan Bagian
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Verified References Preview */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Referensi Terkait dari API Akademik ({matchedRefs.length})
                </h3>
                {matchedRefs.length === 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-amber-700">
                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Belum ditemukan kecocokan otomatis untuk topik spesifik ini. Anda dapat menambah atau mengimpor DOI di menu Referensi.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-slate-100">
                    {matchedRefs.map((r) => (
                      <div key={r.id} className="py-2.5 text-xs">
                        <p className="font-medium text-slate-900">{r.title}</p>
                        <p className="mt-0.5 text-slate-500">
                          {r.authors.slice(0, 3).join(', ')}
                          {r.authors.length > 3 ? ' et al.' : ''} ·{' '}
                          <span className="font-mono-tabular">{r.year}</span> · {r.journal}
                          {r.doi ? ` · DOI: ${r.doi}` : ''} ·{' '}
                          <span className="font-medium text-emerald-700">
                            Terverifikasi ({r.source})
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
