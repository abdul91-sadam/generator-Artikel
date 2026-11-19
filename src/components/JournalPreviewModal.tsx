import React from 'react';
import { Download, Printer, X } from 'lucide-react';
import { JOURNAL_TEMPLATES } from '../data/templates';
import type { ArticleDocument, ReferenceItem } from '../types/journal';
import { formatBibliographyEntry, sortReferencesForStyle } from '../utils/citations';

interface JournalPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: ArticleDocument;
  articleRefs: ReferenceItem[];
  onExportDocx: () => void;
  onExportPdf: () => void;
}

export const JournalPreviewModal: React.FC<JournalPreviewModalProps> = ({
  isOpen,
  onClose,
  article,
  articleRefs,
  onExportDocx,
  onExportPdf,
}) => {
  if (!isOpen) return null;

  const template = JOURNAL_TEMPLATES[article.journalTemplate] ?? JOURNAL_TEMPLATES['imrad-sinta'];
  const sortedRefs = sortReferencesForStyle(articleRefs, article.citationStyle);
  const isTwoCol = template.layoutMode === 'two-column';

  const renderBodyParagraphs = (text: string) => {
    const lines = (text || '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) {
      return <p className="text-xs italic text-slate-400">(Bagian ini belum diisi)</p>;
    }
    return lines.map((raw, i) => {
      const line = raw.trim();
      if (line.startsWith('### ') || line.startsWith('## ')) {
        return (
          <h4 key={i} className="mt-3 mb-1 text-sm font-bold text-slate-900">
            {line.replace(/^#{2,3}\s+/, '')}
          </h4>
        );
      }
      return (
        <p key={i} className="mb-2.5 text-[13px] leading-[1.65] text-slate-800 text-justify">
          {line.replace(/\*\*([^*]+)\*\*/g, '$1')}
        </p>
      );
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Format Jurnal"
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-xs"
    >
      {/* Modal Header */}
      <div className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Pratinjau Tata Letak: {template.name}
          </h2>
          <p className="text-xs text-slate-500">
            {template.publisher} · Gaya Sitasi {article.citationStyle} ·{' '}
            {isTwoCol ? 'Format Dua Kolom' : 'Format Satu Kolom'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Cetak
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            PDF
          </button>
          <button
            type="button"
            onClick={onExportDocx}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Word (.docx)
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau"
            className="ml-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Printable Manuscript Sheet */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <article className="print-manuscript mx-auto max-w-[840px] rounded-xl border border-slate-200 bg-white px-10 py-12 shadow-sm">
          <p className="text-center text-[11px] uppercase tracking-wider text-slate-500">
            {template.name}
          </p>

          <h1 className="mt-3 text-center font-display text-2xl font-bold leading-snug text-slate-900">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="mt-1 text-center text-sm italic text-slate-600">{article.subtitle}</p>
          )}

          {article.authors.length > 0 && (
            <div className="mt-5 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-900">
                {article.authors
                  .map((a, i) => `${a.name}${a.isCorresponding ? '*' : ''} (${i + 1})`)
                  .join(', ')}
              </p>
              {article.authors.map((a, i) => (
                <p key={a.id} className="text-[11px] text-slate-600">
                  ({i + 1}) {a.affiliation}
                  {a.email ? ` · ${a.email}` : ''}
                  {a.orcid ? ` · ORCID: ${a.orcid}` : ''}
                </p>
              ))}
            </div>
          )}

          {/* Abstracts */}
          <div className="mt-7 border-y border-slate-200 py-5 space-y-4">
            {article.abstractId && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1">
                  Abstrak
                </h2>
                <p className="text-[12.5px] leading-relaxed text-slate-800 text-justify">
                  {article.abstractId}
                </p>
              </div>
            )}
            {article.abstractEn && (
              <div>
                <h2 className="text-xs font-bold italic uppercase tracking-wider text-slate-900 mb-1">
                  Abstract
                </h2>
                <p className="text-[12.5px] italic leading-relaxed text-slate-800 text-justify">
                  {article.abstractEn}
                </p>
              </div>
            )}
            {article.keywords.length > 0 && (
              <p className="text-xs text-slate-700">
                <strong>Kata Kunci / Keywords:</strong>{' '}
                <span className="italic">{article.keywords.join('; ')}</span>
              </p>
            )}
          </div>

          {/* Body Content (Single or Two-Column for IEEE) */}
          <div className={`mt-7 ${isTwoCol ? 'md:columns-2 md:gap-8' : 'space-y-6'}`}>
            <section className="mb-5 break-inside-avoid-column">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                {template.sectionLabels.introduction}
              </h3>
              {renderBodyParagraphs(article.sections.introduction)}
            </section>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                {template.sectionLabels.literatureReview}
              </h3>
              {renderBodyParagraphs(article.sections.literatureReview)}
            </section>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                {template.sectionLabels.methods}
              </h3>
              {renderBodyParagraphs(article.sections.methods)}
            </section>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                {template.sectionLabels.resultsDiscussion}
              </h3>
              {renderBodyParagraphs(article.sections.resultsDiscussion)}
            </section>

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                {template.sectionLabels.conclusion}
              </h3>
              {renderBodyParagraphs(article.sections.conclusion)}
            </section>

            <section className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900">
                {template.sectionLabels.references}
              </h3>
              {sortedRefs.length === 0 ? (
                <p className="text-xs italic text-slate-400">(Belum ada referensi terlampir)</p>
              ) : (
                <div className="space-y-2">
                  {sortedRefs.map((ref, idx) => (
                    <p
                      key={ref.id}
                      className="pl-6 -indent-6 text-[12px] leading-relaxed text-slate-800"
                    >
                      {formatBibliographyEntry(ref, article.citationStyle, idx + 1)}
                    </p>
                  ))}
                </div>
              )}
            </section>
          </div>
        </article>
      </div>
    </div>
  );
};
