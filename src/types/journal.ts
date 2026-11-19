export type ResearchType = 'Kualitatif' | 'Kuantitatif' | 'Mixed Methods' | 'Studi Pustaka';

export type CitationStyle = 'APA 7' | 'IEEE' | 'Chicago' | 'Harvard';

export type ArticleLanguage = 'Bahasa Indonesia' | 'English' | 'Bilingual (Abstrak ID+EN)';

export type ArticleLength =
  | 'Ringkas (~2.500 kata)'
  | 'Standar (~4.500 kata)'
  | 'Komprehensif (~7.000 kata)';

export type JournalTemplateId =
  | 'imrad-sinta'
  | 'ieee-access'
  | 'elsevier-scopus'
  | 'springer-nature'
  | 'apa-manuscript';

export type SectionKey =
  | 'title'
  | 'authors'
  | 'abstract'
  | 'introduction'
  | 'literatureReview'
  | 'methods'
  | 'resultsDiscussion'
  | 'conclusion'
  | 'references';

export type NarrativeSectionKey =
  | 'introduction'
  | 'literatureReview'
  | 'methods'
  | 'resultsDiscussion'
  | 'conclusion';

export interface AuthorInfo {
  id: string;
  name: string;
  affiliation: string;
  email: string;
  orcid?: string;
  isCorresponding?: boolean;
}

export interface ReferenceItem {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  source: 'crossref' | 'openalex' | 'semanticscholar' | 'manual';
  verificationStatus: 'verified' | 'unverified';
  verifiedAt?: string;
  verificationNote?: string;
}

export interface ArticleOutlineSection {
  sectionKey: 'title' | 'abstract' | NarrativeSectionKey;
  heading: string;
  plannedPoints: string[];
  targetWords: number;
  guidance: string;
}

export interface ArticleDocument {
  id: string;
  title: string;
  subtitle?: string;
  topic: string;
  fieldOfStudy: string;
  researchType: ResearchType;
  language: ArticleLanguage;
  targetLength: ArticleLength;
  citationStyle: CitationStyle;
  referenceCountTarget: number;
  referenceYearStart: number;
  referenceYearEnd: number;
  journalTemplate: JournalTemplateId;
  customInstructions?: string;
  status: 'in_progress' | 'completed';
  authors: AuthorInfo[];
  abstractId: string;
  abstractEn: string;
  keywords: string[];
  sections: {
    introduction: string;
    literatureReview: string;
    methods: string;
    resultsDiscussion: string;
    conclusion: string;
  };
  sectionStatuses: Record<SectionKey, 'empty' | 'draft' | 'saved'>;
  outline: ArticleOutlineSection[];
  referenceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  type:
    | 'create'
    | 'outline'
    | 'generate_section'
    | 'edit'
    | 'reference'
    | 'export'
    | 'convert'
    | 'assistant';
  articleId?: string;
  articleTitle?: string;
  description: string;
  timestamp: string;
}

export type WritingAssistantAction =
  | 'paraphrase'
  | 'grammar'
  | 'formalize'
  | 'expand_paragraph'
  | 'summarize_journal'
  | 'research_gap'
  | 'problem_statement'
  | 'research_objectives'
  | 'develop_discussion'
  | 'consistency_check'
  | 'translate';

export interface JournalTemplateConfig {
  id: JournalTemplateId;
  name: string;
  publisher: string;
  defaultCitationStyle: CitationStyle;
  layoutMode: 'single-column' | 'two-column';
  abstractWordLimit: string;
  sectionLabels: {
    introduction: string;
    literatureReview: string;
    methods: string;
    resultsDiscussion: string;
    conclusion: string;
    references: string;
  };
  formattingNotes: string;
}
