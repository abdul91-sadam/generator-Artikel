import { JournalTemplateConfig, JournalTemplateId, SectionKey } from '../types/journal';

export const JOURNAL_TEMPLATES: Record<JournalTemplateId, JournalTemplateConfig> = {
  'imrad-sinta': {
    id: 'imrad-sinta',
    name: 'SINTA 1–2 / Jurnal Nasional Terakreditasi',
    publisher: 'Standar Arjuna / LIPI-BRIN',
    defaultCitationStyle: 'APA 7',
    layoutMode: 'single-column',
    abstractWordLimit: '150–250 kata (ID & EN)',
    sectionLabels: {
      introduction: 'Pendahuluan',
      literatureReview: 'Tinjauan Pustaka',
      methods: 'Metode Penelitian',
      resultsDiscussion: 'Hasil dan Pembahasan',
      conclusion: 'Kesimpulan',
      references: 'Daftar Pustaka',
    },
    formattingNotes:
      'Struktur IMRAD baku dengan abstrak dwibahasa (Indonesia dan Inggris), kata kunci 3–5 istilah, dan sitasi APA edisi ke-7.',
  },
  'ieee-access': {
    id: 'ieee-access',
    name: 'IEEE Transactions / Conference',
    publisher: 'IEEE Xplore',
    defaultCitationStyle: 'IEEE',
    layoutMode: 'two-column',
    abstractWordLimit: '150–250 words',
    sectionLabels: {
      introduction: 'I. Introduction',
      literatureReview: 'II. Related Work',
      methods: 'III. Methodology',
      resultsDiscussion: 'IV. Results and Discussion',
      conclusion: 'V. Conclusion',
      references: 'References',
    },
    formattingNotes:
      'Format dua kolom ala IEEE dengan penomoran Romawi, sitasi numerik kurung siku [1], dan penekanan pada arsitektur serta evaluasi empiris.',
  },
  'elsevier-scopus': {
    id: 'elsevier-scopus',
    name: 'Elsevier / ScienceDirect (Q1–Q2)',
    publisher: 'Elsevier BV',
    defaultCitationStyle: 'APA 7',
    layoutMode: 'single-column',
    abstractWordLimit: '200–300 words',
    sectionLabels: {
      introduction: '1. Introduction',
      literatureReview: '2. Literature Review & Theoretical Framework',
      methods: '3. Materials and Methods',
      resultsDiscussion: '4. Results and Discussion',
      conclusion: '5. Conclusion',
      references: 'References',
    },
    formattingNotes:
      'Penomoran desimal terstruktur (1, 1.1, 2, ...), abstrak terstruktur, pernyataan kontribusi kebaruan yang eksplisit, dan daftar pustaka komprehensif.',
  },
  'springer-nature': {
    id: 'springer-nature',
    name: 'Springer Nature / LNCS',
    publisher: 'Springer',
    defaultCitationStyle: 'Harvard',
    layoutMode: 'single-column',
    abstractWordLimit: '150–250 words',
    sectionLabels: {
      introduction: '1 Introduction',
      literatureReview: '2 Theoretical Background',
      methods: '3 Research Method',
      resultsDiscussion: '4 Findings and Discussion',
      conclusion: '5 Conclusion and Future Work',
      references: 'References',
    },
    formattingNotes:
      'Tata letak bersih satu kolom dengan penekanan pada kerangka teoretis, validitas metode, dan diskusi implikasi teoretis maupun praktis.',
  },
  'apa-manuscript': {
    id: 'apa-manuscript',
    name: 'APA 7th Edition Journal Manuscript',
    publisher: 'American Psychological Association',
    defaultCitationStyle: 'APA 7',
    layoutMode: 'single-column',
    abstractWordLimit: '150–250 words',
    sectionLabels: {
      introduction: 'Introduction',
      literatureReview: 'Literature Review & Hypotheses',
      methods: 'Method',
      resultsDiscussion: 'Results and Discussion',
      conclusion: 'Conclusion',
      references: 'References',
    },
    formattingNotes:
      'Format naskah APA edisi ke-7 dengan rata kiri pada judul bagian utama, pelaporan statistik sesuai standar APA, dan sitasi author-date.',
  },
};

