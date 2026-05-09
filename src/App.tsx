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
  Presentation,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from 'react-markdown';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);

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

  const downloadSlidesPDF = async () => {
    if (parsedSlides.length === 0) return;
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1280, 720]
      });

      const slideElements = document.querySelectorAll('.printable-slide-item');
      
      for (let i = 0; i < slideElements.length; i++) {
        const element = slideElements[i] as HTMLElement;
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FF4500' 
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        if (i > 0) pdf.addPage([1280, 720], 'landscape');
        pdf.addImage(imgData, 'PNG', 0, 0, 1280, 720);
      }

      pdf.save(`${fileName.replace('.pdf', '')}_Presentasi.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Gagal mengunduh PDF. Silakan gunakan fitur Cetak.');
    } finally {
      setIsExporting(false);
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
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      setOutput(response.text || "Tidak ada hasil.");
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
    <div className="flex flex-col h-screen bg-[#FBFBFB] text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-retro-purple rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Asisten Pengajar</h1>
            <p className="text-xs font-medium text-fresh-orange uppercase tracking-widest">Solusi AI untuk Guru Juara</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300"></div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold leading-none text-slate-700">Profil Guru</p>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Lencana Emas</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-100 hidden md:block"></div>
          <button className="flex items-center gap-2 text-slate-400 hover:text-fresh-orange transition-colors text-sm font-medium">
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
                  ? 'border-fresh-orange bg-orange-50/10' 
                  : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50 bg-white'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="application/pdf"
                className="hidden"
              />
              <div className={`p-3 rounded-xl mb-2 ${pdfText ? 'bg-fresh-orange text-white' : 'bg-orange-50 text-fresh-orange'}`}>
                {isLoading && !pdfText ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <p className="text-sm font-bold text-fresh-orange truncate max-w-full px-2 text-center">
                {fileName || "Unggah PDF Materi"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium tracking-tight">Format PDF • Maksimal 50MB</p>
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
                <div className="p-1 bg-slate-100/80 rounded-xl flex mb-4">
                  {(['questions', 'summary', 'slides', 'chat'] as AppTab[]).map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all capitalize ${activeTab === tab ? 'bg-white shadow-sm text-fresh-orange' : 'text-slate-500'}`}
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
                            className={`px-3 py-2 text-[10px] font-bold border rounded-lg transition-all ${qType === type ? 'bg-orange-50 border-orange-200 text-fresh-orange' : 'bg-white border-slate-100 text-slate-500 hover:border-orange-100'}`}
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-fresh-orange outline-none transition-all resize-none h-20"
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
        <section className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-soft flex flex-col overflow-hidden relative">
          <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-[#F8F9FA] shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-fresh-orange animate-pulse' : 'bg-emerald-500'}`}></div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {activeTab === 'slides' ? 'MODUL PERSENTASI' : 'HASIL ANALISIS AI'}
              </h2>
            </div>
            {output && (
              <div className="flex gap-2">
                {activeTab === 'slides' && parsedSlides.length > 0 && (
                  <>
                    <button 
                      onClick={() => setIsPresenting(true)}
                      className="px-4 py-2 text-xs font-bold text-white bg-fresh-orange rounded-xl hover:opacity-90 transition shadow-lg flex items-center gap-2"
                    >
                      <Presentation className="w-4 h-4" /> Buka Presentasi
                    </button>
                    <button 
                      onClick={downloadSlidesPDF}
                      disabled={isExporting}
                      className="px-4 py-2 text-xs font-bold text-white bg-retro-purple rounded-xl hover:opacity-90 transition shadow-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Download PDF
                    </button>
                  </>
                )}
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Cetak
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
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
              <div className="h-full flex flex-col items-center justify-center gap-4 text-fresh-orange">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-orange-50 border-t-fresh-orange rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-fresh-orange">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm tracking-widest uppercase text-slate-700">AI Sedang Merumuskan</p>
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
                {activeTab === 'slides' && parsedSlides.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                    {parsedSlides.map((slide, idx) => (
                      <div 
                        key={idx} 
                        className="aspect-video bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all p-8 flex flex-col cursor-pointer group hover:border-fresh-orange relative overflow-hidden"
                        onClick={() => {
                          setCurrentSlideIndex(idx);
                          setIsPresenting(true);
                        }}
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize className="w-5 h-5 text-fresh-orange" />
                        </div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] font-black text-fresh-orange/40 uppercase tracking-[0.3em]">Slide {String(idx + 1).padStart(2, '0')}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4 line-clamp-2 leading-tight">
                          {slide.title}
                        </h3>
                        <div className="flex-1 overflow-hidden">
                          <div className="text-xs text-slate-500 leading-relaxed space-y-1 prose prose-sm">
                            <ReactMarkdown>{slide.content.split('Saran Visual')[0]}</ReactMarkdown>
                          </div>
                        </div>
                        {slide.content.includes('Saran Visual') && (
                          <div className="mt-4 pt-4 border-t border-slate-50 bg-slate-50 -mx-8 -mb-8 px-8 py-3">
                            <p className="text-[10px] text-slate-500 italic flex items-center gap-2">
                              <Sparkles className="w-3 h-3 text-fresh-orange" />
                              {slide.content.split('Saran Visual')[1]?.replace(/^[:\s]*/, '')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 shadow-2xl border border-slate-50 min-h-full rounded-[2.5rem]">
                    <div className="prose prose-slate prose-lg max-w-none text-slate-800 printable-content">
                      <ReactMarkdown>{output}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Presentation Modal */}
          <AnimatePresence>
            {isPresenting && parsedSlides.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-retro-purple flex flex-col items-center"
              >
                {/* Decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-5 overflow-hidden">
                  <div className="absolute -top-20 -left-20 w-96 h-96 bg-white rounded-full blur-[100px]"></div>
                  <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-fresh-orange rounded-full blur-[100px]"></div>
                </div>

                {/* Header Controls */}
                <div className="h-20 w-full flex items-center justify-between px-12 z-10 shrink-0">
                  <div className="flex items-center gap-5">
                    <div className="bg-white p-2 rounded-xl shadow-xl">
                      <Presentation className="w-5 h-5 text-retro-purple" />
                    </div>
                    <div className="text-white">
                      <h2 className="text-lg font-black tracking-tight">{fileName}</h2>
                      <p className="text-[10px] font-bold text-fresh-orange uppercase tracking-widest opacity-80">Presenter Mode Active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="px-5 py-2 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/10 text-white flex items-center gap-3">
                      <span className="text-[10px] font-black opacity-50">PROGRESS</span>
                      <span className="text-sm font-black tabular-nums">{currentSlideIndex + 1} <span className="opacity-30">/</span> {parsedSlides.length}</span>
                    </div>
                    <button 
                      onClick={() => window.print()}
                      className="p-3 bg-white/10 hover:bg-white text-white hover:text-retro-purple rounded-2xl transition-all shadow-xl backdrop-blur-md"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setIsPresenting(false)}
                      className="p-3 bg-white/10 hover:bg-white text-white hover:text-retro-purple rounded-2xl transition-all shadow-xl backdrop-blur-md"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Slide Content */}
                <div className="flex-1 w-full flex items-center justify-center px-12 py-10 z-10 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={currentSlideIndex}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.1, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="aspect-video w-full max-w-6xl bg-fresh-orange rounded-[4rem] shadow-[0_60px_100px_-20px_rgba(0,0,0,0.6)] flex flex-col p-16 relative overflow-hidden"
                    >
                      {/* Slide Interior Grid */}
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:30px_30px]"></div>

                      <div className="mb-10 relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-px flex-1 bg-white/20" />
                          <span className="text-retro-purple font-black tracking-[0.5em] text-[10px] uppercase">TOPIC OVERVIEW</span>
                          <div className="h-px flex-1 bg-white/20" />
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-black text-retro-purple leading-[1.1] tracking-tight line-clamp-2">
                          {parsedSlides[currentSlideIndex].title}
                        </h1>
                      </div>

                      <div className="flex-1 text-base lg:text-lg text-retro-purple font-bold leading-snug relative z-10 overflow-hidden">
                        <div className="prose prose-sm lg:prose-base max-w-none prose-p:my-1 prose-li:my-0.5 text-retro-purple">
                          <ReactMarkdown>{parsedSlides[currentSlideIndex].content.split('Saran Visual')[0]}</ReactMarkdown>
                        </div>
                      </div>

                      {parsedSlides[currentSlideIndex].content.includes('Saran Visual') && (
                        <div className="mt-8 pt-6 border-t border-retro-purple/10 flex items-center gap-4 relative z-10">
                          <div className="bg-retro-purple p-2 rounded-2xl shadow-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-retro-purple tracking-widest uppercase mb-0.5">Visual Inspiration</p>
                            <p className="text-xs text-retro-purple/70 font-bold italic leading-tight line-clamp-1">
                              {parsedSlides[currentSlideIndex].content.split('Saran Visual')[1]?.replace(/^[:\s]*/, '')}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigation Controls */}
                <div className="h-32 w-full flex items-center justify-center gap-12 z-10 shrink-0">
                  <button 
                    disabled={currentSlideIndex === 0}
                    onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                    className="group flex items-center gap-4 text-white disabled:opacity-20 transition-all font-black text-xs tracking-widest hover:scale-105 active:scale-95"
                  >
                    <div className="p-5 bg-white/10 group-hover:bg-white/20 rounded-[2rem] border border-white/10 backdrop-blur-md">
                      <ChevronLeft className="w-8 h-8" />
                    </div>
                    PREVIOUS
                  </button>

                  <div className="flex gap-3">
                    {parsedSlides.map((_, i) => (
                      <button 
                        key={i} 
                        onClick={() => setCurrentSlideIndex(i)}
                        className={`transition-all rounded-full h-2.5 ${i === currentSlideIndex ? 'w-12 bg-fresh-orange' : 'w-2.5 bg-white/20 hover:bg-white/40'}`}
                      />
                    ))}
                  </div>

                  <button 
                    disabled={currentSlideIndex === parsedSlides.length - 1}
                    onClick={() => setCurrentSlideIndex(prev => Math.min(parsedSlides.length - 1, prev + 1))}
                    className="group flex items-center gap-4 text-white disabled:opacity-20 transition-all font-black text-xs tracking-widest hover:scale-105 active:scale-95"
                  >
                    NEXT
                    <div className="p-6 bg-fresh-orange text-retro-purple rounded-[2.5rem] shadow-2xl shadow-black/20">
                      <ChevronRight className="w-10 h-10" />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <footer className="h-10 bg-slate-900 px-8 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <div>&copy; Daffa - 2026 Asisten Pengajar </div>
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            Koneksi Aman
          </span>
    
        </div>
      </footer>

      {/* Hidden Printable Area for Slides */}
      <div className="hidden">
        <div ref={printableRef} id="printable-slides">
          {parsedSlides.map((slide, idx) => (
            <div 
              key={idx} 
              className="printable-slide-item w-[1280px] h-[720px] bg-fresh-orange flex flex-col p-16 relative overflow-hidden"
              style={{ pageBreakAfter: 'always' }}
            >
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:30px_30px]"></div>
              
              <div className="mb-10 relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px flex-1 bg-white/20" />
                  <span className="text-retro-purple font-black tracking-[0.5em] text-[10px] uppercase">TOPIC OVERVIEW</span>
                  <div className="h-px flex-1 bg-white/20" />
                </div>
                <h1 className="text-6xl font-black text-retro-purple leading-[1.1] tracking-tight">
                  {slide.title}
                </h1>
              </div>

              <div className="flex-1 text-2xl text-retro-purple font-bold leading-snug relative z-10 overflow-hidden">
                <div className="prose prose-xl max-w-none text-retro-purple">
                  <ReactMarkdown>{slide.content.split('Saran Visual')[0]}</ReactMarkdown>
                </div>
              </div>

              {slide.content.includes('Saran Visual') && (
                <div className="mt-8 pt-6 border-t border-retro-purple/10 flex items-center gap-4 relative z-10">
                  <div className="bg-retro-purple p-2 rounded-2xl shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-retro-purple tracking-widest uppercase mb-0.5">Visual Inspiration</p>
                    <p className="text-sm text-retro-purple/70 font-bold italic leading-tight">
                      {slide.content.split('Saran Visual')[1]?.replace(/^[:\s]*/, '')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
