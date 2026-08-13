/**
 * Knowledge template registry — struktur catatan per domain.
 *
 * Filosofi: "skill bukan cuma template, tapi punya domain knowledge".
 * Template di sini = kerangka catatan yang diisi AI dari hasil crawl,
 * jadi struktur catatannya memang dirancang buat AI baca & pakai.
 * Finance beda sama Legal beda sama Tech — sections-nya beda.
 */

export interface TemplateSection {
  /** Key unik (dipakai di JSON LLM). */
  key: string;
  /** Heading markdown yang dirender. */
  heading: string;
  /** Guidance ke LLM: apa yang harus diisi di section ini. */
  guidance: string;
  required: boolean;
}

export interface KnowledgeTemplate {
  id: string;
  name: string;
  description: string;
  /** Keyword di nama specialist buat auto-detect. Lowercase. */
  match: string[];
  sections: TemplateSection[];
}

export const TEMPLATES: KnowledgeTemplate[] = [
  {
    id: "finance",
    name: "Finance",
    description: "Pajak, akuntansi, regulasi keuangan, perpajakan Indonesia.",
    match: ["finance", "keuangan", "akuntan", "akuntansi", "pajak", "tax", "accounting", "finansial"],
    sections: [
      {
        key: "summary",
        heading: "Ringkasan",
        guidance:
          "2-4 kalimat ringkas: topik apa, kenapa penting, poin paling esensial. Tulis seperti ringkasan eksekutif.",
        required: true,
      },
      {
        key: "regulations",
        heading: "Regulasi & Dasar Hukum",
        guidance:
          "Daftar regulasi yang relevan: nama lengkap (UU/PMK/PP/PER-...), nomor & tahun, dan satu baris isi pokoknya. Contoh: 'UU No. 7/2021 (HPP) — perubahan tarif PPh'. Kalau tidak ada regulasi spesifik, tulis ketentuan umum yang berlaku.",
        required: true,
      },
      {
        key: "rates_formulas",
        heading: "Tarif, Formula & Ketentuan",
        guidance:
          "Angka tarif, rumus perhitungan, batasan (threshold), dan ketentuan teknis. Sertakan angka persis dari sumber. Kalau ada tabel tarif, tulis dalam bentuk poin/bullet.",
        required: true,
      },
      {
        key: "examples",
        heading: "Contoh Kasus / Perhitungan",
        guidance:
          "Minimal 1 contoh perhitungan konkret dengan angka (ilustrasi). Tunjukkan langkah demi langkah cara menghitungnya.",
        required: true,
      },
      {
        key: "obligations",
        heading: "Kewajiban & Batas Waktu",
        guidance:
          "Kewajiban wajib pajak/entitas terkait topik ini: apa yang harus dilakukan, kapan (batas waktu), ke mana (instansi), dan sanksi kalau telat.",
        required: false,
      },
      {
        key: "pitfalls",
        heading: "Kesalahan Umum / Pitfalls",
        guidance:
          "Kesalahan yang sering terjadi (misinterpretasi, salah hitung, telat lapor) dan cara menghindarinya.",
        required: false,
      },
      {
        key: "glossary",
        heading: "Glosarium",
        guidance:
          "5-10 istilah kunci + definisi singkat (1 baris per istilah), format: 'Istilah: definisi'. Fokus istilah yang sering bikin bingung.",
        required: false,
      },
    ],
  },
  {
    id: "legal",
    name: "Legal",
    description: "Hukum, regulasi, kontrak, kepatuhan.",
    match: ["legal", "hukum", "lawyer", "pengacara", "advokat", "kontrak", "compliance"],
    sections: [
      {
        key: "summary",
        heading: "Ringkasan",
        guidance:
          "2-4 kalimat ringkas: topik, dasar hukum utama, dan implikasi praktisnya.",
        required: true,
      },
      {
        key: "legal_basis",
        heading: "Dasar Hukum",
        guidance:
          "Peraturan perundang-undangan yang relevan: nama lengkap, nomor & tahun, pasal yang terkait, dan isi pokok pasal tersebut.",
        required: true,
      },
      {
        key: "parties",
        heading: "Pihak & Kewajiban",
        guidance:
          "Pihak-pihak yang terlibat (subjek hukum), hak & kewajiban masing-masing, dan konsekuensi jika tidak dipenuhi.",
        required: true,
      },
      {
        key: "procedure",
        heading: "Prosedur / Alur",
        guidance:
          "Langkah-langkah prosedural (pendaftaran, pengajuan, pelaporan, penyelesaian sengketa) secara urut.",
        required: false,
      },
      {
        key: "sanctions",
        heading: "Sanksi & Konsekuensi",
        guidance:
          "Sanksi administratif/pidana/perdata atas pelanggaran, besaran denda jika ada, dan contoh kasus penegakan.",
        required: false,
      },
      {
        key: "examples",
        heading: "Contoh Kasus",
        guidance:
          "Contoh penerapan hukum ini di kasus nyata (boleh ilustrasi) dan bagaimana hukum diterapkan.",
        required: false,
      },
      {
        key: "faq",
        heading: "Pertanyaan Umum",
        guidance: "3-5 pertanyaan yang paling sering muncul + jawaban singkat, format: 'Q: ... / A: ...'.",
        required: false,
      },
    ],
  },
  {
    id: "tech",
    name: "Tech / Development",
    description: "Pemrograman, arsitektur, tooling, best practices.",
    match: ["tech", "developer", "engineer", "programmer", "it", "code", "dev", "software", "backend", "frontend", "architect", "infrastructure", "architecture", "arsitektur", "cqrs", "microservice", "database", "infrastruktur", "devops"],
    sections: [
      {
        key: "summary",
        heading: "Ringkasan",
        guidance:
          "2-4 kalimat: teknologi/konsep apa, dipakai buat apa, kenapa relevan.",
        required: true,
      },
      {
        key: "concepts",
        heading: "Konsep & Arsitektur",
        guidance:
          "Konsep inti, cara kerja, terminologi penting, dan (kalau relevan) gambaran arsitektur/komponen.",
        required: true,
      },
      {
        key: "syntax_api",
        heading: "Sintaks / API / Konfigurasi",
        guidance:
          "Sintaks penting, signature API, opsi konfigurasi, dan nilai default. Format kode dalam code block.",
        required: true,
      },
      {
        key: "examples",
        heading: "Contoh Kode",
        guidance:
          "Contoh kode minimal yang bisa langsung dipakai (copy-paste), lengkap dengan penjelasan singkat.",
        required: true,
      },
      {
        key: "pitfalls",
        heading: "Pitfalls / Gotchas",
        guidance:
          "Jebakan umum, error yang sering muncul, limitasi, dan cara mengatasinya.",
        required: false,
      },
      {
        key: "references",
        heading: "Referensi Lanjutan",
        guidance: "Dokumentasi resmi, artikel, atau repo yang bagus buat didalami lebih lanjut.",
        required: false,
      },
    ],
  },
  {
    id: "business",
    name: "Business / Analysis",
    description: "Analisis bisnis, market, strategi, data.",
    match: ["business", "analyst", "bisnis", "startup", "marketing", "strategy", "manajemen"],
    sections: [
      {
        key: "summary",
        heading: "Ringkasan",
        guidance:
          "2-4 kalimat: konteks, insight utama, dan rekomendasi singkat.",
        required: true,
      },
      {
        key: "context",
        heading: "Konteks & Latar Belakang",
        guidance:
          "Latar belakang topik: kondisi saat ini, kenapa penting, tren yang relevan.",
        required: true,
      },
      {
        key: "key_points",
        heading: "Poin-Poin Kunci",
        guidance:
          "Fakta & temuan utama dari sumber, dalam bentuk poin yang padat dan spesifik (sertakan angka jika ada).",
        required: true,
      },
      {
        key: "data",
        heading: "Data & Fakta",
        guidance:
          "Angka, statistik, kuota, atau data pendukung lain yang bisa dikutip. Sebutkan sumbernya.",
        required: false,
      },
      {
        key: "implications",
        heading: "Implikasi / Rekomendasi",
        guidance:
          "Apa artinya buat pengambilan keputusan, plus rekomendasi tindakan yang masuk akal.",
        required: false,
      },
      {
        key: "risks",
        heading: "Risiko & Pertimbangan",
        guidance: "Risiko, asumsi, dan hal yang perlu dipertimbangkan sebelum bertindak.",
        required: false,
      },
    ],
  },
  {
    id: "generic",
    name: "Generic",
    description: "Topik umum — fallback kalau domain tidak terdeteksi.",
    match: [],
    sections: [
      {
        key: "summary",
        heading: "Ringkasan",
        guidance: "2-4 kalimat ringkas: topik dan poin paling penting.",
        required: true,
      },
      {
        key: "key_points",
        heading: "Poin-Poin Utama",
        guidance: "Fakta & poin penting dari sumber, dalam poin yang padat.",
        required: true,
      },
      {
        key: "details",
        heading: "Detail & Penjelasan",
        guidance: "Penjelasan lebih dalam: proses, mekanisme, ketentuan, atau konteks.",
        required: true,
      },
      {
        key: "examples",
        heading: "Contoh",
        guidance: "Contoh konkret atau studi kasus yang memperjelas topik.",
        required: false,
      },
      {
        key: "references",
        heading: "Referensi",
        guidance: "Daftar sumber yang relevan buat didalami.",
        required: false,
      },
    ],
  },
];

/** Auto-detect template dari nama specialist (keyword match). Fallback generic. */
export function detectTemplate(specialistName: string): KnowledgeTemplate {
  const name = specialistName.toLowerCase();
  for (const t of TEMPLATES) {
    if (t.match.some((kw) => name.includes(kw))) return t;
  }
  return TEMPLATES.find((t) => t.id === "generic")!;
}

export function getTemplate(id: string): KnowledgeTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
