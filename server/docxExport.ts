import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { JOURNAL_TEMPLATES } from '../src/data/templates.ts';
import type { ArticleDocument, ReferenceItem } from '../src/types/journal.ts';
import { formatBibliographyEntry, sortReferencesForStyle } from '../src/utils/citations.ts';

function buildParagraphsFromMarkdown(content: string): Paragraph[] {
  const lines = (content || '').split(/\r?\n/);
  const paragraphs: Paragraph[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^###\s+/, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 220, after: 100 },
        })
      );
    } else if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^##\s+/, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 260, after: 120 },
        })
      );
    } else if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^#\s+/, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 260, after: 120 },
        })
      );
    } else {
      // Handle basic **bold** inline segments cleanly
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const runs = parts
        .filter(Boolean)
        .map((part) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return new TextRun({
              text: part.slice(2, -2),
              bold: true,
              font: 'Times New Roman',
              size: 24,
            });
          }
          return new TextRun({
            text: part.replace(/^[-*]\s+/, '• '),
            font: 'Times New Roman',
            size: 24,
          });
        });

      paragraphs.push(
        new Paragraph({
          children: runs,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 360 },
        })
      );
    }
  }

  return paragraphs;
}

export async function generateArticleDocxBuffer(
  article: ArticleDocument,
  articleRefs: ReferenceItem[]
): Promise<Buffer> {
  const template = JOURNAL_TEMPLATES[article.journalTemplate] ?? JOURNAL_TEMPLATES['imrad-sinta'];
  const sortedRefs = sortReferencesForStyle(articleRefs, article.citationStyle);
  const children: Paragraph[] = [];

  // Journal template header note
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${template.name} · Gaya Sitasi: ${article.citationStyle}`,
          italics: true,
          size: 18,
          color: '64748B',
          font: 'Times New Roman',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
    })
  );

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: article.title || 'Judul Artikel Ilmiah',
          bold: true,
          size: 32,
          font: 'Times New Roman',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: article.subtitle ? 100 : 220 },
    })
  );

  if (article.subtitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: article.subtitle,
            italics: true,
            size: 24,
            font: 'Times New Roman',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 },
      })
    );
  }

  // Authors
  if (article.authors.length > 0) {
    const authorNames = article.authors
      .map((a, idx) => `${a.name}${a.isCorresponding ? '*' : ''} (${idx + 1})`)
      .join(', ');
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: authorNames,
            bold: true,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      })
    );

    article.authors.forEach((a, idx) => {
      const details = [
        `(${idx + 1}) ${a.affiliation || '-'}`,
        a.email ? `Email: ${a.email}` : '',
        a.orcid ? `ORCID: ${a.orcid}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: details,
              size: 20,
              color: '334155',
              font: 'Times New Roman',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        })
      );
    });
  }

  // Abstract ID
  if (article.abstractId) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'ABSTRAK',
            bold: true,
            size: 24,
            font: 'Times New Roman',
          }),
        ],
        spacing: { before: 240, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: article.abstractId,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 140, line: 276 },
      })
    );
  }

  // Abstract EN
  if (article.abstractEn) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'ABSTRACT',
            bold: true,
            italics: true,
            size: 24,
            font: 'Times New Roman',
          }),
        ],
        spacing: { before: 160, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: article.abstractEn,
            italics: true,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 140, line: 276 },
      })
    );
  }

  // Keywords
  if (article.keywords.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Kata Kunci / Keywords: ',
            bold: true,
            size: 22,
            font: 'Times New Roman',
          }),
          new TextRun({
            text: article.keywords.join('; '),
            italics: true,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
        spacing: { after: 280 },
      })
    );
  }

  // Narrative sections
  const sectionOrder: Array<{
    heading: string;
    body: string;
  }> = [
    { heading: template.sectionLabels.introduction, body: article.sections.introduction },
    { heading: template.sectionLabels.literatureReview, body: article.sections.literatureReview },
    { heading: template.sectionLabels.methods, body: article.sections.methods },
    { heading: template.sectionLabels.resultsDiscussion, body: article.sections.resultsDiscussion },
    { heading: template.sectionLabels.conclusion, body: article.sections.conclusion },
  ];

  for (const sec of sectionOrder) {
    if (!sec.body || !sec.body.trim()) continue;
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sec.heading.toUpperCase(),
            bold: true,
            size: 26,
            font: 'Times New Roman',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 140 },
      })
    );
    children.push(...buildParagraphsFromMarkdown(sec.body));
  }

  // Bibliography
  if (sortedRefs.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: template.sectionLabels.references.toUpperCase(),
            bold: true,
            size: 26,
            font: 'Times New Roman',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 160 },
      })
    );

    sortedRefs.forEach((ref, idx) => {
      const formatted = formatBibliographyEntry(ref, article.citationStyle, idx + 1);
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: formatted,
              size: 22,
              font: 'Times New Roman',
            }),
          ],
          indent: { left: 480, hanging: 480 },
          spacing: { after: 120, line: 276 },
        })
      );
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
