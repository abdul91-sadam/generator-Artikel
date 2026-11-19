import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  Loader2,
  PanelRightOpen,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
  Wand2,
} from 'lucide-react';
import { ARTICLE_STRUCTURE_META, JOURNAL_TEMPLATES } from '../data/templates';
import type {
  ActivityLog,
  ArticleDocument,
  AuthorInfo,
  CitationStyle,
  JournalTemplateId,
  NarrativeSectionKey,
  ReferenceItem,
  SectionKey,
} from '../types/journal';
import {
  countWords,
  formatBibliographyEntry,
  formatInTextCitation,
  sortReferencesForStyle,
} from '../utils/citations';
import { exportArticleToPdf } from '../utils/pdfExport';
import { JournalPreviewModal } from './JournalPreviewModal';
import { WritingAssistantPanel } from './WritingAssistantPanel';

interface ArticleEditorViewProps {
  articles: ArticleDocument[];
  activeArticle: ArticleDocument | null;
  references: ReferenceItem[];
  onSelectArticle: (articleId: string) => void;
  onSaveArticle: (article: ArticleDocument, activityDesc?: string) => Promise<void>;
  onCreateBlankArticle: () => Promise<void>;
  onOpenGenerator: () => void;
  onOpenReferences: () => void;
  onActivitiesUpdated: (activities: ActivityLog[]) => void;
}

