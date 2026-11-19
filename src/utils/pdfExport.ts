import { jsPDF } from 'jspdf';
import { JOURNAL_TEMPLATES } from '../data/templates';
import type { ArticleDocument, ReferenceItem } from '../types/journal';
import { formatBibliographyEntry, sortReferencesForStyle } from './citations';

export function exportArticleToPdf(article: ArticleDocument, articleRefs: ReferenceItem[]): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 22;
  const maxWidth = pageWidth - marginX * 2;
  let cursorY = 22;

  const ensurePageSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 20) {
      doc.addPage();
      cursorY = 22;
    }
  };

  const addWrappedText = (
    text: string,
    fontSize: number,
    fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal',
    align: 'left' | 'center' = 'left',
    lineHeight = 5.5,
    extraAfter = 3
  ) => {
    if (!text || !text.trim()) return;
    doc.setFont('times', fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text.trim(), maxWidth) as string[];
    for (const line of lines) {
      ensurePageSpace(lineHeight + 2);
      const xPos = align === 'center' ? pageWidth / 2 : marginX;
      doc.text(line, xPos, cursorY, { align });
      cursorY += lineHeight;
    }
    cursorY += extraAfter;
  };

  const template = JOURNAL_TEMPLATES[article.journalTemplate] ?? JOURNAL_TEMPLATES['imrad-sinta'];
  const sortedRefs = sortReferencesForStyle(articleRefs, article.citationStyle);

  // Header template indicator
  doc.setTextColor(100, 116, 139);
  addWrappedText(`${template.name} · ${article.citationStyle}`, 9, 'italic', 'center', 4.5, 4);

  // Title
  doc.setTextColor(15, 23, 42);
  addWrappedText(article.title || 'Judul Artikel Ilmiah', 15, 'bold', 'center', 6.5, 2);

  if (article.subtitle) {
    addWrappedText(article.subtitle, 11, 'italic', 'center', 5, 3);
  }

  // Authors
  if (article.authors.length > 0) {
    const names = article.authors
      .map((a, idx) => `${a.name}${a.isCorresponding ? '*' : ''} (${idx + 1})`)
      .join(', ');
    addWrappedText(names, 10.5, 'bold', 'center', 5, 1.5);
    article.authors.forEach((a, idx) => {
      const info = [
        `(${idx + 1}) ${a.affiliation}`,
        a.email ? a.email : '',
        a.orcid ? `ORCID: ${a.orcid}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      doc.setTextColor(71, 85, 105);
      addWrappedText(info, 9, 'normal', 'center', 4.2, 1);
    });
    cursorY += 3;
  }

  doc.setTextColor(15, 23, 42);

  // Abstract ID
  if (article.abstractId) {
    addWrappedText('ABSTRAK', 11, 'bold', 'left', 5.5, 1);
    addWrappedText(article.abstractId, 10, 'normal', 'left', 4.8, 3);
  }

  // Abstract EN
  if (article.abstractEn) {
    addWrappedText('ABSTRACT', 11, 'bolditalic', 'left', 5.5, 1);
    addWrappedText(article.abstractEn, 10, 'italic', 'left', 4.8, 3);
  }

  if (article.keywords.length > 0) {
    addWrappedText(`Kata Kunci / Keywords: ${article.keywords.join('; ')}`, 9.5, 'italic', 'left', 4.8, 5);
  }

  // Narrative sections
  const sections: Array<{ heading: string; content: string }> = [
    { heading: template.sectionLabels.introduction, content: article.sections.introduction },
    { heading: template.sectionLabels.literatureReview, content: article.sections.literatureReview },
    { heading: template.sectionLabels.methods, content: article.sections.methods },
    { heading: template.sectionLabels.resultsDiscussion, content: article.sections.resultsDiscussion },
    { heading: template.sectionLabels.conclusion, content: article.sections.conclusion },
  ];

  for (const sec of sections) {
    if (!sec.content || !sec.content.trim()) continue;
    ensurePageSpace(16);
    addWrappedText(sec.heading.toUpperCase(), 11.5, 'bold', 'left', 6, 2);

    const paragraphs = sec.content.split(/\r?\n/).filter((l) => l.trim());
    for (const para of paragraphs) {
      const cleaned = para.trim();
      if (cleaned.startsWith('### ') || cleaned.startsWith('## ')) {
        addWrappedText(cleaned.replace(/^#{2,3}\s+/, ''), 10.5, 'bold', 'left', 5.2, 1.5);
      } else {
        const plain = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
        addWrappedText(plain, 10.5, 'normal', 'left', 5.2, 2.5);
      }
    }
    cursorY += 2;
  }

  // References
  if (sortedRefs.length > 0) {
    ensurePageSpace(18);
    addWrappedText(template.sectionLabels.references.toUpperCase(), 11.5, 'bold', 'left', 6, 2);
    sortedRefs.forEach((ref, idx) => {
      const entry = formatBibliographyEntry(ref, article.citationStyle, idx + 1);
      addWrappedText(entry, 9.5, 'normal', 'left', 4.6, 2);
    });
  }

  const fileName = (article.title || 'artikel-jurnal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  doc.save(`${fileName || 'artikel-jurnal'}.pdf`);
}