export interface SectionMetadataItem {
  key: SectionKey;
  code: string;
  label: string;
  description: string;
  subItems: string[];
}

export const ARTICLE_STRUCTURE_META: SectionMetadataItem[] = [
  {
    key: 'title',
    code: 'A',
    label: 'Judul Artikel',
    description: 'Judul spesifik, ringkas (10–18 kata), mencerminkan variabel atau fokus utama dan kebaruan.',
    subItems: ['Judul utama artikel', 'Subjudul / Running title (opsional)'],
  },
  {
    key: 'authors',
    code: 'B',
    label: 'Identitas Penulis',
    description: 'Informasi penulis lengkap untuk korespondensi dan pengindeksan jurnal.',
    subItems: ['Nama penulis', 'Afiliasi institusi', 'Email korespondensi', 'ORCID iD (opsional)'],
  },
  {
    key: 'abstract',
    code: 'C',
    label: 'Abstrak & Kata Kunci',
    description: 'Ringkasan padat tujuan, metode, temuan utama, dan implikasi dalam bahasa Indonesia & Inggris.',
    subItems: ['Abstrak Bahasa Indonesia', 'Abstract Bahasa Inggris', 'Kata kunci (3–5 istilah)'],
  },
  {
    key: 'introduction',
    code: 'D',
    label: 'Pendahuluan',
    description: 'Membangun urgensi ilmiah hingga tujuan penelitian secara deduktif dan argumentatif.',
    subItems: [
      'Latar belakang penelitian',
      'Fenomena dan permasalahan',
      'Research gap',
      'State of the art',
      'Kebaruan penelitian',
      'Rumusan tujuan penelitian',
    ],
  },
  {
    key: 'literatureReview',
    code: 'E',
    label: 'Tinjauan Pustaka',
    description: 'Sintesis teori utama, kajian empiris terdahulu, dan kerangka konseptual penelitian.',
    subItems: [
      'Teori utama',
      'Penelitian terdahulu',
      'Kerangka konseptual',
      'Hipotesis (jika diperlukan)',
    ],
  },
  {
    key: 'methods',
    code: 'F',
    label: 'Metode Penelitian',
    description: 'Prosedur penelitian yang transparan, logis, dan dapat direplikasi oleh peneliti lain.',
    subItems: [
      'Pendekatan penelitian',
      'Jenis penelitian',
      'Lokasi dan waktu',
      'Populasi dan sampel atau informan',
      'Sumber data',
      'Teknik pengumpulan data',
      'Teknik analisis data',
    ],
  },
  {
    key: 'resultsDiscussion',
    code: 'G',
    label: 'Hasil dan Pembahasan',
    description: 'Penyajian temuan empiris diikuti interpretasi analitis dan dialog dengan literatur.',
    subItems: [
      'Penyajian hasil penelitian',
      'Analisis data',
      'Interpretasi temuan',
      'Perbandingan dengan penelitian terdahulu',
      'Implikasi penelitian',
    ],
  },
  {
    key: 'conclusion',
    code: 'H',
    label: 'Kesimpulan',
    description: 'Sintesis jawaban atas tujuan penelitian, keterbatasan studi, dan rekomendasi riset lanjutan.',
    subItems: [
      'Kesimpulan utama',
      'Implikasi teoretis & praktis',
      'Keterbatasan penelitian',
      'Saran penelitian selanjutnya',
    ],
  },
  {
    key: 'references',
    code: 'I',
    label: 'Daftar Pustaka',
    description: 'Daftar referensi terverifikasi yang disusun otomatis sesuai gaya sitasi target.',
    subItems: ['Sinkronisasi otomatis dari Reference Manager', 'Format APA 7 / IEEE / Chicago / Harvard'],
  },
];
