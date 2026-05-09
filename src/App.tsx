import React, { useState, useRef, useMemo } from 'react';
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
  Printer,
  Maximize,
  ChevronLeft,
  X,
  Presentation
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
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedSlides = useMemo(() => {
    if (activeTab !== 'slides' || !output) return [];
    
    // Split by Slide headers: e.g. "Slide 1:", "Slide 1 ", "## Slide 1"
    const blocks = output.split(/(?=Slide \d+[:\s]*|## Slide \d+)/i).filter(b => b.trim().length > 10);
    
    return blocks.map((block) => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let title = lines[0]?.replace(/^(#+|Slide \d+[:\s]*)/i, '').trim() || "Slide";
      const content = lines.slice(1).join('\n');
      return { title, content };
    });
  }, [output, activeTab]);

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error('Unexpected response type:', contentType, text.substring(0, 100));
        throw new Error("Server did not return JSON. Check server logs.");
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setPdfText(data.text);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Gagal mengunggah PDF: ${error.message}`);
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
      userPrompt = "Rombak teks materi ini menjadi struktur presentasi 7-10 slide yang siap dipresentasikan di kelas. Gunakan Format Markdown. \n\nInstruksi Struktur:\nSetiap slide diawali dengan header 'Slide [Nomor]: [Judul Slide]'. \nBerikan poin-poin materi yang ringkas (maksimal 5 poin per slide). \nTambahkan satu baris kecil di bawah slide untuk 'Saran Visual'.\n\nContoh:\nSlide 1: Pengenalan Ekosistem\n- Definisi ekosistem\n- Komponen biotik dan abiotik\n- Hubungan timbal balik\n\nSaran Visual: Gambar hutan hujan tropis dengan berbagai fauna.";
    } else if (mode === 'chat') {
      userPrompt = `Jawablah pertanyaan guru berikut hanya berdasarkan informasi dari materi: ${question}`;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });
      setOutput(response.text || "Tidak ada hasil.");
    } catch (error: any) {
      console.error("AI Error:", error);
      setOutput(`Terjadi kesalahan saat memproses AI: ${error.message || "Mohon coba lagi."}`);
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
    <div className="flex flex-col min-h-screen bg-slate-50 text-retro-purple">
      {/* Header */}
      <header className="h-20 bg-retro-purple border-b border-white/10 px-4 lg:px-8 flex items-center justify-between shrink-0 shadow-2xl z-50 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-fresh-orange rounded-xl flex items-center justify-center shadow-orange-500/20 shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase italic">DapzAI</h1>
            <p className="text-[10px] font-black text-fresh-orange uppercase tracking-[0.3em]">Asisten Pengajar</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-retro-purple bg-white/10"></div>
              <div className="w-8 h-8 rounded-full border-2 border-retro-purple bg-fresh-orange/20"></div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black leading-none text-white">Profil Guru</p>
              <p className="text-[10px] text-fresh-orange font-black uppercase tracking-wider">Lencana Emas</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 hidden md:block"></div>
          <button className="flex items-center gap-2 text-white/40 hover:text-fresh-orange transition-all text-sm font-black uppercase tracking-wider group">
            <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> 
            <span className="hidden sm:inline">KELUAR</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-6 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1 lg:pr-2 shrink-0">
          <section className="bg-white rounded-[2rem] p-6 border-2 border-retro-purple/10 shadow-sm transition-transform hover:scale-[1.01]">
            <h3 className="text-[10px] font-black text-retro-purple/30 uppercase tracking-[0.3em] mb-4">Upload Center</h3>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
                pdfText 
                  ? 'border-fresh-orange bg-fresh-orange/5' 
                  : 'border-retro-purple/10 hover:border-fresh-orange hover:bg-fresh-orange/5 bg-white'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="application/pdf"
                className="hidden"
              />
              <div className={`p-3 rounded-xl mb-2 ${pdfText ? 'bg-fresh-orange text-white' : 'bg-retro-purple/5 text-fresh-orange'}`}>
                {isLoading && !pdfText ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <p className="text-sm font-black text-retro-purple truncate max-w-full px-2 text-center uppercase tracking-tight">
                {fileName || "Unggah PDF Materi"}
              </p>
              <p className="text-[10px] text-retro-purple/40 mt-1 font-black tracking-widest uppercase">Format PDF • Maksimal 50MB</p>
            </div>
            
            {pdfText && !isLoading && (
              <div className="mt-4 p-3 bg-fresh-orange/5 border border-fresh-orange/10 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="bg-fresh-orange/10 text-fresh-orange p-2 rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black text-retro-purple truncate">Berhasil Dibaca</p>
                  <p className="text-[10px] text-fresh-orange font-black uppercase tracking-tight">{fileName}</p>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl p-5 border border-retro-purple/10 shadow-sm flex flex-col min-h-0 relative">
            {!pdfText && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
                <div className="bg-retro-purple text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                  Unggah File Untuk Membuka
                </div>
              </div>
            )}
            <h3 className="text-[10px] font-black text-retro-purple/30 uppercase tracking-[0.2em] mb-4">Command Center</h3>
            
            {/* Tabs Navigation */}
            <div className="p-1 bg-retro-purple/5 rounded-xl flex mb-4">
              {(['questions', 'summary', 'slides', 'chat'] as AppTab[]).map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${activeTab === tab ? 'bg-fresh-orange text-white shadow-lg' : 'text-retro-purple/50 hover:text-retro-purple'}`}
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
                            className={`px-3 py-2 text-[10px] font-black border rounded-lg transition-all uppercase tracking-wider ${qType === type ? 'bg-fresh-orange/10 border-fresh-orange text-fresh-orange' : 'bg-white border-retro-purple/10 text-retro-purple/40 hover:border-fresh-orange/50'}`}
                          >
                            {type === 'mcq' ? 'Pilihan Ganda' : type === 'essay' ? 'Essay' : type === 'true-false' ? 'B/S' : 'HOTS'}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => processAI('questions')}
                        disabled={isLoading}
                        className="w-full bg-fresh-orange text-white rounded-xl py-3 text-xs font-bold shadow-lg hover:shadow-orange-200 hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
                      className="w-full bg-fresh-orange text-white rounded-xl py-3 text-xs font-bold shadow-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                      Buat Ringkasan Materi
                    </button>
                  )}

                  {activeTab === 'slides' && (
                    <button 
                      onClick={() => processAI('slides')}
                      disabled={isLoading}
                      className="w-full bg-fresh-orange text-white rounded-xl py-3 text-xs font-bold shadow-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
                        className="w-full bg-white border border-retro-purple/10 rounded-xl p-3 text-xs focus:ring-2 focus:ring-fresh-orange/20 focus:border-fresh-orange outline-none transition-all resize-none h-20"
                      />
                      <button 
                        onClick={() => processAI('chat')}
                        disabled={isLoading || !question}
                        className="w-full bg-fresh-orange text-white rounded-xl py-3 text-xs font-bold shadow-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        Tanyakan AI
                      </button>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-retro-purple/5">
                    <div className="flex items-center gap-2 text-[10px] text-retro-purple/40 font-black uppercase tracking-[0.1em]">
                      <BrainCircuit className="w-3 h-3 text-fresh-orange" />
                      Protocol Hallucination-Free Aktif
                    </div>
                  </div>
                </div>
              </section>
        </aside>

        {/* Output Section */}
        <section className="flex-1 bg-white rounded-[2rem] lg:rounded-[3rem] border-2 border-retro-purple/5 shadow-2xl flex flex-col overflow-hidden relative group">
          <div className="px-6 lg:px-8 py-4 lg:py-6 border-b border-retro-purple/5 flex items-center justify-between bg-retro-purple shrink-0">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className={`w-2.5 h-2.5 lg:w-3 h-3 rounded-full ${isLoading ? 'bg-fresh-orange animate-pulse shadow-[0_0_12px_#FF4500]' : 'bg-fresh-orange'}`}></div>
              <h2 className="text-[10px] lg:text-xs font-black text-white/40 uppercase tracking-[0.25em]">
                {activeTab === 'slides' ? 'MODUL PERSENTASI' : 'HASIL ANALISIS AI'}
              </h2>
            </div>
            {output && (
              <div className="flex gap-1.5 lg:gap-2">
                {activeTab === 'slides' && parsedSlides.length > 0 && (
                  <button 
                    onClick={() => setIsPresenting(true)}
                    className="p-2 lg:px-4 lg:py-2 text-[10px] lg:text-xs font-black text-white bg-fresh-orange rounded-lg lg:rounded-xl hover:opacity-90 transition shadow-lg flex items-center gap-2 whitespace-nowrap"
                  >
                    <Presentation className="w-4 h-4" /> 
                    <span className="sm:inline">Presentasi</span>
                  </button>
                )}
                <button 
                  onClick={() => window.print()}
                  className="p-2 lg:px-4 lg:py-2 text-[10px] lg:text-xs font-black text-retro-purple border border-retro-purple/10 bg-white rounded-lg lg:rounded-xl hover:bg-retro-purple/5 transition flex items-center gap-2 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" /> 
                  <span className="sm:inline">Cetak</span>
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="p-2 lg:px-4 lg:py-2 text-[10px] lg:text-xs font-black text-white bg-retro-purple rounded-lg lg:rounded-xl hover:opacity-90 transition shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                  <span className="sm:inline">{copied ? "Tersalin" : "Salin"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-6 lg:p-10 overflow-y-auto custom-scrollbar bg-[radial-gradient(#1A003308_1px,transparent_1px)] [background-size:24px_24px]">
            {!output && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 select-none grayscale">
                <div className="bg-retro-purple/5 p-6 lg:p-8 rounded-full border border-retro-purple/10">
                  <MessageSquare className="w-12 h-12 lg:w-16 h-16 text-retro-purple/40" />
                </div>
                <div>
                  <p className="text-lg lg:text-xl font-black text-retro-purple tracking-tight uppercase">Kreativitas Menanti</p>
                  <p className="text-xs lg:text-sm mt-2 text-retro-purple/60 font-black uppercase max-w-md mx-auto">Unggah file PDF Anda ke Upload Center untuk memulai transformasi materi ajar yang cerdas.</p>
                </div>
              </div>
            )}

            {isLoading && !output && (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-fresh-orange">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-fresh-orange/5 border-t-fresh-orange rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-fresh-orange">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-black text-sm tracking-widest uppercase text-retro-purple">AI Sedang Merumuskan</p>
                  <p className="text-[10px] text-retro-purple/40 mt-1 font-black uppercase tracking-widest">Hampir selesai, mohon tunggu sebentar...</p>
                </div>
              </div>
            )}

            {output && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                {activeTab === 'slides' && parsedSlides.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
                    {parsedSlides.map((slide, idx) => (
                      <motion.div 
                        key={idx} 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="aspect-video bg-fresh-orange border-none rounded-[3rem] shadow-2xl shadow-orange-900/10 p-10 flex flex-col cursor-pointer group relative overflow-hidden ring-1 ring-white/20"
                        onClick={() => {
                          setCurrentSlideIndex(idx);
                          setIsPresenting(true);
                        }}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] opacity-[0.03] scale-150"></div>
                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-retro-purple p-3 rounded-2xl shadow-2xl">
                             <Maximize className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="flex justify-between items-start mb-6">
                          <span className="text-[11px] font-black text-retro-purple tracking-[0.4em] uppercase opacity-40">SLIDE {String(idx + 1).padStart(2, '0')}</span>
                        </div>
                        <h3 className="text-2xl font-black text-retro-purple mb-6 line-clamp-2 leading-tight tracking-tight">
                          {slide.title}
                        </h3>
                        <div className="flex-1 overflow-hidden">
                          <div className="text-sm font-bold text-retro-purple/80 leading-relaxed space-y-2 prose prose-sm prose-p:my-1 prose-li:my-0.5">
                            <ReactMarkdown>{slide.content.split('Saran Visual')[0]}</ReactMarkdown>
                          </div>
                        </div>
                        {slide.content.includes('Saran Visual') && (
                          <div className="mt-6 pt-5 border-t border-retro-purple/10 flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-retro-purple/10 flex items-center justify-center shrink-0">
                               <Sparkles className="w-5 h-5 text-retro-purple" />
                             </div>
                             <p className="text-[11px] text-retro-purple/60 font-bold italic leading-tight line-clamp-1">
                               {slide.content.split('Saran Visual')[1]?.replace(/^[:\s]*/, '')}
                             </p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 shadow-2xl border border-retro-purple/5 min-h-full rounded-[2.5rem]">
                    <div className="prose prose-lg max-w-none text-retro-purple printable-content prose-headings:text-retro-purple prose-strong:text-retro-purple prose-p:leading-relaxed">
                      <ReactMarkdown>{output}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <AnimatePresence>
            {isPresenting && parsedSlides.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-retro-purple flex flex-col items-center"
              >
                {/* Decoration */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fresh-orange/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                  <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-fresh-orange/5 rounded-full blur-[120px] -ml-48 -mb-48"></div>
                </div>

                {/* Header Controls */}
                <div className="h-20 w-full flex items-center justify-between px-6 lg:px-12 z-10 shrink-0 border-b border-white/5 bg-retro-purple/40 backdrop-blur-md">
                  <div className="flex items-center gap-3 lg:gap-5">
                    <div className="bg-fresh-orange p-2 lg:p-3 rounded-xl lg:rounded-2xl shadow-2xl shadow-orange-950/50">
                      <Presentation className="w-5 h-5 lg:w-6 h-6 text-white" />
                    </div>
                    <div className="text-white overflow-hidden max-w-[150px] lg:max-w-none">
                      <h2 className="text-lg lg:text-xl font-black tracking-tight leading-tight truncate">{fileName}</h2>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Presenter Dashboard</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-4">
                    <div className="px-4 lg:px-6 py-2 lg:py-2.5 bg-white/5 rounded-2xl border border-white/10 text-white flex items-center gap-2 lg:gap-4 shadow-inner">
                      <span className="text-[9px] lg:text-[10px] font-black tracking-widest text-fresh-orange">SLIDE</span>
                      <span className="text-sm lg:text-lg font-black tabular-nums">{currentSlideIndex + 1} <span className="text-white/20">/</span> {parsedSlides.length}</span>
                    </div>
                    <div className="h-8 w-px bg-white/10 mx-1 lg:mx-2"></div>
                    <button 
                      onClick={() => setIsPresenting(false)}
                      className="p-2 lg:p-3 bg-fresh-orange/10 hover:bg-fresh-orange text-fresh-orange hover:text-white rounded-xl lg:rounded-2xl transition-all shadow-xl backdrop-blur-md border border-fresh-orange/20"
                    >
                      <X className="w-5 h-5 lg:w-6 h-6" />
                    </button>
                  </div>
                </div>                {/* Slide Content */}
                <div className="flex-1 w-full flex items-center justify-center px-4 lg:px-12 py-4 lg:py-6 z-10 overflow-hidden mt-2 lg:mt-4">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={currentSlideIndex}
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 1.05, opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="aspect-video w-full max-w-5xl bg-fresh-orange rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(26,0,51,0.4)] flex flex-col p-12 lg:p-14 relative overflow-hidden group border-4 border-white/10"
                    >
                      {/* Decorative elements */}
                      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:40px_40px]"></div>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -tr-32 -tt-32"></div>
                      
                      <div className="mb-6 relative z-10">
                        <div className="flex items-center gap-6 mb-3">
                          <div className="h-[2px] w-12 bg-retro-purple/30" />
                          <span className="text-retro-purple font-black tracking-[0.6em] text-[10px] uppercase opacity-70">MODUL PEMBELAJARAN</span>
                          <div className="h-[2px] flex-1 bg-retro-purple/10" />
                        </div>
                        <h1 className="text-xl lg:text-3xl font-black text-retro-purple leading-[1.05] tracking-tight line-clamp-2">
                          {parsedSlides[currentSlideIndex].title}
                        </h1>
                      </div>
 
                      <div className="flex-1 text-xs lg:text-sm text-retro-purple font-black leading-relaxed relative z-10 overflow-hidden flex flex-col justify-center">
                        <div className="prose prose-xs lg:prose-base max-w-none prose-p:my-0.5 prose-li:my-0 text-retro-purple prose-headings:text-retro-purple prose-strong:text-retro-purple">
                          <ReactMarkdown>{parsedSlides[currentSlideIndex].content.split('Saran Visual')[0]}</ReactMarkdown>
                        </div>
                      </div>

                      {parsedSlides[currentSlideIndex].content.includes('Saran Visual') && (
                        <div className="mt-8 pt-6 border-t border-retro-purple/10 flex items-center gap-6 relative z-10">
                          <div className="bg-retro-purple p-3 rounded-[1.2rem] shadow-2xl">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-retro-purple tracking-[0.2em] uppercase mb-1 opacity-60">Saran Visual AI</p>
                            <p className="text-sm text-retro-purple/80 font-bold italic leading-tight">
                              {parsedSlides[currentSlideIndex].content.split('Saran Visual')[1]?.replace(/^[:\s]*/, '')}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full max-w-5xl px-12 mb-4 z-10">
                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentSlideIndex + 1) / parsedSlides.length) * 100}%` }}
                        className="h-full bg-fresh-orange shadow-[0_0_15px_rgba(255,69,0,0.5)]"
                      />
                   </div>
                </div>

                {/* Navigation Controls */}
                <div className="h-24 lg:h-28 w-full flex items-center justify-center gap-4 lg:gap-10 z-10 shrink-0 mb-4 lg:mb-0">
                  <button 
                    disabled={currentSlideIndex === 0}
                    onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                    className="group flex flex-col items-center gap-2 text-white disabled:opacity-10 transition-all active:scale-90"
                  >
                    <div className="p-4 lg:p-5 bg-white/5 hover:bg-white/10 rounded-[1.5rem] lg:rounded-[2rem] border border-white/10 backdrop-blur-md transition-colors shadow-2xl">
                      <ChevronLeft className="w-6 h-6 lg:w-8 h-8" />
                    </div>
                    <span className="font-black text-[8px] lg:text-[9px] tracking-[0.3em] opacity-30 group-hover:opacity-100 transition-opacity uppercase">Kembali</span>
                  </button>

                  <div className="px-6 lg:px-10 py-3 lg:py-4 bg-retro-purple/60 backdrop-blur-3xl rounded-[1.5rem] lg:rounded-[2rem] border border-white/10 shadow-2xl flex items-center gap-4 lg:gap-6">
                    <div className="flex gap-1.5 lg:gap-2 overflow-hidden max-w-[100px] lg:max-w-none">
                       {parsedSlides.map((_, i) => (
                         <button
                           key={i}
                           onClick={() => setCurrentSlideIndex(i)}
                           className={`h-1 lg:h-1.5 transition-all rounded-full ${i === currentSlideIndex ? 'w-6 lg:w-10 bg-fresh-orange' : 'w-1 lg:w-1.5 bg-white/20 hover:bg-white/40'}`}
                         />
                       ))}
                    </div>
                    <div className="h-4 w-px bg-white/10"></div>
                    <span className="text-white font-black text-[10px] lg:text-xs tabular-nums tracking-widest uppercase shrink-0">
                      {currentSlideIndex + 1} <span className="opacity-20 mx-0.5 lg:mx-1">/</span> {parsedSlides.length}
                    </span>
                  </div>

                  <button 
                    disabled={currentSlideIndex === parsedSlides.length - 1}
                    onClick={() => setCurrentSlideIndex(prev => Math.min(parsedSlides.length - 1, prev + 1))}
                    className="group flex flex-col items-center gap-2 text-white disabled:opacity-10 transition-all active:scale-90"
                  >
                    <div className="p-5 lg:p-6 bg-fresh-orange text-retro-purple rounded-[2rem] lg:rounded-[2.5rem] shadow-[0_20px_50px_-10px_rgba(255,69,0,0.4)] hover:scale-105 transition-all ring-4 ring-fresh-orange/20">
                      <ChevronRight className="w-8 h-8 lg:w-10 h-10" />
                    </div>
                    <span className="font-black text-[8px] lg:text-[9px] tracking-[0.3em] text-fresh-orange uppercase tracking-[0.4em]">Selanjutnya</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <footer className="h-10 bg-retro-purple px-8 flex items-center justify-between text-[10px] text-white/50 shrink-0 border-t border-white/5">
        <div className="font-black uppercase tracking-widest">&copy; DapzAI - 2026 Asisten Pengajar </div>
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-1.5 font-black uppercase tracking-tight">
            <span className="w-1.5 h-1.5 bg-fresh-orange rounded-full animate-pulse shadow-[0_0_5px_#FF4500]"></span>
            Enkripsi AI Aktif
          </span>
        </div>
      </footer>
    </div>
  );
}
