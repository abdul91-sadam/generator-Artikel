/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ArticleEditorView } from './components/ArticleEditorView';
import { ArticleGeneratorView } from './components/ArticleGeneratorView';
import { DashboardView } from './components/DashboardView';
import { PaperConverterView } from './components/PaperConverterView';
import { ReferenceManagerView } from './components/ReferenceManagerView';
import { TopNav, type AppView } from './components/TopNav';
import type { ActivityLog, ArticleDocument, ReferenceItem } from './types/journal';

const LOCAL_STORAGE_KEY = 'journal_ai_writer_workspace_v1';

interface CachedWorkspace {
  articles: ArticleDocument[];
  references: ReferenceItem[];
  activities: ActivityLog[];
}

function readLocalWorkspace(): CachedWorkspace | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedWorkspace>;
    return {
      articles: Array.isArray(parsed.articles) ? parsed.articles : [],
      references: Array.isArray(parsed.references) ? parsed.references : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [articles, setArticles] = useState<ArticleDocument[]>([]);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoadingWorkspace) return;
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ articles, references, activities })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [articles, references, activities, isLoadingWorkspace]);

  const loadWorkspace = useCallback(async () => {
    setIsLoadingWorkspace(true);
    setLoadError(null);
    const cached = readLocalWorkspace();
    try {
      const res = await fetch('/api/workspace');
      if (!res.ok) throw new Error('Gagal memuat ruang kerja dari server.');
      const data = (await res.json()) as {
        articles?: ArticleDocument[];
        references?: ReferenceItem[];
        activities?: ActivityLog[];
      };
      const serverArticles = data.articles ?? [];
      const serverRefs = data.references ?? [];
      const serverActs = data.activities ?? [];

      const useCachedFallback =
        serverArticles.length === 0 &&
        serverRefs.length === 0 &&
        cached &&
        (cached.articles.length > 0 || cached.references.length > 0);

      const finalArticles = useCachedFallback ? cached.articles : serverArticles;
      const finalRefs = useCachedFallback ? cached.references : serverRefs;
      const finalActs = useCachedFallback ? cached.activities : serverActs;

      setArticles(finalArticles);
      setReferences(finalRefs);
      setActivities(finalActs);
      if (finalArticles.length > 0) {
        setActiveArticleId((prev) => prev || finalArticles[0].id);
      }
    } catch (err) {
      if (cached && (cached.articles.length > 0 || cached.references.length > 0)) {
        setArticles(cached.articles);
        setReferences(cached.references);
        setActivities(cached.activities);
        if (cached.articles.length > 0) {
          setActiveArticleId((prev) => prev || cached.articles[0].id);
        }
      } else {
        setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
      }
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const activeArticle = useMemo(
    () => articles.find((a) => a.id === activeArticleId) ?? articles[0] ?? null,
    [articles, activeArticleId]
  );

  const persistArticleToServer = useCallback(
    async (article: ArticleDocument, activityDescription?: string) => {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article, activityDescription }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          article?: ArticleDocument;
          activities?: ActivityLog[];
        };
        if (data.activities) setActivities(data.activities);
      }
    },
    []
  );

  const handleSaveArticle = useCallback(
    async (updated: ArticleDocument, activityDesc?: string) => {
      const timestamped: ArticleDocument = {
        ...updated,
        updatedAt: new Date().toISOString(),
      };
      setArticles((prev) => {
        const exists = prev.some((a) => a.id === timestamped.id);
        return exists
          ? prev.map((a) => (a.id === timestamped.id ? timestamped : a))
          : [timestamped, ...prev];
      });

      if (activityDesc) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        await persistArticleToServer(timestamped, activityDesc);
      } else {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void persistArticleToServer(timestamped);
        }, 450);
      }
    },
    [persistArticleToServer]
  );

  const handleCreateBlankArticle = useCallback(async () => {
    const now = new Date().toISOString();
    const blank: ArticleDocument = {
      id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Draf Artikel Ilmiah Baru',
      subtitle: '',
      topic: 'Topik Penelitian Baru',
      fieldOfStudy: 'Umum / Multidisiplin',
      researchType: 'Kualitatif',
      language: 'Bilingual (Abstrak ID+EN)',
      targetLength: 'Standar (~4.500 kata)',
      citationStyle: 'APA 7',
      referenceCountTarget: 10,
      referenceYearStart: 2020,
      referenceYearEnd: 2026,
      journalTemplate: 'imrad-sinta',
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
      abstractId: '',
      abstractEn: '',
      keywords: [],
      sections: {
        introduction: '',
        literatureReview: '',
        methods: '',
        resultsDiscussion: '',
        conclusion: '',
      },
      sectionStatuses: {
        title: 'draft',
        authors: 'draft',
        abstract: 'empty',
        introduction: 'empty',
        literatureReview: 'empty',
        methods: 'empty',
        resultsDiscussion: 'empty',
        conclusion: 'empty',
        references: 'empty',
      },
      outline: [],
      referenceIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blank),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        article: ArticleDocument;
        activities?: ActivityLog[];
      };
      setArticles((prev) => [data.article, ...prev]);
      if (data.activities) setActivities(data.activities);
      setActiveArticleId(data.article.id);
      setActiveView('editor');
    }
  }, []);

  const handleToggleStatus = useCallback(
    async (article: ArticleDocument) => {
      const nextStatus = article.status === 'completed' ? 'in_progress' : 'completed';
      await handleSaveArticle(
        { ...article, status: nextStatus },
        `Mengubah status "${article.title}" menjadi ${
          nextStatus === 'completed' ? 'Selesai' : 'Sedang Dikerjakan'
        }`
      );
    },
    [handleSaveArticle]
  );

  const handleDeleteArticle = useCallback(
    async (articleId: string) => {
      const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = (await res.json()) as { activities?: ActivityLog[] };
        setArticles((prev) => {
          const remaining = prev.filter((a) => a.id !== articleId);
          if (activeArticleId === articleId) {
            setActiveArticleId(remaining[0]?.id ?? null);
          }
          return remaining;
        });
        if (data.activities) setActivities(data.activities);
      }
    },
    [activeArticleId]
  );

  const handleAttachRefToArticle = useCallback(
    (articleId: string, referenceId: string) => {
      const target = articles.find((a) => a.id === articleId);
      if (!target || target.referenceIds.includes(referenceId)) return;
      void handleSaveArticle({
        ...target,
        referenceIds: [...target.referenceIds, referenceId],
        sectionStatuses: { ...target.sectionStatuses, references: 'saved' },
      });
    },
    [articles, handleSaveArticle]
  );

  const handleDetachRefFromArticle = useCallback(
    (articleId: string, referenceId: string) => {
      const target = articles.find((a) => a.id === articleId);
      if (!target) return;
      void handleSaveArticle({
        ...target,
        referenceIds: target.referenceIds.filter((id) => id !== referenceId),
      });
    },
    [articles, handleSaveArticle]
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900">
      <TopNav
        activeView={activeView}
        onNavigate={setActiveView}
        onCreateNew={() => setActiveView('generator')}
      />

      {isLoadingWorkspace ? (
        <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat ruang kerja jurnal...
        </div>
      ) : loadError ? (
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-sm font-semibold text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadWorkspace()}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            Muat Ulang
          </button>
        </div>
      ) : (
        <>
          {activeView === 'dashboard' && (
            <DashboardView
              articles={articles}
              references={references}
              activities={activities}
              onCreateNew={() => setActiveView('generator')}
              onOpenConverter={() => setActiveView('converter')}
              onOpenEditor={(id) => {
                setActiveArticleId(id);
                setActiveView('editor');
              }}
              onToggleStatus={handleToggleStatus}
              onDeleteArticle={handleDeleteArticle}
            />
          )}

          {activeView === 'generator' && (
            <ArticleGeneratorView
              onArticleCreated={(article, refs, acts) => {
                setArticles((prev) => [article, ...prev]);
                setReferences(refs);
                setActivities(acts);
                setActiveArticleId(article.id);
              }}
              onArticleUpdated={(article, acts) => {
                setArticles((prev) => prev.map((a) => (a.id === article.id ? article : a)));
                if (acts.length) setActivities(acts);
              }}
              onOpenInEditor={(id) => {
                setActiveArticleId(id);
                setActiveView('editor');
              }}
            />
          )}

          {activeView === 'editor' && (
            <ArticleEditorView
              articles={articles}
              activeArticle={activeArticle}
              references={references}
              onSelectArticle={(id) => setActiveArticleId(id)}
              onSaveArticle={handleSaveArticle}
              onCreateBlankArticle={handleCreateBlankArticle}
              onOpenGenerator={() => setActiveView('generator')}
              onOpenReferences={() => setActiveView('references')}
              onActivitiesUpdated={setActivities}
            />
          )}

          {activeView === 'references' && (
            <ReferenceManagerView
              references={references}
              articles={articles}
              activeArticleId={activeArticle?.id ?? null}
              onReferencesChanged={(nextRefs, nextActs) => {
                setReferences(nextRefs);
                if (nextActs) setActivities(nextActs);
              }}
              onAttachToArticle={handleAttachRefToArticle}
              onDetachFromArticle={handleDetachRefFromArticle}
            />
          )}

          {activeView === 'converter' && (
            <PaperConverterView
              onConverted={(article, refs, acts) => {
                setArticles((prev) => [article, ...prev]);
                setReferences(refs);
                setActivities(acts);
                setActiveArticleId(article.id);
              }}
              onOpenInEditor={(id) => {
                setActiveArticleId(id);
                setActiveView('editor');
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
