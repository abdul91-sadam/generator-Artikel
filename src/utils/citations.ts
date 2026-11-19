import { CitationStyle, ReferenceItem } from '../types/journal';

function parseAuthorName(raw: string): { last: string; first: string; initials: string } {
  const cleaned = raw.trim();
  if (!cleaned) {
    return { last: 'Anonim', first: '', initials: '' };
  }
  if (cleaned.includes(',')) {
    const [lastPart, ...rest] = cleaned.split(',');
    const firstPart = rest.join(' ').trim();
    const initials = firstPart
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => `${p[0].toUpperCase()}.`)
      .join(' ');
    return { last: lastPart.trim(), first: firstPart, initials };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { last: parts[0], first: '', initials: '' };
  }
  const last = parts[parts.length - 1];
  const firstParts = parts.slice(0, -1);
  const first = firstParts.join(' ');
  const initials = firstParts.map((p) => `${p[0].toUpperCase()}.`).join(' ');
  return { last, first, initials };
}

function formatAuthorsAPA(authors: string[]): string {
  if (!authors.length) return 'Anonim';
  const formatted = authors.map((a) => {
    const { last, initials } = parseAuthorName(a);
    return initials ? `${last}, ${initials}` : last;
  });
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  if (formatted.length <= 20) {
    return `${formatted.slice(0, -1).join(', ')}, & ${formatted[formatted.length - 1]}`;
  }
  return `${formatted.slice(0, 19).join(', ')}, ... ${formatted[formatted.length - 1]}`;
}

function formatAuthorsIEEE(authors: string[]): string {
  if (!authors.length) return 'Anonim';
  const formatted = authors.map((a) => {
    const { last, initials } = parseAuthorName(a);
    return initials ? `${initials} ${last}` : last;
  });
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  if (formatted.length <= 6) {
    return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
  }
  return `${formatted[0]} et al.`;
}

function formatAuthorsChicago(authors: string[]): string {
  if (!authors.length) return 'Anonim';
  const parsed = authors.map(parseAuthorName);
  const firstAuthor = parsed[0].first
    ? `${parsed[0].last}, ${parsed[0].first}`
    : parsed[0].last;
  if (parsed.length === 1) return firstAuthor;
  const others = parsed.slice(1).map((p) => (p.first ? `${p.first} ${p.last}` : p.last));
  if (parsed.length === 2) return `${firstAuthor}, and ${others[0]}`;
  if (parsed.length <= 10) {
    return `${firstAuthor}, ${others.slice(0, -1).join(', ')}, and ${others[others.length - 1]}`;
  }
  return `${firstAuthor}, ${others.slice(0, 6).join(', ')}, et al.`;
}

function formatAuthorsHarvard(authors: string[]): string {
  if (!authors.length) return 'Anonim';
  const formatted = authors.map((a) => {
    const { last, initials } = parseAuthorName(a);
    const compactInitials = initials.replace(/\s+/g, '');
    return compactInitials ? `${last}, ${compactInitials}` : last;
  });
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  if (formatted.length === 3) return `${formatted[0]}, ${formatted[1]} and ${formatted[2]}`;
  return `${formatted[0]} et al.`;
}

export function formatInTextCitation(
  ref: ReferenceItem,
  style: CitationStyle,
  indexNumber?: number
): string {
  if (style === 'IEEE') {
    return `[${indexNumber ?? 1}]`;
  }
  const authors = ref.authors.length ? ref.authors : ['Anonim'];
  const firstLast = parseAuthorName(authors[0]).last;
  const secondLast = authors[1] ? parseAuthorName(authors[1]).last : '';
  const year = ref.year || 'n.d.';

  if (style === 'APA 7') {
    if (authors.length === 1) return `(${firstLast}, ${year})`;
    if (authors.length === 2) return `(${firstLast} & ${secondLast}, ${year})`;
    return `(${firstLast} et al., ${year})`;
  }

  if (style === 'Chicago') {
    if (authors.length === 1) return `(${firstLast} ${year})`;
    if (authors.length === 2) return `(${firstLast} and ${secondLast} ${year})`;
    if (authors.length === 3) {
      const thirdLast = parseAuthorName(authors[2]).last;
      return `(${firstLast}, ${secondLast}, and ${thirdLast} ${year})`;
    }
    return `(${firstLast} et al. ${year})`;
  }

  // Harvard
  if (authors.length === 1) return `(${firstLast}, ${year})`;
  if (authors.length === 2) return `(${firstLast} and ${secondLast}, ${year})`;
  return `(${firstLast} et al., ${year})`;
}

