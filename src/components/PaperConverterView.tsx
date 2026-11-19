import React, { useState } from 'react';
import { ArrowRight, FileText, FileUp, Loader2, Upload } from 'lucide-react';
import { JOURNAL_TEMPLATES } from '../data/templates';
import type {
  ActivityLog,
  ArticleDocument,
  ArticleLanguage,
  CitationStyle,
  JournalTemplateId,
  ReferenceItem,
} from '../types/journal';

interface PaperConverterViewProps {
  onConverted: (
    article: ArticleDocument,
    references: ReferenceItem[],
    activities: ActivityLog[]
  ) => void;
  onOpenInEditor: (articleId: string) => void;
}

export const PaperConverterView: React.FC<PaperConverterViewProps> = ({
  onConverted,
  onOpenInEditor,
}) => {
  const [rawText, setRawText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [docxBase64, setDocxBase64] = useState<string>('');
  const [journalTemplate, setJournalTemplate] = useState<JournalTemplateId>('imrad-sinta');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA 7');
  const [language, setLanguage] = useState<ArticleLanguage>('Bilingual (Abstrak ID+EN)');

  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedArticle, setConvertedArticle] = useState<ArticleDocument | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSelectedFileName(file.name);

    const lower = file.name.toLowerCase();
    if (lower.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        setDocxBase64(base64);
        setRawText('');
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setRawText(String(reader.result || ''));
        setDocxBase64('');
      };
      reader.readAsText(file);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docxBase64 && rawText.trim().length < 100) {
      setError('Unggah file .docx/.txt/.md atau tempel teks makalah minimal 100 karakter.');
      return;
    }

    setIsConverting(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/convert-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: docxBase64 ? undefined : rawText,
          docxBase64: docxBase64 || undefined,
          fileName: selectedFileName || undefined,
          journalTemplate,
          citationStyle,
          language,
        }),
      });
      const data = (await res.json()) as {
        article?: ArticleDocument;
        references?: ReferenceItem[];
        activities?: ActivityLog[];
        error?: string;
      };
      if (!res.ok || !data.article) {
        throw new Error(data.error || 'Gagal mengonversi makalah.');
      }
      setConvertedArticle(data.article);
      onConverted(data.article, data.references ?? [], data.activities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat konversi makalah.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
          Konversi Makalah ke Artikel Jurnal
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
          Ubah dokumen makalah, laporan penelitian, atau bab skripsi/tesis (.docx, .txt, .md, atau teks langsung) menjadi naskah artikel jurnal berstruktur A–I sesuai template tujuan tanpa mengubah data asli Anda.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <form onSubmit={handleConvert} className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-2">
                Unggah Dokumen Makalah (.docx, .txt, .md)
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-blue-700 hover:bg-blue-50/30">
                <Upload className="h-7 w-7 text-slate-400" aria-hidden="true" />
                <span className="mt-2 text-xs font-semibold text-slate-800">
                  {selectedFileName
                    ? `File dipilih: ${selectedFileName}`
                    : 'Klik untuk memilih file .docx, .txt, atau .md'}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Maksimal 15 MB · Ekstraksi teks dilakukan langsung di server
                </span>
                <input
                  type="file"
                  accept=".docx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label htmlFor="conv-text" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Atau Tempel Teks Makalah / Laporan Penelitian
              </label>
              <textarea
                id="conv-text"
                rows={10}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (e.target.value) setDocxBase64('');
                }}
                placeholder="Tempel seluruh isi makalah atau laporan penelitian Anda di sini..."
                className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="conv-template" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Template Jurnal Tujuan
                </label>
                <select
                  id="conv-template"
                  value={journalTemplate}
                  onChange={(e) => {
                    const id = e.target.value as JournalTemplateId;
                    setJournalTemplate(id);
                    setCitationStyle(JOURNAL_TEMPLATES[id].defaultCitationStyle);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  {Object.values(JOURNAL_TEMPLATES).map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="conv-citation" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Gaya Sitasi
                </label>
                <select
                  id="conv-citation"
                  value={citationStyle}
                  onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="APA 7">APA 7</option>
                  <option value="IEEE">IEEE</option>
                  <option value="Chicago">Chicago</option>
                  <option value="Harvard">Harvard</option>
                </select>
              </div>

              <div>
                <label htmlFor="conv-lang" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Bahasa Output
                </label>
                <select
                  id="conv-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as ArticleLanguage)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="Bilingual (Abstrak ID+EN)">Indonesia (Abstrak ID+EN)</option>
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isConverting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Mengonversi & Memverifikasi Referensi...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  Konversi ke Artikel Jurnal
                </>
              )}
            </button>
          </div>
        </form>

        <section className="lg:col-span-5">
          {!convertedArticle ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 space-y-4">
              <FileText className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold text-slate-900">
                Apa yang Dilakukan Mesin Konversi?
              </h2>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed list-disc pl-4">
                <li>Menyaring narasi makalah atau skripsi yang berulang menjadi prosa jurnal yang padat, objektif, dan ringkas.</li>
                <li>Menyusun ulang struktur menjadi Judul, Abstrak Indonesia & Inggris, Kata Kunci, Pendahuluan, Tinjauan Pustaka, Metode, Hasil & Pembahasan, dan Kesimpulan.</li>
                <li>Mengekstrak daftar rujukan dari dokumen asli dan memverifikasinya secara otomatis melalui Crossref/OpenAlex (rujukan yang tidak cocok ditandai Belum Terverifikasi).</li>
                <li>Menghasilkan naskah yang langsung dapat disunting per bagian dan diekspor ke Word (.docx) atau PDF.</li>
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <p className="text-xs font-semibold text-emerald-700">Konversi Berhasil Disimpan</p>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                {convertedArticle.title}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {convertedArticle.abstractId.slice(0, 280)}...
              </p>
              <div className="text-xs text-slate-500">
                <span>{convertedArticle.fieldOfStudy}</span>
                <span aria-hidden="true"> · </span>
                <span>{convertedArticle.researchType}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono-tabular">
                  {convertedArticle.referenceIds.length} referensi diekstrak
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenInEditor(convertedArticle.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Lanjutkan Penyuntingan di Editor Naskah
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