export const ArticleEditorView: React.FC<ArticleEditorViewProps> = ({
  articles,
  activeArticle,
  references,
  onSelectArticle,
  onSaveArticle,
  onCreateBlankArticle,
  onOpenGenerator,
  onOpenReferences,
  onActivitiesUpdated,
}) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('introduction');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isGeneratingSection, setIsGeneratingSection] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [keywordInput, setKeywordInput] = useState('');
  const [citationInsertId, setCitationInsertId] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const articleRefs = useMemo(() => {
    if (!activeArticle) return [];
    const matched = references.filter((r) => activeArticle.referenceIds.includes(r.id));
    return sortReferencesForStyle(matched, activeArticle.citationStyle);
  }, [activeArticle, references]);

  const currentSectionMeta = useMemo(
    () => ARTICLE_STRUCTURE_META.find((s) => s.key === activeSection) ?? ARTICLE_STRUCTURE_META[0],
    [activeSection]
  );

  const currentOutline = useMemo(
    () => activeArticle?.outline?.find((o) => o.sectionKey === activeSection),
    [activeArticle, activeSection]
  );

  if (!activeArticle) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-10 text-center">
          <BookMarked className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-slate-900">
            Belum Ada Naskah Aktif
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Mulai menyusun artikel ilmiah melalui Generator AI, atau buat draf kosong terstruktur A–I secara langsung.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenGenerator}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Buka Generator AI
            </button>
            <button
              type="button"
              onClick={onCreateBlankArticle}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              Buat Draf Kosong
            </button>
          </div>
        </div>
      </div>
    );
  }

  const template =
    JOURNAL_TEMPLATES[activeArticle.journalTemplate] ?? JOURNAL_TEMPLATES['imrad-sinta'];

  const getSectionWordCount = (key: SectionKey): number => {
    switch (key) {
      case 'title':
        return countWords(activeArticle.title);
      case 'authors':
        return activeArticle.authors.length;
      case 'abstract':
        return countWords(activeArticle.abstractId) + countWords(activeArticle.abstractEn);
      case 'references':
        return articleRefs.length;
      default:
        return countWords(activeArticle.sections[key as NarrativeSectionKey]);
    }
  };

  const getSectionStatusLabel = (key: SectionKey): { label: string; color: string } => {
    if (key === 'title') {
      return activeArticle.title.trim()
        ? { label: 'Terisi', color: 'text-emerald-700' }
        : { label: 'Kosong', color: 'text-slate-400' };
    }
    if (key === 'authors') {
      return activeArticle.authors.length > 0
        ? { label: `${activeArticle.authors.length} penulis`, color: 'text-slate-600' }
        : { label: 'Kosong', color: 'text-slate-400' };
    }
    if (key === 'references') {
      return articleRefs.length > 0
        ? { label: `${articleRefs.length} rujukan`, color: 'text-emerald-700' }
        : { label: 'Kosong', color: 'text-slate-400' };
    }
    const status = activeArticle.sectionStatuses[key];
    if (status === 'saved') return { label: 'Tersimpan', color: 'text-emerald-700' };
    if (status === 'draft') return { label: 'Draf', color: 'text-amber-700' };
    const hasContent =
      key === 'abstract'
        ? Boolean(activeArticle.abstractId.trim() || activeArticle.abstractEn.trim())
        : Boolean(activeArticle.sections[key as NarrativeSectionKey]?.trim());
    return hasContent
      ? { label: 'Draf', color: 'text-amber-700' }
      : { label: 'Kosong', color: 'text-slate-400' };
  };

  const handleSaveCurrentSection = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated: ArticleDocument = {
        ...activeArticle,
        sectionStatuses: {
          ...activeArticle.sectionStatuses,
          [activeSection]: 'saved',
        },
      };
      await onSaveArticle(
        updated,
        `Menyimpan bagian ${currentSectionMeta.code}. ${currentSectionMeta.label} pada "${updated.title}"`
      );
      setSaveNotice('Bagian tersimpan');
      setTimeout(() => setSaveNotice(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan bagian.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiGenerateSection = async (isRegenerate = false) => {
    if (activeSection === 'title' || activeSection === 'authors' || activeSection === 'references') {
      return;
    }
    setIsGeneratingSection(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: activeArticle.id,
          sectionKey: activeSection,
          customPrompt: isRegenerate ? regenPrompt.trim() || undefined : undefined,
          article: activeArticle,
          articleRefs,
        }),
      });
      const data = (await res.json()) as {
        article?: ArticleDocument;
        activities?: ActivityLog[];
        error?: string;
      };
      if (!res.ok || !data.article) {
        throw new Error(data.error || 'Gagal mengembangkan bagian dengan AI.');
      }
      await onSaveArticle(data.article);
      if (data.activities) onActivitiesUpdated(data.activities);
      setShowRegenInput(false);
      setRegenPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memanggil AI.');
    } finally {
      setIsGeneratingSection(false);
    }
  };

  const handleUpdateNarrative = (key: NarrativeSectionKey, value: string) => {
    const updated: ArticleDocument = {
      ...activeArticle,
      sections: {
        ...activeArticle.sections,
        [key]: value,
      },
      sectionStatuses: {
        ...activeArticle.sectionStatuses,
        [key]: value.trim() ? 'draft' : 'empty',
      },
    };
    void onSaveArticle(updated);
  };

  const handleInsertCitationAtCursor = () => {
    if (!citationInsertId) return;
    const idx = articleRefs.findIndex((r) => r.id === citationInsertId);
    if (idx < 0) return;
    const ref = articleRefs[idx];
    const token = formatInTextCitation(ref, activeArticle.citationStyle, idx + 1);
    const key = activeSection as NarrativeSectionKey;
    const currentText = activeArticle.sections[key] || '';
    const el = textareaRef.current;

    if (el) {
      const start = el.selectionStart ?? currentText.length;
      const end = el.selectionEnd ?? currentText.length;
      const nextText = `${currentText.slice(0, start)} ${token}${currentText.slice(end)}`.trimStart();
      handleUpdateNarrative(key, nextText);
    } else {
      handleUpdateNarrative(key, `${currentText} ${token}`.trim());
    }
    setCitationInsertId('');
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    setError(null);
    try {
      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: activeArticle.id,
          article: activeArticle,
          articleRefs,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error || 'Gagal mengekspor .docx.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (activeArticle.title || 'artikel-jurnal')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 60);
      a.download = `${safeName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh file Word.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    exportArticleToPdf(activeArticle, articleRefs);
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'export',
        articleId: activeArticle.id,
        articleTitle: activeArticle.title,
        description: `Mengekspor naskah "${activeArticle.title}" ke format PDF`,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { activities?: ActivityLog[] };
      if (data.activities) onActivitiesUpdated(data.activities);
    }
  };

  const handleAddAuthor = () => {
    const newAuthor: AuthorInfo = {
      id: `auth-${Date.now()}`,
      name: '',
      affiliation: '',
      email: '',
      orcid: '',
      isCorresponding: activeArticle.authors.length === 0,
    };
    void onSaveArticle({
      ...activeArticle,
      authors: [...activeArticle.authors, newAuthor],
    });
  };

  const handleUpdateAuthor = (id: string, patch: Partial<AuthorInfo>) => {
    void onSaveArticle({
      ...activeArticle,
      authors: activeArticle.authors.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  };

  const handleRemoveAuthor = (id: string) => {
    void onSaveArticle({
      ...activeArticle,
      authors: activeArticle.authors.filter((a) => a.id !== id),
    });
  };

  const isNarrativeSection =
    activeSection === 'introduction' ||
    activeSection === 'literatureReview' ||
    activeSection === 'methods' ||
    activeSection === 'resultsDiscussion' ||
    activeSection === 'conclusion';

  const activeSectionText = isNarrativeSection
    ? activeArticle.sections[activeSection as NarrativeSectionKey]
    : activeSection === 'abstract'
      ? activeArticle.abstractId
      : activeSection === 'title'
        ? activeArticle.title
        : '';

  return (
    <div className="flex h-[calc(100vh-61px)] flex-col overflow-hidden">
      {/* Editor Workspace Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <select
            aria-label="Pilih naskah aktif"
            value={activeArticle.id}
            onChange={(e) => onSelectArticle(e.target.value)}
            className="max-w-[260px] truncate rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-700 focus:outline-none"
          >
            {articles.map((art) => (
              <option key={art.id} value={art.id}>
                {art.title}
              </option>
            ))}
          </select>

          <select
            aria-label="Template jurnal"
            value={activeArticle.journalTemplate}
            onChange={(e) => {
              const tpl = e.target.value as JournalTemplateId;
              void onSaveArticle(
                {
                  ...activeArticle,
                  journalTemplate: tpl,
                  citationStyle: JOURNAL_TEMPLATES[tpl].defaultCitationStyle,
                },
                `Mengubah template jurnal ke ${JOURNAL_TEMPLATES[tpl].name}`
              );
            }}
            className="max-w-[210px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none"
          >
            {Object.values(JOURNAL_TEMPLATES).map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Gaya sitasi"
            value={activeArticle.citationStyle}
            onChange={(e) =>
              void onSaveArticle(
                { ...activeArticle, citationStyle: e.target.value as CitationStyle },
                `Mengubah gaya sitasi ke ${e.target.value}`
              )
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none"
          >
            <option value="APA 7">APA 7</option>
            <option value="IEEE">IEEE</option>
            <option value="Chicago">Chicago</option>
            <option value="Harvard">Harvard</option>
          </select>

          <button
            type="button"
            onClick={() =>
              void onSaveArticle(
                {
                  ...activeArticle,
                  status: activeArticle.status === 'completed' ? 'in_progress' : 'completed',
                },
                `Mengubah status artikel menjadi ${
                  activeArticle.status === 'completed' ? 'Sedang Dikerjakan' : 'Selesai'
                }`
              )
            }
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              activeArticle.status === 'completed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {activeArticle.status === 'completed' ? 'Status: Selesai' : 'Status: Dikerjakan'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Pratinjau Jurnal
          </button>

          <button
            type="button"
            onClick={handleExportDocx}
            disabled={isExportingDocx}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExportingDocx ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            .DOCX
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            .PDF
          </button>

          <button
            type="button"
            onClick={() => setIsAssistantOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              isAssistantOpen
                ? 'bg-blue-700 text-white'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Asisten AI
          </button>
        </div>
      </div>

      {/* Main 3-Pane Studio */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Rail: A–I Article Structure */}
        <aside
          aria-label="Struktur artikel ilmiah"
          className="no-print w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 hidden md:block"
        >
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Struktur Artikel (A–I)
          </p>
          <div className="space-y-1">
            {ARTICLE_STRUCTURE_META.map((sec) => {
              const isSelected = activeSection === sec.key;
              const statusInfo = getSectionStatusLabel(sec.key);
              const count = getSectionWordCount(sec.key);

              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => {
                    setActiveSection(sec.key);
                    setShowRegenInput(false);
                    setError(null);
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">
                      {sec.code}. {sec.label}
                    </span>
                    <span className={`text-[11px] font-medium shrink-0 ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  {(sec.key === 'abstract' ||
                    sec.key === 'introduction' ||
                    sec.key === 'literatureReview' ||
                    sec.key === 'methods' ||
                    sec.key === 'resultsDiscussion' ||
                    sec.key === 'conclusion') && (
                    <p className="mt-0.5 font-mono-tabular text-[11px] text-slate-400">
                      {count} kata
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Editing Pane */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6 lg:p-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Mobile Section Switcher */}
            <div className="md:hidden">
              <label htmlFor="mobile-sec-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Bagian Naskah
              </label>
              <select
                id="mobile-sec-select"
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value as SectionKey)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
              >
                {ARTICLE_STRUCTURE_META.map((sec) => (
                  <option key={sec.key} value={sec.key}>
                    {sec.code}. {sec.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Header + AI & Save Action Bar */}
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-700">
                  Bagian {currentSectionMeta.code} · {template.name}
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-slate-900">
                  {currentSectionMeta.label}
                </h2>
                <p className="mt-1 text-xs text-slate-600">{currentSectionMeta.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {saveNotice && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {saveNotice}
                  </span>
                )}

                {(activeSection === 'abstract' || isNarrativeSection) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAiGenerateSection(false)}
                      disabled={isGeneratingSection}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isGeneratingSection ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Menulis...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Buat / Kembangkan AI
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowRegenInput((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Buat Ulang
                    </button>
                  </>
                )}

                {activeSection !== 'references' && (
                  <button
                    type="button"
                    onClick={handleSaveCurrentSection}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    Simpan Bagian
                  </button>
                )}
              </div>
            </div>

            {showRegenInput && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2.5">
                <label htmlFor="regen-instr" className="block text-xs font-semibold text-slate-800">
                  Instruksi Revisi untuk Pembuatan Ulang (Opsional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="regen-instr"
                    type="text"
                    value={regenPrompt}
                    onChange={(e) => setRegenPrompt(e.target.value)}
                    placeholder="Contoh: Perdalam analisis research gap dan tambahkan perbandingan dengan studi tahun 2023."
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAiGenerateSection(true)}
                    disabled={isGeneratingSection}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Proses Ulang
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Required Sub-Elements Guidance Strip */}
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-3.5">
              <p className="text-xs font-semibold text-slate-800">Komponen Wajib Bagian Ini:</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {currentSectionMeta.subItems.join(' · ')}
              </p>
              {currentOutline && currentOutline.plannedPoints.length > 0 && (
                <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                  <p className="text-[11px] font-semibold text-blue-700">
                    Poin Kerangka Terencana (~{currentOutline.targetWords} kata):
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-600 space-y-0.5">
                    {currentOutline.plannedPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Section A: Title */}
            {activeSection === 'title' && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div>
                  <label htmlFor="sec-title" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Judul Artikel Utama
                  </label>
                  <textarea
                    id="sec-title"
                    rows={2}
                    value={activeArticle.title}
                    onChange={(e) =>
                      void onSaveArticle({ ...activeArticle, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 font-display text-lg font-semibold text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="sec-subtitle" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Subjudul / Running Title (Opsional)
                  </label>
                  <input
                    id="sec-subtitle"
                    type="text"
                    value={activeArticle.subtitle || ''}
                    onChange={(e) =>
                      void onSaveArticle({ ...activeArticle, subtitle: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Section B: Authors */}
            {activeSection === 'authors' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddAuthor}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Tambah Penulis
                  </button>
                </div>

                {activeArticle.authors.map((author, index) => (
                  <div
                    key={author.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Penulis #{index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(author.isCorresponding)}
                            onChange={(e) =>
                              handleUpdateAuthor(author.id, { isCorresponding: e.target.checked })
                            }
                            className="rounded border-slate-300 text-blue-700"
                          />
                          Penulis Korespondensi
                        </label>
                        {activeArticle.authors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAuthor(author.id)}
                            aria-label="Hapus penulis"
                            className="text-slate-400 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Nama Lengkap & Gelar (sesuai gaya jurnal)
                        </label>
                        <input
                          type="text"
                          value={author.name}
                          onChange={(e) => handleUpdateAuthor(author.id, { name: e.target.value })}
                          placeholder="Contoh: Dr. Andi Wijaya"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Afiliasi Institusi
                        </label>
                        <input
                          type="text"
                          value={author.affiliation}
                          onChange={(e) =>
                            handleUpdateAuthor(author.id, { affiliation: e.target.value })
                          }
                          placeholder="Contoh: Fakultas Teknik, Universitas Indonesia"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={author.email}
                          onChange={(e) => handleUpdateAuthor(author.id, { email: e.target.value })}
                          placeholder="nama@universitas.ac.id"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          ORCID iD (Opsional)
                        </label>
                        <input
                          type="text"
                          value={author.orcid || ''}
                          onChange={(e) => handleUpdateAuthor(author.id, { orcid: e.target.value })}
                          placeholder="0000-0002-1825-0097"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section C: Bilingual Abstracts & Keywords */}
            {activeSection === 'abstract' && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="abs-id" className="text-xs font-semibold text-slate-800">
                      Abstrak Bahasa Indonesia
                    </label>
                    <span className="font-mono-tabular text-xs text-slate-500">
                      {countWords(activeArticle.abstractId)} kata
                    </span>
                  </div>
                  <textarea
                    id="abs-id"
                    rows={6}
                    value={activeArticle.abstractId}
                    onChange={(e) =>
                      void onSaveArticle({
                        ...activeArticle,
                        abstractId: e.target.value,
                        sectionStatuses: { ...activeArticle.sectionStatuses, abstract: 'draft' },
                      })
                    }
                    placeholder="Tuliskan atau kembangkan abstrak bahasa Indonesia (150–250 kata)..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-sm leading-[1.7] text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="abs-en" className="text-xs font-semibold text-slate-800">
                      Abstract (English)
                    </label>
                    <span className="font-mono-tabular text-xs text-slate-500">
                      {countWords(activeArticle.abstractEn)} words
                    </span>
                  </div>
                  <textarea
                    id="abs-en"
                    rows={6}
                    value={activeArticle.abstractEn}
                    onChange={(e) =>
                      void onSaveArticle({
                        ...activeArticle,
                        abstractEn: e.target.value,
                        sectionStatuses: { ...activeArticle.sectionStatuses, abstract: 'draft' },
                      })
                    }
                    placeholder="Write or generate the English abstract (150–250 words)..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-sm italic leading-[1.7] text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                  <label htmlFor="kw-input" className="block text-xs font-semibold text-slate-800">
                    Kata Kunci / Keywords (3–5 istilah)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="kw-input"
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = keywordInput.trim();
                          if (val && activeArticle.keywords.length < 5) {
                            void onSaveArticle({
                              ...activeArticle,
                              keywords: [...activeArticle.keywords, val],
                            });
                            setKeywordInput('');
                          }
                        }
                      }}
                      placeholder="Ketik kata kunci lalu tekan Tambah..."
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = keywordInput.trim();
                        if (val && activeArticle.keywords.length < 5) {
                          void onSaveArticle({
                            ...activeArticle,
                            keywords: [...activeArticle.keywords, val],
                          });
                          setKeywordInput('');
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Tambah
                    </button>
                  </div>
                  {activeArticle.keywords.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-700">
                      {activeArticle.keywords.map((kw, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 border-b border-slate-300 pb-0.5">
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() =>
                              void onSaveArticle({
                                ...activeArticle,
                                keywords: activeArticle.keywords.filter((_, i) => i !== idx),
                              })
                            }
                            aria-label={`Hapus kata kunci ${kw}`}
                            className="text-slate-400 hover:text-red-700 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sections D–H: Narrative Scientific Sections */}
            {isNarrativeSection && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                {/* Inline Citation Insertion Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Quote className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <select
                      aria-label="Pilih referensi untuk disisipkan"
                      value={citationInsertId}
                      onChange={(e) => setCitationInsertId(e.target.value)}
                      className="max-w-[260px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
                    >
                      <option value="">-- Sisipkan Sitasi ({activeArticle.citationStyle}) --</option>
                      {articleRefs.map((ref, idx) => (
                        <option key={ref.id} value={ref.id}>
                          {formatInTextCitation(ref, activeArticle.citationStyle, idx + 1)} —{' '}
                          {ref.title.slice(0, 45)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleInsertCitationAtCursor}
                      disabled={!citationInsertId}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      Sisipkan
                    </button>
                  </div>

                  <span className="font-mono-tabular text-xs text-slate-500">
                    {getSectionWordCount(activeSection)} kata
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={18}
                  value={activeArticle.sections[activeSection as NarrativeSectionKey]}
                  onChange={(e) =>
                    handleUpdateNarrative(activeSection as NarrativeSectionKey, e.target.value)
                  }
                  placeholder={`Tuliskan atau klik "Buat / Kembangkan AI" untuk menyusun bagian ${currentSectionMeta.label}...`}
                  className="w-full rounded-lg border border-slate-200 bg-white p-4 text-[15px] leading-[1.75] text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                />
              </div>
            )}

            {/* Section I: Automatic Bibliography */}
            {activeSection === 'references' && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Daftar Pustaka Otomatis ({activeArticle.citationStyle})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tersinkron langsung dengan Reference Manager ({articleRefs.length} referensi terkait).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenReferences}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Kelola Referensi & DOI
                  </button>
                </div>

                {articleRefs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    Belum ada referensi yang dikaitkan ke naskah ini. Gunakan menu Referensi untuk mencari atau mengimpor DOI.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {articleRefs.map((ref, idx) => (
                      <div key={ref.id} className="py-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          {ref.verificationStatus === 'verified' ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Terverifikasi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              Belum Terverifikasi
                            </span>
                          )}
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-mono-tabular text-slate-500">
                            Sitasi: {formatInTextCitation(ref, activeArticle.citationStyle, idx + 1)}
                          </span>
                        </div>
                        <p className="pl-6 -indent-6 text-xs leading-relaxed text-slate-800">
                          {formatBibliographyEntry(ref, activeArticle.citationStyle, idx + 1)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Slide-Over AI Academic Writing Assistant */}
        <WritingAssistantPanel
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          article={activeArticle}
          activeSectionLabel={`${currentSectionMeta.code}. ${currentSectionMeta.label}`}
          activeSectionText={activeSectionText}
          canApplyToActiveSection={isNarrativeSection || activeSection === 'abstract'}
          onApplyText={(newText, mode) => {
            if (isNarrativeSection) {
              const key = activeSection as NarrativeSectionKey;
              const existing = activeArticle.sections[key] || '';
              const nextVal = mode === 'replace' ? newText : `${existing}\n\n${newText}`.trim();
              handleUpdateNarrative(key, nextVal);
            } else if (activeSection === 'abstract') {
              const existing = activeArticle.abstractId || '';
              const nextVal = mode === 'replace' ? newText : `${existing}\n\n${newText}`.trim();
              void onSaveArticle({ ...activeArticle, abstractId: nextVal });
            }
          }}
          onActivityUpdate={(acts) => onActivitiesUpdated(acts as ActivityLog[])}
        />
      </div>

      {/* Journal Template Preview Modal */}
      <JournalPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        article={activeArticle}
        articleRefs={articleRefs}
        onExportDocx={handleExportDocx}
        onExportPdf={handleExportPdf}
      />
    </div>
  );
};
