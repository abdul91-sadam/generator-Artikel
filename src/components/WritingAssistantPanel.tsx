import React, { useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, X } from 'lucide-react';
import type { ArticleDocument, WritingAssistantAction } from '../types/journal';

interface WritingAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  article: ArticleDocument;
  activeSectionLabel: string;
  activeSectionText: string;
  canApplyToActiveSection: boolean;
  onApplyText: (newText: string, mode: 'replace' | 'append') => void;
  onActivityUpdate: (activities: unknown[]) => void;
}

const ASSISTANT_TOOLS: Array<{
  id: WritingAssistantAction;
  label: string;
  placeholder: string;
}> = [
  {
    id: 'paraphrase',
    label: 'Parafrase Akademik',
    placeholder: 'Tempel kalimat atau paragraf yang ingin diparafrase ulang secara ilmiah...',
  },
  {
    id: 'grammar',
    label: 'Perbaikan Tata Bahasa',
    placeholder: 'Tempel teks untuk diperbaiki ejaan (EYD V / Grammar), struktur kalimat, dan kohesi...',
  },
  {
    id: 'formalize',
    label: 'Informal → Akademik',
    placeholder: 'Tempel teks yang masih bersifat informal atau deskriptif umum...',
  },
  {
    id: 'expand_paragraph',
    label: 'Kembangkan Paragraf',
    placeholder: 'Masukkan kalimat topik atau paragraf singkat yang ingin diperluas...',
  },
  {
    id: 'summarize_journal',
    label: 'Ringkas Jurnal',
    placeholder: 'Tempel abstrak atau isi jurnal rujukan untuk diringkas secara terstruktur...',
  },
  {
    id: 'research_gap',
    label: 'Analisis Research Gap',
    placeholder: 'Jelaskan topik atau ringkasan literatur terdahulu untuk dianalisis kesenjangannya...',
  },
  {
    id: 'problem_statement',
    label: 'Buat Rumusan Masalah',
    placeholder: 'Tuliskan konteks fenomena atau fokus penelitian untuk disusun rumusan masalahnya...',
  },
  {
    id: 'research_objectives',
    label: 'Buat Tujuan Penelitian',
    placeholder: 'Masukkan rumusan masalah atau variabel utama untuk dirumuskan tujuan penelitian...',
  },
  {
    id: 'develop_discussion',
    label: 'Kembangkan Pembahasan',
    placeholder: 'Masukkan ringkasan temuan penelitian Anda untuk dikembangkan menjadi pembahasan analitis...',
  },
  {
    id: 'consistency_check',
    label: 'Periksa Konsistensi Antarbagian',
    placeholder: 'Opsional: tambahkan catatan fokus audit. Seluruh bagian A–H naskah akan diperiksa otomatis.',
  },
  {
    id: 'translate',
    label: 'Terjemahkan ID ↔ EN',
    placeholder: 'Tempel teks akademik yang ingin diterjemahkan antara Bahasa Indonesia dan Inggris...',
  },
];

export const WritingAssistantPanel: React.FC<WritingAssistantPanelProps> = ({
  isOpen,
  onClose,
  article,
  activeSectionLabel,
  activeSectionText,
  canApplyToActiveSection,
  onApplyText,
  onActivityUpdate,
}) => {
  const [selectedAction, setSelectedAction] = useState<WritingAssistantAction>('paraphrase');
  const [inputText, setInputText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'English' | 'Indonesian'>('English');
  const [resultText, setResultText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentTool = ASSISTANT_TOOLS.find((t) => t.id === selectedAction) ?? ASSISTANT_TOOLS[0];

  const handleLoadActive = () => {
    setInputText(activeSectionText);
    setError(null);
  };

  const handleRun = async () => {
    if (selectedAction !== 'consistency_check' && !inputText.trim()) {
      setError('Masukkan teks atau muat isi bagian aktif terlebih dahulu.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          text: inputText,
          targetLanguage,
          citationStyle: article.citationStyle,
          articleId: article.id,
        }),
      });
      const data = (await res.json()) as {
        result?: string;
        error?: string;
        activities?: unknown[];
      };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menjalankan asisten penulisan.');
      }
      setResultText(data.result || '');
      if (data.activities) {
        onActivityUpdate(data.activities);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!resultText) return;
    await navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside
      aria-label="AI Academic Writing Assistant"
      className="no-print flex h-full w-full flex-col border-l border-slate-200 bg-white lg:w-[420px] shrink-0"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Asisten Penulisan Akademik</h2>
          <p className="text-xs text-slate-500">Bagian aktif: {activeSectionLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup asisten"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <label
            htmlFor="assistant-action"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Pilih Fungsi Penyuntingan & Analisis
          </label>
          <select
            id="assistant-action"
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value as WritingAssistantAction);
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
          >
            {ASSISTANT_TOOLS.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.label}
              </option>
            ))}
          </select>
        </div>

        {selectedAction === 'translate' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Bahasa Tujuan Terjemahan
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetLanguage('English')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  targetLanguage === 'English'
                    ? 'border-blue-700 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Indonesia → Inggris
              </button>
              <button
                type="button"
                onClick={() => setTargetLanguage('Indonesian')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  targetLanguage === 'Indonesian'
                    ? 'border-blue-700 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Inggris → Indonesia
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="assistant-input" className="text-xs font-semibold text-slate-700">
              {selectedAction === 'consistency_check'
                ? 'Catatan Tambahan (Opsional)'
                : 'Teks Masukan'}
            </label>
            {canApplyToActiveSection && activeSectionText.trim().length > 0 && (
              <button
                type="button"
                onClick={handleLoadActive}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                Muat dari Bagian Aktif
              </button>
            )}
          </div>
          <textarea
            id="assistant-input"
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={currentTool.placeholder}
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Memproses Naskah...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Jalankan {currentTool.label}
            </>
          )}
        </button>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {resultText && (
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Hasil Asisten AI</span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Salin
                  </>
                )}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
              {resultText}
            </div>
            {canApplyToActiveSection && selectedAction !== 'consistency_check' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApplyText(resultText, 'replace')}
                  className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  Ganti Isi Bagian
                </button>
                <button
                  type="button"
                  onClick={() => onApplyText(resultText, 'append')}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Tambahkan ke Akhir
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