export function formatBibliographyEntry(
  ref: ReferenceItem,
  style: CitationStyle,
  indexNumber?: number
): string {
  const title = (ref.title || 'Untitled').replace(/\.$/, '');
  const journal = ref.journal || '';
  const year = ref.year || 'n.d.';
  const vol = ref.volume ? ref.volume.trim() : '';
  const issue = ref.issue ? ref.issue.trim() : '';
  const pages = ref.pages ? ref.pages.trim() : '';
  const doiPart = ref.doi ? `https://doi.org/${ref.doi.replace(/^https?:\/\/doi\.org\//i, '')}` : '';
  const linkPart = doiPart || ref.url || '';

  if (style === 'IEEE') {
    const authorsStr = formatAuthorsIEEE(ref.authors);
    const parts: string[] = [`[${indexNumber ?? 1}] ${authorsStr}, "${title},"`];
    if (journal) parts.push(journal + ',');
    if (vol) parts.push(`vol. ${vol},`);
    if (issue) parts.push(`no. ${issue},`);
    if (pages) parts.push(`pp. ${pages},`);
    parts.push(`${year}.`);
    if (ref.doi) parts.push(`doi: ${ref.doi.replace(/^https?:\/\/doi\.org\//i, '')}.`);
    else if (ref.url) parts.push(`Available: ${ref.url}`);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (style === 'Chicago') {
    const authorsStr = formatAuthorsChicago(ref.authors).replace(/\.$/, '');
    let volIssue = '';
    if (vol && issue) volIssue = `${vol}, no. ${issue}`;
    else if (vol) volIssue = vol;
    const pagesStr = pages ? `: ${pages}` : '';
    const journalBlock = journal
      ? `${journal}${volIssue ? ` ${volIssue}` : ''} (${year})${pagesStr}.`
      : `(${year}).`;
    return `${authorsStr}. "${title}." ${journalBlock}${linkPart ? ` ${linkPart}.` : ''}`.trim();
  }

  if (style === 'Harvard') {
    const authorsStr = formatAuthorsHarvard(ref.authors);
    let volIssue = '';
    if (vol && issue) volIssue = `${vol}(${issue})`;
    else if (vol) volIssue = vol;
    const pagesStr = pages ? `, pp. ${pages}` : '';
    const journalBlock = journal
      ? `${journal}${volIssue ? `, ${volIssue}` : ''}${pagesStr}.`
      : '';
    const doiStr = ref.doi
      ? ` doi: ${ref.doi.replace(/^https?:\/\/doi\.org\//i, '')}.`
      : ref.url
        ? ` Available at: ${ref.url}.`
        : '';
    return `${authorsStr} (${year}) '${title}', ${journalBlock}${doiStr}`.replace(/\s+/g, ' ').trim();
  }

  // APA 7 default
  const authorsStr = formatAuthorsAPA(ref.authors);
  let volIssue = '';
  if (vol && issue) volIssue = `, ${vol}(${issue})`;
  else if (vol) volIssue = `, ${vol}`;
  const pagesStr = pages ? `, ${pages}` : '';
  const journalBlock = journal ? `${journal}${volIssue}${pagesStr}.` : '';
  return `${authorsStr} (${year}). ${title}. ${journalBlock}${linkPart ? ` ${linkPart}` : ''}`
    .replace(/\s+/g, ' ')
    .trim();
}

export function sortReferencesForStyle(refs: ReferenceItem[], style: CitationStyle): ReferenceItem[] {
  if (style === 'IEEE') {
    return [...refs];
  }
  return [...refs].sort((a, b) => {
    const aName = (a.authors[0] || a.title || '').toLowerCase();
    const bName = (b.authors[0] || b.title || '').toLowerCase();
    if (aName !== bName) return aName.localeCompare(bName);
    return (a.year || 0) - (b.year || 0);
  });
}

export function countWords(text: string): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}
