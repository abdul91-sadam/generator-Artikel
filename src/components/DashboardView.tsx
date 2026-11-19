import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  FileUp,
  Search,
  Trash2,
} from 'lucide-react';
import { JOURNAL_TEMPLATES } from '../data/templates';
import type { ActivityLog, ArticleDocument, ReferenceItem } from '../types/journal';
import { countWords } from '../utils/citations';

interface DashboardViewProps {
  articles: ArticleDocument[];
  references: ReferenceItem[];
  activities: ActivityLog[];
  onCreateNew: () => void;
  onOpenConverter: () => void;
  onOpenEditor: (articleId: string) => void;
  onToggleStatus: (article: ArticleDocument) => void;
  onDeleteArticle: (articleId: string) => void;
}

function getArticleWordCount(article: ArticleDocument): number {
  return (
    countWords(article.abstractId) +
    countWords(article.abstractEn) +
    countWords(article.sections.introduction) +
    countWords(article.sections.literatureReview) +
    countWords(article.sections.methods) +
    countWords(article.sections.resultsDiscussion) +
    countWords(article.sections.conclusion)
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  articles,
  references,
  activities,
  onCreateNew,
  onOpenConverter,
  onOpenEditor,
  onToggleStatus,
  onDeleteArticle,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    const total = articles.length;
    const inProgress = articles.filter((a) => a.status === 'in_progress').length;
    const completed = articles.filter((a) => a.status === 'completed').length;
    const verifiedRefs = references.filter((r) => r.verificationStatus === 'verified').length;
    return { total, inProgress, completed, verifiedRefs };
  }, [articles, references]);

  const lastEditedArticle = useMemo(() => {
    if (articles.length === 0) return null;
    return [...articles].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return [...articles]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .filter((a) => {
        if (filterStatus !== 'all' && a.status !== filterStatus) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.fieldOfStudy.toLowerCase().includes(q) ||
          a.topic.toLowerCase().includes(q)
        );
      });
  }, [articles, filterStatus, searchQuery]);

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 text-balance">
            Ruang Kerja Penulisan Ilmiah
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Kelola naskah jurnal, susun kerangka berbasis riset, verifikasi referensi akademik, dan ekspor ke format publikasi siap kirim.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenConverter}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            Konversi Makalah
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            Buat Artikel Baru
          </button>
        </div>
      </div>

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200 bg-white rounded-xl border mt-6 overflow-hidden">
        <div className="p-5 border-b lg:border-b-0 border-r border-slate-200">
          <p className="text-xs font-medium text-slate-500">Total Artikel Dibuat</p>
          <p className="mt-2 font-mono-tabular text-3xl font-semibold text-slate-900">
            {stats.total}
          </p>
        </div>
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-200">
          <p className="text-xs font-medium text-slate-500">Sedang Dikerjakan</p>
          <p className="mt-2 font-mono-tabular text-3xl font-semibold text-amber-700">
            {stats.inProgress}
          </p>
        </div>
        <div className="p-5 border-r border-slate-200">
          <p className="text-xs font-medium text-slate-500">Artikel Selesai</p>
          <p className="mt-2 font-mono-tabular text-3xl font-semibold text-emerald-700">
            {stats.completed}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Referensi Terverifikasi</p>
          <p className="mt-2 font-mono-tabular text-3xl font-semibold text-blue-700">
            {stats.verifiedRefs}
          </p>
        </div>
      </div>

      {/* Last Edited Article Focal Banner */}
      {lastEditedArticle && (
        <section
          aria-label="Artikel terakhir yang diedit"
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-blue-700">Artikel Terakhir Diedit</span>
                <span aria-hidden="true">·</span>
                <span>{JOURNAL_TEMPLATES[lastEditedArticle.journalTemplate]?.name}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Diperbarui {formatDateTime(lastEditedArticle.updatedAt)}
                </span>
              </div>
              <h2 className="mt-2 font-display text-xl font-semibold text-slate-900 text-balance">
                {lastEditedArticle.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>{lastEditedArticle.fieldOfStudy}</span>
                <span aria-hidden="true">·</span>
                <span>{lastEditedArticle.researchType}</span>
                <span aria-hidden="true">·</span>
                <span>Sitasi {lastEditedArticle.citationStyle}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {getArticleWordCount(lastEditedArticle).toLocaleString('id-ID')} kata
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {lastEditedArticle.referenceIds.length} referensi
                </span>
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => onOpenEditor(lastEditedArticle.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Lanjutkan Menulis
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Split Workspace: Article Table (Left 2/3) + Activity History (Right 1/3) */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Article Repository */}
        <section className="lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Daftar Naskah Artikel</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari judul atau bidang..."
                  aria-label="Cari artikel"
                  className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'in_progress', label: 'Dikerjakan' },
                    { id: 'completed', label: 'Selesai' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterStatus(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      filterStatus === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {articles.length === 0
                  ? 'Belum Ada Artikel Jurnal'
                  : 'Tidak Ada Naskah yang Cocok'}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                {articles.length === 0
                  ? 'Mulai buat artikel ilmiah baru dengan Generator AI atau konversikan dokumen makalah yang sudah Anda miliki.'
                  : 'Ubah kata kunci pencarian atau filter status untuk melihat naskah Anda.'}
              </p>
              {articles.length === 0 && (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onCreateNew}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Buat Artikel Baru
                  </button>
                  <button
                    type="button"
                    onClick={onOpenConverter}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Konversi Makalah
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {filteredArticles.map((article) => {
                const words = getArticleWordCount(article);
                const isCompleted = article.status === 'completed';
                return (
                  <div
                    key={article.id}
                    className="flex flex-col gap-3 p-5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpenEditor(article.id)}
                        className="text-left font-display text-base font-semibold text-slate-900 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        {article.title}
                      </button>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            isCompleted ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {isCompleted ? 'Selesai' : 'Sedang Dikerjakan'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{article.fieldOfStudy}</span>
                        <span aria-hidden="true">·</span>
                        <span>{article.researchType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {words.toLocaleString('id-ID')} kata
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatDateTime(article.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleStatus(article)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {isCompleted ? 'Tandai Draf' : 'Tandai Selesai'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenEditor(article.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Buka Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteArticle(article.id)}
                        aria-label={`Hapus ${article.title}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Activity History */}
        <aside className="lg:col-span-4">
          <div className="pb-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Riwayat Aktivitas</h2>
          </div>

          {activities.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-xs text-slate-500">
                Aktivitas penulisan, impor referensi, dan ekspor dokumen akan tercatat otomatis di sini.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {activities.slice(0, 14).map((act) => (
                <div key={act.id} className="px-4 py-3">
                  <p className="text-xs font-medium text-slate-800 leading-relaxed">
                    {act.description}
                  </p>
                  <p className="mt-1 font-mono-tabular text-[11px] text-slate-400">
                    {formatDateTime(act.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
