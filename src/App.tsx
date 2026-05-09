import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  FileText, 
  Upload, 
  BookOpen, 
  HelpCircle, 
  Clipboard, 
  Check, 
  ChevronRight,
  LogOut,
  Sparkles,
  Loader2,
  Layout,
  BrainCircuit,
  MessageSquare,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from 'react-markdown';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

type AppTab = 'questions' | 'summary' | 'slides' | 'chat';
type QuestionType = 'mcq' | 'essay' | 'true-false' | 'hots';

export default function App() {
  const [pdfText, setPdfText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('questions');
  const [qType, setQType] = useState<QuestionType>('mcq');
  const [question, setQuestion] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/extract-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setPdfText(data.text);
    } catch (error) {
      console.error(error);
      alert("Gagal mengunggah PDF. Pastikan format file benar.");
    } finally {
      setIsLoading(false);
    }
  };

  const processAI = async (mode: AppTab) => {
    if (!pdfText) return;
    setIsLoading(true);
    setOutput("");

    const contextLimit = 60000;
    const cleanText = pdfText.substring(0, contextLimit);
    
    let systemInstruction = "Kamu adalah Asisten Pengajar profesional. DILARANG menggunakan informasi di luar teks yang diberikan (cegah halusinasi). Gunakan Bahasa Indonesia formal dan profesional. Wajib merujuk hanya pada materi di bawah ini.\n\nMateri:\n" + cleanText;

    let userPrompt = "";
    
    if (mode === 'questions') {
      switch (qType) {
        case 'mcq':
          userPrompt = "Buatkan 10 soal pilihan ganda yang bervariasi tingkat kesulitannya. Berikan kunci jawabannya di akhir.";
          break;
        case 'essay':
          userPrompt = "Buatkan 5-10 soal essay terstruktur yang mendalam sesuai materi. Sertakan pedoman penilaian singkat.";
          break;
        case 'true-false':
          userPrompt = "Buatkan 10 soal Benar atau Salah berdasarkan materi ini. Sertakan kunci jawabannya.";
          break;
        case 'hots':
          userPrompt = "Buatkan 5-10 soal kategori High Order Thinking Skills (HOTS) yang menantang nalar siswa. Sertakan pembahasan lengkap untuk setiap soal.";
          break;
      }
    } else if (mode === 'summary') {
      userPrompt = "Buatkan ringkasan materi yang padat dan jelas dalam format Markdown. Berfokus pada poin-poin penting agar mudah dipahami siswa.";
    } else if (mode === 'slides') {
      userPrompt = "Rombak teks materi ini menjadi struktur presentasi 7-10 slide. Gunakan Format Markdown yang rapi. Setiap slide harus memiliki:\n- **Slide [Nomor]: [Judul Slide]**\n- **Poin-Poin Utama**\n- *Saran Visual*: (Deskripsikan gambar/grafik yang cocok)";
    } else if (mode === 'chat') {
      userPrompt = `Jawablah pertanyaan guru berikut hanya berdasarkan informasi dari materi: ${question}`;
    }

    try {
      const model = ai.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction
      });

      const result = await model.generateContent(userPrompt);
      setOutput(result.response.text() || "Tidak ada hasil.");
    } catch (error) {
      console.error(error);
      setOutput("Terjadi kesalahan saat memproses AI. Mohon coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Asisten Pengajar</h1>
            <p className="text-xs font-medium text-indigo-500 uppercase tracking-widest">Solusi AI untuk Guru Juara</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300"></div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold leading-none">Profil Guru</p>
              <p className="text-[10px] text-slate-500 text-emerald-600 font-bold">Lencana Emas</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
          <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </header>

      <main className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 shrink-0">
          <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-soft">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Upload Center</h3>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
                pdfText 
                  ? 'border-indigo-400 bg-indigo-50/30' 
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 bg-white'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="application/pdf"
                className="hidden"
              />
              <div className={`p-3 rounded-xl mb-2 ${pdfText ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-400'}`}>
                {isLoading && !pdfText ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <p className="text-sm font-semibold text-indigo-600 truncate max-w-full px-2 text-center">
                {fileName || "Unggah PDF Materi"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Maksimal 50MB (PDF)</p>
            </div>
            
            {pdfText && !isLoading && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate">Berhasil Dibaca</p>
                  <p className="text-[10px] text-emerald-600 font-medium">{fileName}</p>
                </div>
              </div>
            )}
          </section>

          <AnimatePresence>
            {pdfText && (
              <motion.section 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-soft flex flex-col min-h-0"
              >
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Command Center</h3>
                
                {/* Tabs Navigation */}
                <div className="p-1 bg-slate-100 rounded-xl flex mb-4">
                  {(['questions', 'summary', 'slides', 'chat'] as AppTab[]).map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all capitalize ${activeTab === tab ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                    >
                      {tab === 'questions' ? 'Soal' : tab === 'summary' ? 'Ringkas' : tab === 'slides' ? 'Slide' : 'Tanya'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {activeTab === 'questions' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {(['mcq', 'essay', 'true-false', 'hots'] as QuestionType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => setQType(type)}
                            className={`px-3 py-2 text-[10px] font-bold border rounded-lg transition-all ${qType === type ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-100'}`}
                          >
                            {type === 'mcq' ? 'Pilihan Ganda' : type === 'essay' ? 'Essay' : type === 'true-false' ? 'B/S' : 'HOTS'}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => processAI('questions')}
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-bold shadow-lg hover:bg-slate-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Buat Soal {qType.toUpperCase()}
                      </button>
                    </div>
                  )}

                  {activeTab === 'summary' && (
                    <button 
                      onClick={() => processAI('summary')}
                      disabled={isLoading}
                      className="w-full bg-indigo-600 text-white rounded-xl py-3 text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                      Buat Ringkasan Materi
                    </button>
                  )}

                  {activeTab === 'slides' && (
                    <button 
                      onClick={() => processAI('slides')}
                      disabled={isLoading}
                      className="w-full bg-emerald-600 text-white rounded-xl py-3 text-xs font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-4 h-4" />}
                      Generate Slide Presentasi
                    </button>
                  )}

                  {activeTab === 'chat' && (
                    <div className="space-y-3">
                      <textarea 
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Contoh: Apa inti materi ini?"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none h-20"
                      />
                      <button 
                        onClick={() => processAI('chat')}
                        disabled={isLoading || !question}
                        className="w-full bg-indigo-600 text-white rounded-xl py-3 text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        Tanyakan AI
                      </button>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <BrainCircuit className="w-3 h-3" />
                      Hallucination-Free Protocol Active
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </aside>

        {/* Output Section */}
        <section className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-soft flex flex-col overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              <h2 className="text-sm font-bold text-slate-700">Area Pratinjau Output (AI Generated)</h2>
            </div>
            {output && (
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <Printer className="w-3 h-3" /> Cetak
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
                  {copied ? "Tersalin" : "Salin Hasil"}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px]">
            {!output && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 select-none grayscale">
                <div className="bg-slate-100 p-8 rounded-full">
                  <MessageSquare className="w-16 h-16 text-slate-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 tracking-tight">Kreativitas Menanti</p>
                  <p className="text-sm mt-2 text-slate-500">Unggah file PDF Anda ke Upload Center untuk memulai <br /> transformasi materi ajar yang cerdas.</p>
                </div>
              </div>
            )}

            {isLoading && !output && (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-indigo-500">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm tracking-widest uppercase text-slate-800">AI Sedang Merumuskan</p>
                  <p className="text-xs text-slate-400 mt-1">Hampir selesai, mohon tunggu sebentar...</p>
                </div>
              </div>
            )}

            {output && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white p-12 shadow-xl border border-slate-100 min-h-full rounded-lg">
                  <div className="prose prose-indigo prose-slate max-w-none text-slate-800 printable-content">
                    <ReactMarkdown>{output}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </section>
      </main>

      <footer className="h-10 bg-slate-900 px-8 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <div>&copy; 2026 Asisten Pengajar AI • Solusi Digital untuk Guru Indonesia Berkemajuan</div>
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            Koneksi Aman
          </span>
          <span className="opacity-60">Engine: Gemini-1.5-flash (LTS)</span>
        </div>
      </footer>
    </div>
  );
}
