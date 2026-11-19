import type { ReferenceItem } from '../src/types/journal.ts';

const USER_AGENT_HEADER = 'JournalAIWriter/1.0 (mailto:research@journalaiwriter.app)';

function stripHtmlTags(text?: string): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function reconstructOpenAlexAbstract(invertedIndex?: Record<string, number[]>): string {
  if (!invertedIndex) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(' ').trim();
}

function normalizeDoi(doi?: string): string {
  if (!doi) return '';
  return doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .toLowerCase();
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT_HEADER,
        Accept: 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function searchCrossref(
  query: string,
  limit = 8,
  yearStart?: number,
  yearEnd?: number
): Promise<ReferenceItem[]> {
  try {
    const filters: string[] = ['type:journal-article'];
    if (yearStart) filters.push(`from-pub-date:${yearStart}-01-01`);
    if (yearEnd) filters.push(`until-pub-date:${yearEnd}-12-31`);
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&filter=${encodeURIComponent(filters.join(','))}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: { items?: Array<Record<string, unknown>> };
    };
    const items = data.message?.items ?? [];
    const now = new Date().toISOString();

    return items
      .map((item, idx): ReferenceItem | null => {
        const titles = item.title as string[] | undefined;
        const title = stripHtmlTags(titles?.[0]);
        if (!title) return null;

        const rawAuthors = (item.author as Array<{ given?: string; family?: string; name?: string }>) ?? [];
        const authors = rawAuthors
          .map((a) => {
            if (a.family && a.given) return `${a.given} ${a.family}`;
            return a.family || a.name || '';
          })
          .filter(Boolean);

        const dateParts =
          ((item.published as { 'date-parts'?: number[][] })?.['date-parts']?.[0]) ||
          ((item['published-print'] as { 'date-parts'?: number[][] })?.['date-parts']?.[0]) ||
          ((item['published-online'] as { 'date-parts'?: number[][] })?.['date-parts']?.[0]) ||
          [];
        const year = dateParts[0] || new Date().getFullYear();

        const containerTitles = item['container-title'] as string[] | undefined;
        const journal = stripHtmlTags(containerTitles?.[0]) || 'Academic Journal';
        const doi = typeof item.DOI === 'string' ? item.DOI : undefined;
        const urlVal = typeof item.URL === 'string' ? item.URL : doi ? `https://doi.org/${doi}` : undefined;

        return {
          id: `cr-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          authors: authors.length ? authors : ['Anonim'],
          year,
          journal,
          volume: typeof item.volume === 'string' ? item.volume : undefined,
          issue: typeof item.issue === 'string' ? item.issue : undefined,
          pages: typeof item.page === 'string' ? item.page : undefined,
          doi,
          url: urlVal,
          abstract: stripHtmlTags(typeof item.abstract === 'string' ? item.abstract : ''),
          source: 'crossref',
          verificationStatus: 'verified',
          verifiedAt: now,
          verificationNote: 'Terverifikasi melalui Crossref API',
        };
      })
      .filter((x): x is ReferenceItem => x !== null);
  } catch {
    return [];
  }
}

export async function searchOpenAlex(
  query: string,
  limit = 8,
  yearStart?: number,
  yearEnd?: number
): Promise<ReferenceItem[]> {
  try {
    const filterParts: string[] = ['type:article'];
    if (yearStart && yearEnd) {
      filterParts.push(`publication_year:${yearStart}-${yearEnd}`);
    } else if (yearStart) {
      filterParts.push(`publication_year:>=${yearStart}`);
    } else if (yearEnd) {
      filterParts.push(`publication_year:<=${yearEnd}`);
    }
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&filter=${encodeURIComponent(filterParts.join(','))}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const items = data.results ?? [];
    const now = new Date().toISOString();

    return items
      .map((item, idx): ReferenceItem | null => {
        const title = stripHtmlTags(typeof item.title === 'string' ? item.title : '');
        if (!title) return null;

        const authorships =
          (item.authorships as Array<{ author?: { display_name?: string } }>) ?? [];
        const authors = authorships
          .map((a) => a.author?.display_name || '')
          .filter(Boolean);

        const year =
          typeof item.publication_year === 'number'
            ? item.publication_year
            : new Date().getFullYear();

        const primaryLoc = item.primary_location as
          | { source?: { display_name?: string } }
          | undefined;
        const journal = primaryLoc?.source?.display_name || 'Academic Journal';

        const biblio = item.biblio as
          | { volume?: string; issue?: string; first_page?: string; last_page?: string }
          | undefined;
        const pages =
          biblio?.first_page && biblio?.last_page
            ? `${biblio.first_page}-${biblio.last_page}`
            : biblio?.first_page || undefined;

        const rawDoi = typeof item.doi === 'string' ? item.doi : undefined;
        const doi = rawDoi ? normalizeDoi(rawDoi) : undefined;
        const urlVal = doi
          ? `https://doi.org/${doi}`
          : typeof item.id === 'string'
            ? item.id
            : undefined;

        const abstract = reconstructOpenAlexAbstract(
          item.abstract_inverted_index as Record<string, number[]> | undefined
        );

        return {
          id: `oa-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          authors: authors.length ? authors : ['Anonim'],
          year,
          journal,
          volume: biblio?.volume || undefined,
          issue: biblio?.issue || undefined,
          pages,
          doi,
          url: urlVal,
          abstract,
          source: 'openalex',
          verificationStatus: 'verified',
          verifiedAt: now,
          verificationNote: 'Terverifikasi melalui OpenAlex API',
        };
      })
      .filter((x): x is ReferenceItem => x !== null);
  } catch {
    return [];
  }
}

export async function searchSemanticScholar(
  query: string,
  limit = 8,
  yearStart?: number,
  yearEnd?: number
): Promise<ReferenceItem[]> {
  try {
    const yearParam =
      yearStart && yearEnd
        ? `&year=${yearStart}-${yearEnd}`
        : yearStart
          ? `&year=${yearStart}-`
          : '';
    const fields = 'title,authors,year,venue,publicationVenue,externalIds,url,abstract';
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}${yearParam}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const items = data.data ?? [];
    const now = new Date().toISOString();

    return items
      .map((item, idx): ReferenceItem | null => {
        const title = stripHtmlTags(typeof item.title === 'string' ? item.title : '');
        if (!title) return null;
        const rawAuthors = (item.authors as Array<{ name?: string }>) ?? [];
        const authors = rawAuthors.map((a) => a.name || '').filter(Boolean);
        const year = typeof item.year === 'number' ? item.year : new Date().getFullYear();
        const pubVenue = item.publicationVenue as { name?: string } | undefined;
        const journal =
          pubVenue?.name ||
          (typeof item.venue === 'string' && item.venue) ||
          'Semantic Scholar Indexed Journal';
        const extIds = item.externalIds as { DOI?: string } | undefined;
        const doi = extIds?.DOI ? normalizeDoi(extIds.DOI) : undefined;
        const urlVal =
          typeof item.url === 'string'
            ? item.url
            : doi
              ? `https://doi.org/${doi}`
              : undefined;

        return {
          id: `s2-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          authors: authors.length ? authors : ['Anonim'],
          year,
          journal,
          doi,
          url: urlVal,
          abstract: typeof item.abstract === 'string' ? item.abstract : '',
          source: 'semanticscholar',
          verificationStatus: 'verified',
          verifiedAt: now,
          verificationNote: 'Terverifikasi melalui Semantic Scholar API',
        };
      })
      .filter((x): x is ReferenceItem => x !== null);
  } catch {
    return [];
  }
}

export async function searchAcademicReferences(
  query: string,
  options?: {
    source?: 'all' | 'crossref' | 'openalex' | 'semanticscholar';
    limit?: number;
    yearStart?: number;
    yearEnd?: number;
  }
): Promise<ReferenceItem[]> {
  const source = options?.source ?? 'all';
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 25);
  const { yearStart, yearEnd } = options ?? {};

  let results: ReferenceItem[] = [];
  if (source === 'crossref') {
    results = await searchCrossref(query, limit, yearStart, yearEnd);
  } else if (source === 'openalex') {
    results = await searchOpenAlex(query, limit, yearStart, yearEnd);
  } else if (source === 'semanticscholar') {
    results = await searchSemanticScholar(query, limit, yearStart, yearEnd);
  } else {
    const perSource = Math.max(4, Math.ceil(limit / 2));
    const [cr, oa, s2] = await Promise.all([
      searchCrossref(query, perSource, yearStart, yearEnd),
      searchOpenAlex(query, perSource, yearStart, yearEnd),
      searchSemanticScholar(query, perSource, yearStart, yearEnd),
    ]);
    results = [...cr, ...oa, ...s2];
  }

  // Deduplicate by DOI or normalized title
  const seen = new Set<string>();
  const deduped: ReferenceItem[] = [];
  for (const ref of results) {
    const doiKey = ref.doi ? `doi:${normalizeDoi(ref.doi)}` : '';
    const titleKey = `title:${ref.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if ((doiKey && seen.has(doiKey)) || seen.has(titleKey)) continue;
    if (doiKey) seen.add(doiKey);
    seen.add(titleKey);
    deduped.push(ref);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export async function lookupDoiMetadata(rawDoi: string): Promise<ReferenceItem | null> {
  const doi = normalizeDoi(rawDoi);
  if (!doi) return null;
  const now = new Date().toISOString();

  // Try Crossref first
  try {
    const res = await fetchWithTimeout(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (res.ok) {
      const data = (await res.json()) as { message?: Record<string, unknown> };
      const item = data.message;
      if (item) {
        const titles = item.title as string[] | undefined;
        const title = stripHtmlTags(titles?.[0]);
        const rawAuthors =
          (item.author as Array<{ given?: string; family?: string; name?: string }>) ?? [];
        const authors = rawAuthors
          .map((a) => (a.family && a.given ? `${a.given} ${a.family}` : a.family || a.name || ''))
          .filter(Boolean);
        const dateParts =
          ((item.published as { 'date-parts'?: number[][] })?.['date-parts']?.[0]) ||
          ((item['published-print'] as { 'date-parts'?: number[][] })?.['date-parts']?.[0]) ||
          [];
        const year = dateParts[0] || new Date().getFullYear();
        const containerTitles = item['container-title'] as string[] | undefined;
        const journal = stripHtmlTags(containerTitles?.[0]) || 'Academic Journal';

        if (title) {
          return {
            id: `doi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title,
            authors: authors.length ? authors : ['Anonim'],
            year,
            journal,
            volume: typeof item.volume === 'string' ? item.volume : undefined,
            issue: typeof item.issue === 'string' ? item.issue : undefined,
            pages: typeof item.page === 'string' ? item.page : undefined,
            doi,
            url: `https://doi.org/${doi}`,
            abstract: stripHtmlTags(typeof item.abstract === 'string' ? item.abstract : ''),
            source: 'crossref',
            verificationStatus: 'verified',
            verifiedAt: now,
            verificationNote: 'DOI terverifikasi melalui Crossref API',
          };
        }
      }
    }
  } catch {
    // Fallback to OpenAlex
  }

  // Fallback: OpenAlex DOI lookup
  try {
    const res = await fetchWithTimeout(
      `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`
    );
    if (res.ok) {
      const item = (await res.json()) as Record<string, unknown>;
      const title = stripHtmlTags(typeof item.title === 'string' ? item.title : '');
      if (title) {
        const authorships =
          (item.authorships as Array<{ author?: { display_name?: string } }>) ?? [];
        const authors = authorships.map((a) => a.author?.display_name || '').filter(Boolean);
        const year =
          typeof item.publication_year === 'number'
            ? item.publication_year
            : new Date().getFullYear();
        const primaryLoc = item.primary_location as
          | { source?: { display_name?: string } }
          | undefined;
        const biblio = item.biblio as
          | { volume?: string; issue?: string; first_page?: string; last_page?: string }
          | undefined;
        const pages =
          biblio?.first_page && biblio?.last_page
            ? `${biblio.first_page}-${biblio.last_page}`
            : biblio?.first_page || undefined;

        return {
          id: `doi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          authors: authors.length ? authors : ['Anonim'],
          year,
          journal: primaryLoc?.source?.display_name || 'Academic Journal',
          volume: biblio?.volume || undefined,
          issue: biblio?.issue || undefined,
          pages,
          doi,
          url: `https://doi.org/${doi}`,
          abstract: reconstructOpenAlexAbstract(
            item.abstract_inverted_index as Record<string, number[]> | undefined
          ),
          source: 'openalex',
          verificationStatus: 'verified',
          verifiedAt: now,
          verificationNote: 'DOI terverifikasi melalui OpenAlex API',
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function verifyExistingReference(ref: ReferenceItem): Promise<ReferenceItem> {
  if (ref.doi) {
    const byDoi = await lookupDoiMetadata(ref.doi);
    if (byDoi) {
      return {
        ...ref,
        title: byDoi.title || ref.title,
        authors: byDoi.authors.length ? byDoi.authors : ref.authors,
        year: byDoi.year || ref.year,
        journal: byDoi.journal || ref.journal,
        volume: byDoi.volume || ref.volume,
        issue: byDoi.issue || ref.issue,
        pages: byDoi.pages || ref.pages,
        doi: byDoi.doi,
        url: byDoi.url || ref.url,
        abstract: byDoi.abstract || ref.abstract,
        source: byDoi.source,
        verificationStatus: 'verified',
        verifiedAt: new Date().toISOString(),
        verificationNote: byDoi.verificationNote,
      };
    }
  }

  if (ref.title) {
    const candidates = await searchAcademicReferences(ref.title, { limit: 5 });
    const normTarget = ref.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = candidates.find((c) => {
      const normCand = c.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        normCand === normTarget ||
        (normTarget.length > 20 && (normCand.includes(normTarget) || normTarget.includes(normCand)))
      );
    });
    if (match) {
      return {
        ...ref,
        title: match.title,
        authors: match.authors.length ? match.authors : ref.authors,
        year: match.year || ref.year,
        journal: match.journal || ref.journal,
        volume: match.volume || ref.volume,
        issue: match.issue || ref.issue,
        pages: match.pages || ref.pages,
        doi: match.doi || ref.doi,
        url: match.url || ref.url,
        abstract: match.abstract || ref.abstract,
        source: match.source,
        verificationStatus: 'verified',
        verifiedAt: new Date().toISOString(),
        verificationNote: `Cocok & terverifikasi via ${match.source}`,
      };
    }
  }

  return {
    ...ref,
    verificationStatus: 'unverified',
    verificationNote:
      'Belum ditemukan kecocokan DOI atau judul resmi di Crossref/OpenAlex/Semantic Scholar. Periksa ulang metadata sebelum publikasi.',
  };
}
