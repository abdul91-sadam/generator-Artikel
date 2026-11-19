import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { ActivityLog, ArticleDocument, CitationStyle, ReferenceItem } from '../types/journal';
import { formatBibliographyEntry, formatInTextCitation } from '../utils/citations';

interface ReferenceManagerViewProps {
  references: ReferenceItem[];
  articles: ArticleDocument[];
  activeArticleId: string | null;
  onReferencesChanged: (refs: ReferenceItem[], activities?: ActivityLog[]) => void;
  onAttachToArticle: (articleId: string, referenceId: string) => void;
  onDetachFromArticle: (articleId: string, referenceId: string) => void;
}

export const ReferenceManagerView: React.FC<ReferenceManagerViewProps> = ({
  references,
  articles,
  activeArticleId,
  onReferencesChanged,
  onAttachToArticle,
  onDetachFromArticle,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'search' | 'doi_manual'>('library');
  const [previewStyle, setPreviewStyle] = useState<CitationStyle>('APA 7');
  const [targetArticleId, setTargetArticleId] = useState<string>(
    activeArticleId || articles[0]?.id || ''
  );

  // Library filters
  const [libraryFilter, setLibraryFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>(
    'all'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Academic API Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState<
    'all' | 'crossref' | 'openalex' | 'semanticscholar'
  >('all');
  const [yearStart, setYearStart] = useState('2019');
  const [yearEnd, setYearEnd] = useState('2026');
  const [searchResults, setSearchResults] = useState<ReferenceItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // DOI Import
  const [doiInput, setDoiInput] = useState('');
  const [isImportingDoi, setIsImportingDoi] = useState(false);
  const [doiError, setDoiError] = useState<string | null>(null);
  const [doiSuccess, setDoiSuccess] = useState<string | null>(null);

  // Manual Entry
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualYear, setManualYear] = useState(String(new Date().getFullYear()));
  const [manualJournal, setManualJournal] = useState('');
  const [manualVolume, setManualVolume] = useState('');
  const [manualIssue, setManualIssue] = useState('');
  const [manualPages, setManualPages] = useState('');
  const [manualDoi, setManualDoi] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === targetArticleId) ?? null,
    [articles, targetArticleId]
  );

  const filteredLibrary = useMemo(() => {
    return references.filter((ref) => {
      if (verificationFilter !== 'all' && ref.verificationStatus !== verificationFilter) {
        return false;
      }
      if (!libraryFilter.trim()) return true;
      const q = libraryFilter.toLowerCase();
      return (
        ref.title.toLowerCase().includes(q) ||
        ref.authors.join(' ').toLowerCase().includes(q) ||
        ref.journal.toLowerCase().includes(q) ||
        (ref.doi || '').toLowerCase().includes(q)
      );
    });
  }, [references, libraryFilter, verificationFilter]);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSearchApis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        source: searchSource,
        limit: '12',
      });
      if (yearStart) params.set('yearStart', yearStart);
      if (yearEnd) params.set('yearEnd', yearEnd);
      const res = await fetch(`/api/references/search?${params.toString()}`);
      const data = (await res.json()) as { results?: ReferenceItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Gagal mencari referensi.');
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Gagal menghubungi API akademik.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveApiResult = async (ref: ReferenceItem) => {
    const res = await fetch('/api/references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: ref,
        articleId: targetArticleId || undefined,
      }),
    });
    const data = (await res.json()) as {
      reference?: ReferenceItem;
      references?: ReferenceItem[];
      activities?: ActivityLog[];
    };
    if (res.ok && data.references) {
      onReferencesChanged(data.references, data.activities);
      if (data.reference && targetArticleId) {
        onAttachToArticle(targetArticleId, data.reference.id);
      }
    }
  };

  const handleImportDoi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doiInput.trim()) return;
    setIsImportingDoi(true);
    setDoiError(null);
    setDoiSuccess(null);
    try {
      const res = await fetch('/api/references/doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doi: doiInput.trim(),
          articleId: targetArticleId || undefined,
        }),
      });
      const data = (await res.json()) as {
        reference?: ReferenceItem;
        activities?: ActivityLog[];
        error?: string;
      };
      if (!res.ok || !data.reference) {
        throw new Error(data.error || 'DOI tidak ditemukan.');
      }
      const nextRefs = references.some((r) => r.id === data.reference!.id)
        ? references
        : [data.reference, ...references];
      onReferencesChanged(nextRefs, data.activities);
      if (targetArticleId) {
        onAttachToArticle(targetArticleId, data.reference.id);
      }
      setDoiSuccess(`DOI terverifikasi dan disimpan: "${data.reference.title}"`);
      setDoiInput('');
    } catch (err) {
      setDoiError(err instanceof Error ? err.message : 'Gagal mengimpor DOI.');
    } finally {
      setIsImportingDoi(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualAuthors.trim()) return;
    setIsSavingManual(true);
    try {
      const authorsArr = manualAuthors
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      const newRef: ReferenceItem = {
        id: `man-${Date.now()}`,
        title: manualTitle.trim(),
        authors: authorsArr.length ? authorsArr : [manualAuthors.trim()],
        year: Number(manualYear) || new Date().getFullYear(),
        journal: manualJournal.trim() || 'Jurnal Akademik',
        volume: manualVolume.trim() || undefined,
        issue: manualIssue.trim() || undefined,
        pages: manualPages.trim() || undefined,
        doi: manualDoi.trim() || undefined,
        url: manualUrl.trim() || undefined,
        source: 'manual',
        verificationStatus: 'unverified',
      };
      const res = await fetch('/api/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: newRef,
          articleId: targetArticleId || undefined,
        }),
      });
      const data = (await res.json()) as {
        reference?: ReferenceItem;
        references?: ReferenceItem[];
        activities?: ActivityLog[];
      };
      if (res.ok && data.references) {
        onReferencesChanged(data.references, data.activities);
        if (data.reference && targetArticleId) {
          onAttachToArticle(targetArticleId, data.reference.id);
        }
        setManualTitle('');
        setManualAuthors('');
        setManualJournal('');
        setManualVolume('');
        setManualIssue('');
        setManualPages('');
        setManualDoi('');
        setManualUrl('');
        setActiveTab('library');
      }
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleVerifyReference = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/references/${id}/verify`, { method: 'POST' });
      const data = (await res.json()) as {
        reference?: ReferenceItem;
        activities?: ActivityLog[];
      };
      if (res.ok && data.reference) {
        const updated = references.map((r) => (r.id === id ? data.reference! : r));
        onReferencesChanged(updated, data.activities);
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteReference = async (id: string) => {
    const res = await fetch(`/api/references/${id}`, { method: 'DELETE' });
    if (res.ok) {
      onReferencesChanged(references.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
            Reference & Citation Manager
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Cari literatur resmi dari Crossref, OpenAlex, dan Semantic Scholar, impor DOI, verifikasi keaslian metadata, serta hasilkan sitasi APA 7, IEEE, Chicago, dan Harvard secara otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {articles.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="ref-target-article" className="text-xs font-medium text-slate-600">
                Artikel Target:
              </label>
              <select
                id="ref-target-article"
                value={targetArticleId}
                onChange={(e) => setTargetArticleId(e.target.value)}
                className="max-w-[240px] truncate rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                <option value="">-- Hanya Pustaka Umum --</option>
                {articles.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['APA 7', 'IEEE', 'Chicago', 'Harvard'] as CitationStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setPreviewStyle(style)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  previewStyle === style
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'library'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Pustaka Tersimpan ({references.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'search'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Cari Jurnal (Crossref · OpenAlex · Semantic Scholar)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('doi_manual')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'doi_manual'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Import DOI & Input Manual
        </button>
      </div>

      {/* Tab 1: Stored Library */}
      {activeTab === 'library' && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
                placeholder="Filter judul, penulis, jurnal, atau DOI..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'verified', label: 'Terverifikasi' },
                  { id: 'unverified', label: 'Belum Terverifikasi' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVerificationFilter(f.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    verificationFilter === f.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredLibrary.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm font-semibold text-slate-900">Pustaka Referensi Kosong</p>
              <p className="mt-1 text-xs text-slate-500">
                Cari jurnal resmi dari tab API Akademik atau impor menggunakan nomor DOI.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {filteredLibrary.map((ref, idx) => {
                const isVerified = ref.verificationStatus === 'verified';
                const inText = formatInTextCitation(ref, previewStyle, idx + 1);
                const bib = formatBibliographyEntry(ref, previewStyle, idx + 1);
                const isAttached = selectedArticle?.referenceIds.includes(ref.id) ?? false;

                return (
                  <div key={ref.id} className="p-5 space-y-2.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Terverifikasi ({ref.source})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              Belum Terverifikasi
                            </span>
                          )}
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-mono-tabular text-slate-500">{ref.year}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-600">{ref.journal}</span>
                          {ref.doi && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="font-mono-tabular text-slate-500">
                                DOI: {ref.doi}
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="mt-1.5 text-sm font-semibold text-slate-900">{ref.title}</h3>
                        <p className="mt-1 text-xs text-slate-600">
                          {ref.authors.join('; ')}
                        </p>
                        {!isVerified && ref.verificationNote && (
                          <p className="mt-1 text-xs text-amber-700">{ref.verificationNote}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!isVerified && (
                          <button
                            type="button"
                            onClick={() => handleVerifyReference(ref.id)}
                            disabled={verifyingId === ref.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {verifyingId === ref.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            Verifikasi
                          </button>
                        )}

                        {selectedArticle && (
                          <button
                            type="button"
                            onClick={() =>
                              isAttached
                                ? onDetachFromArticle(selectedArticle.id, ref.id)
                                : onAttachToArticle(selectedArticle.id, ref.id)
                            }
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                              isAttached
                                ? 'border border-blue-200 bg-blue-50 text-blue-800'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {isAttached ? 'Terkait di Artikel' : 'Kaitkan ke Artikel'}
                          </button>
                        )}

                        {ref.url && (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            Sumber
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteReference(ref.id)}
                          aria-label={`Hapus ${ref.title}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Automatic Citation Preview Box */}
                    <div className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong className="text-slate-900">Sitasi ({previewStyle}):</strong>{' '}
                          <span className="font-mono-tabular">{inText}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${ref.id}-intext`, inText)}
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline cursor-pointer"
                        >
                          {copiedId === `${ref.id}-intext` ? (
                            <>
                              <Check className="h-3 w-3" aria-hidden="true" /> Tersalin
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" aria-hidden="true" /> Salin Sitasi
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-2 border-t border-slate-200/70 pt-1.5">
                        <span className="flex-1 leading-relaxed">
                          <strong className="text-slate-900">Daftar Pustaka:</strong> {bib}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${ref.id}-bib`, bib)}
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline shrink-0 cursor-pointer"
                        >
                          {copiedId === `${ref.id}-bib` ? (
                            <>
                              <Check className="h-3 w-3" aria-hidden="true" /> Tersalin
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" aria-hidden="true" /> Salin Bibliografi
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Academic API Search */}
      {activeTab === 'search' && (
        <div className="mt-6 space-y-6">
          <form
            onSubmit={handleSearchApis}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 lg:flex-row lg:items-end"
          >
            <div className="flex-1">
              <label htmlFor="api-search-q" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Topik, Kata Kunci, atau Judul Jurnal
              </label>
              <input
                id="api-search-q"
                type="text"
                required
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Contoh: adaptive learning artificial intelligence higher education"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div className="w-full lg:w-48">
              <label htmlFor="api-source" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sumber Database
              </label>
              <select
                id="api-source"
                value={searchSource}
                onChange={(e) =>
                  setSearchSource(
                    e.target.value as 'all' | 'crossref' | 'openalex' | 'semanticscholar'
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                <option value="all">Semua API Resmi</option>
                <option value="crossref">Crossref</option>
                <option value="openalex">OpenAlex</option>
                <option value="semanticscholar">Semantic Scholar</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <div className="w-24">
                <label htmlFor="api-ystart" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Dari
                </label>
                <input
                  id="api-ystart"
                  type="number"
                  value={yearStart}
                  onChange={(e) => setYearStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
              <div className="w-24">
                <label htmlFor="api-yend" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sampai
                </label>
                <input
                  id="api-yend"
                  type="number"
                  value={yearEnd}
                  onChange={(e) => setYearEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Mencari...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Cari Literatur
                </>
              )}
            </button>
          </form>

          {searchError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {searchResults.map((item) => {
                const alreadySaved = references.some(
                  (r) =>
                    (item.doi && r.doi && r.doi.toLowerCase() === item.doi.toLowerCase()) ||
                    r.title.toLowerCase() === item.title.toLowerCase()
                );

                return (
                  <div key={item.id} className="p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-emerald-700">
                          Terverifikasi · {item.source}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{item.year}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.journal}</span>
                        {item.doi && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">DOI: {item.doi}</span>
                          </>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-xs text-slate-600">{item.authors.join(', ')}</p>
                      {item.abstract && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {item.abstract}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSaveApiResult(item)}
                        disabled={alreadySaved}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                          alreadySaved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                            : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                        }`}
                      >
                        {alreadySaved ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Tersimpan
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Simpan Referensi
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: DOI Import & Manual Input */}
      {activeTab === 'doi_manual' && (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <form
              onSubmit={handleImportDoi}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Import Otomatis via DOI</h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Masukkan DOI (Digital Object Identifier) untuk menarik metadata lengkap dan memverifikasi keaslian jurnal secara langsung dari Crossref / OpenAlex.
                </p>
              </div>
              <div>
                <label htmlFor="doi-import-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor atau URL DOI
                </label>
                <input
                  id="doi-import-input"
                  type="text"
                  required
                  value={doiInput}
                  onChange={(e) => setDoiInput(e.target.value)}
                  placeholder="Contoh: 10.1016/j.compedu.2023.104812"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              {doiError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {doiError}
                </div>
              )}
              {doiSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  {doiSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isImportingDoi}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                {isImportingDoi ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Memverifikasi DOI...
                  </>
                ) : (
                  'Import & Verifikasi DOI'
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7">
            <form
              onSubmit={handleSaveManual}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Input Referensi Manual</h2>
                <p className="mt-1 text-xs text-amber-700">
                  Catatan integritas: Referensi yang diinput manual akan ditandai sebagai Belum Terverifikasi sampai dicocokkan dengan Crossref/OpenAlex.
                </p>
              </div>

              <div>
                <label htmlFor="man-title" className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Artikel / Buku
                </label>
                <input
                  id="man-title"
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="man-authors" className="block text-xs font-semibold text-slate-700 mb-1">
                    Penulis (pisahkan dengan titik koma `;`)
                  </label>
                  <input
                    id="man-authors"
                    type="text"
                    required
                    value={manualAuthors}
                    onChange={(e) => setManualAuthors(e.target.value)}
                    placeholder="Budi Santoso; Siti Aminah"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="man-year" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun
                  </label>
                  <input
                    id="man-year"
                    type="number"
                    required
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label htmlFor="man-journal" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Jurnal / Penerbit
                  </label>
                  <input
                    id="man-journal"
                    type="text"
                    value={manualJournal}
                    onChange={(e) => setManualJournal(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="man-vol" className="block text-xs font-semibold text-slate-700 mb-1">
                    Volume
                  </label>
                  <input
                    id="man-vol"
                    type="text"
                    value={manualVolume}
                    onChange={(e) => setManualVolume(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="man-issue" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor / Issue
                  </label>
                  <input
                    id="man-issue"
                    type="text"
                    value={manualIssue}
                    onChange={(e) => setManualIssue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="man-pages" className="block text-xs font-semibold text-slate-700 mb-1">
                    Halaman
                  </label>
                  <input
                    id="man-pages"
                    type="text"
                    placeholder="12-28"
                    value={manualPages}
                    onChange={(e) => setManualPages(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="man-doi" className="block text-xs font-semibold text-slate-700 mb-1">
                    DOI (Opsional)
                  </label>
                  <input
                    id="man-doi"
                    type="text"
                    value={manualDoi}
                    onChange={(e) => setManualDoi(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="man-url" className="block text-xs font-semibold text-slate-700 mb-1">
                    URL (Opsional)
                  </label>
                  <input
                    id="man-url"
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingManual}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Simpan ke Pustaka Referensi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
