/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Building2, MapPin, Train, Loader2, Sparkles, Home, X, Maximize2, ExternalLink, Bookmark, CheckCircle2, Waves } from 'lucide-react';
// Removed Gemini import
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PropertyData {
  id: string;
  name: string;
  location: string;
  price: string;
  size: string;
  bhk: string;
  amenities: string;
  transit: string;
}

interface Property extends PropertyData {
  insight: string;
  image?: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [listings, setListings] = useState<PropertyData[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [showSavedView, setShowSavedView] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const steps = [
    { label: "Scanning database...", icon: <Building2 className="w-3 h-3 text-indigo-500" /> },
    { label: "Matching preferences...", icon: <Train className="w-3 h-3 text-indigo-500" /> },
    { label: "Finalizing results...", icon: <Sparkles className="w-3 h-3 text-indigo-500" /> }
  ];

  const parseCSV = (csv: string): PropertyData[] => {
    const lines = csv.split('\n');
    const result: PropertyData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parser for quoted strings
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);

      if (parts.length >= 8) {
        result.push({
          id: parts[0],
          name: parts[1],
          location: parts[2],
          price: parts[3],
          size: parts[4],
          bhk: parts[5],
          amenities: parts[6],
          transit: parts[7]
        });
      }
    }
    return result;
  };

  // Persistence: Load from LocalStorage
  useEffect(() => {
    const savedChat = localStorage.getItem('ncr_estate_chat');
    if (savedChat) {
      try {
        setMessages(JSON.parse(savedChat));
      } catch (e) {
        console.error("Failed to parse saved chat", e);
      }
    } else {
      setMessages([
        {
          role: 'assistant',
          content: "Welcome to NCR Estate. I can help you find properties in Delhi, Gurgaon, or Noida directly from our verified database. What are you looking for today?"
        }
      ]);
    }

    const savedProps = localStorage.getItem('ncr_saved_properties');
    if (savedProps) {
      try {
        setSavedProperties(JSON.parse(savedProps));
      } catch (e) {
        console.error("Failed to parse saved properties", e);
      }
    }

    fetch('/listings.csv')
      .then(res => res.text())
      .then(data => {
        setListings(parseCSV(data));
      })
      .catch(err => console.error("Failed to load data:", err));
  }, []);

  // Persistence: Save to LocalStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ncr_estate_chat', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('ncr_saved_properties', JSON.stringify(savedProperties));
  }, [savedProperties]);

  const toggleSaveProperty = (e: React.MouseEvent, property: Property) => {
    e.stopPropagation();
    setSavedProperties(prev => {
      const isSaved = prev.find(p => p.id === property.id);
      if (isSaved) {
        return prev.filter(p => p.id !== property.id);
      }
      return [...prev, property];
    });
  };

  const isPropertySaved = (id: string) => savedProperties.some(p => p.id === id);

  const getPropertyImage = (name: string) => {
    const seed = encodeURIComponent(name);
    return `https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=800&q=80&sig=${seed}`;
  };

  const parsePropertyCard = (content: string): Property | null => {
    if (!content.startsWith('[PROPERTY_CARD:')) return null;
    const parts = content
      .replace('[PROPERTY_CARD:', '')
      .replace(']', '')
      .split('|')
      .map(p => p.trim());
    
    if (parts.length < 9) return null;

    return {
      name: parts[0],
      id: parts[1],
      location: parts[2],
      price: parts[3],
      size: parts[4],
      bhk: parts[5],
      transit: parts[6],
      amenities: parts[7],
      insight: parts[8],
      image: getPropertyImage(parts[0])
    };
  };

  const performLocalSearch = (query: string): string => {
    const q = query.toLowerCase();
    
    // Extract potential constraints
    const hasNoida = q.includes('noida');
    const hasGGN = q.includes('gurgaon') || q.includes('ggn');
    const hasDelhi = q.includes('delhi');
    const bhkMatch = q.match(/(\d)\s*bhk/);
    const bhk = bhkMatch ? bhkMatch[1] : null;

    // Filter listings
    let filtered = listings.filter(item => {
      let match = true;
      if (hasNoida && !item.location.toLowerCase().includes('noida')) match = false;
      if (hasGGN && !item.location.toLowerCase().includes('gurgaon')) match = false;
      if (hasDelhi && !item.location.toLowerCase().includes('delhi')) match = false;
      if (bhk && item.bhk !== bhk) match = false;
      
      // Basic fallback: if no specific match, try keyword search
      if (!hasNoida && !hasGGN && !hasDelhi && !bhk) {
        match = item.name.toLowerCase().includes(q) || 
                item.location.toLowerCase().includes(q) || 
                item.amenities.toLowerCase().includes(q);
      }
      
      return match;
    });

    if (filtered.length === 0) {
      return "I couldn't find any properties matching those specific criteria in our database. Try searching for a location like 'Gurgaon' or 'Noida', or specify a BHK requirement.";
    }

    // Limit to top 3 for the chat response
    const topMatches = filtered.slice(0, 3);
    
    let response = `Based on your search for "${query}", I've found ${filtered.length} matching properties in our database. Here are the top recommendations:\n\n`;
    
    topMatches.forEach(item => {
      const insight = `Excellent project in ${item.location} with premium ${item.amenities.split(',')[0]} facilities.`;
      response += `[PROPERTY_CARD: ${item.name} | ${item.id} | ${item.location} | ${item.price} | ${item.size} | ${item.bhk} | ${item.transit} | ${item.amenities} | ${insight}]\n\n`;
    });

    // Add a comparison table
    response += `### Market Comparison\n\n| Feature | ${topMatches.map(m => m.name).join(' | ')} |\n`;
    response += `| :--- | ${topMatches.map(() => ':---').join(' | ')} |\n`;
    response += `| **Monthly Rent** | ${topMatches.map(m => m.price).join(' | ')} |\n`;
    response += `| **BHK Layout** | ${topMatches.map(m => m.bhk + ' BHK').join(' | ')} |\n`;
    response += `| **Transit Time** | ${topMatches.map(m => m.transit + 'm walk').join(' | ')} |\n\n`;

    response += `**Verdict**: These properties represent the best value in ${hasNoida ? 'Noida' : hasGGN ? 'Gurgaon' : hasDelhi ? 'Delhi' : 'the NCR region'} based on your requirements.`;

    return response;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => prev < steps.length - 1 ? prev + 1 : prev);
      }, 800); // Faster loading for local search
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    // Simulate search latency for UX
    setTimeout(() => {
      const response = performLocalSearch(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setIsLoading(false);
      setLoadingStep(0);
    }, 2400);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
        <div className="p-8 border-b border-slate-100">
          <h1 className="text-xl font-black tracking-tighter text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 flex items-center justify-center rounded-lg shadow-xl shadow-slate-200">
              <Home className="text-white w-4 h-4" />
            </div>
            NCR Estate AI
          </h1>
          <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-[0.2em] font-bold">Premium Housing Search</p>
        </div>
        
        <div className="flex-1 p-6 space-y-4">
          <div className="bg-slate-50 text-slate-900 p-4 rounded-2xl text-xs font-bold border border-slate-200 shadow-sm text-center">
            Supported Regions
          </div>
          <div className="space-y-1">
            {['Delhi', 'Gurgaon', 'Noida'].map(region => (
              <div key={region} className="p-3 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-300" />
                {region}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 italic">
          <p className="text-[10px] text-slate-400 font-medium">Find your next home with intelligent site analysis.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {/* Header */}
        <header className="h-20 border-b border-slate-100 flex items-center justify-between px-6 lg:px-10 bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-900">Assistant Active</span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{isLoading ? 'Finding Matches' : 'Ready to search'}</span>
            </div>
          </div>
          <div className="hidden lg:flex gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">NCR Region</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Delhi • GGN • Noida</span>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSavedView(true)}
                className="relative px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center gap-2.5 group/saved"
              >
                <Bookmark className={`w-3.5 h-3.5 transition-colors ${savedProperties.length > 0 ? 'fill-indigo-600 text-indigo-600' : 'text-slate-400 group-hover/saved:text-indigo-500'}`} />
                Saved
                {savedProperties.length > 0 && (
                  <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center bg-indigo-600 text-white text-[9px] font-black rounded-lg shadow-lg shadow-indigo-200">
                    {savedProperties.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {messages.length <= 1 && (
            <motion.section 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 lg:px-12 py-4 bg-slate-50 border-b border-slate-100 overflow-hidden"
            >
              <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { step: "01", title: "Analyze", desc: "Requirements & budget mapping." },
                  { step: "02", title: "Scan", desc: "Real-time database matching." },
                  { step: "03", title: "Match", desc: "Curated Recommendations." }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <span className="text-xl font-black text-slate-200 italic leading-none">{item.step}</span>
                    <div className="space-y-0.5">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{item.title}</h4>
                      <p className="text-[9px] text-slate-400 font-bold leading-tight">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-8 lg:p-10 space-y-12 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Agent Header for Assistant Messages */}
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-3 mb-4 ml-1">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
                      <Bot className="w-5 h-5 text-slate-900" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-tight">AI Advisor</span>
                      <span className="text-[10px] text-slate-400 font-bold">NCR Housing Expert</span>
                    </div>
                  </div>
                )}

                <div className={`max-w-[85%] lg:max-w-[65%] px-6 py-4 lg:px-8 lg:py-5 rounded-[2.5rem] shadow-sm transition-all ${
                  message.role === 'user' 
                    ? 'bg-slate-200 border border-slate-800 text-white rounded-tr-none shadow-2xl shadow-slate-300/10 text-[15px] font-medium min-w-[80px]' 
                    : 'bg-white border border-slate-100 text-slate-700 text-sm leading-relaxed rounded-tl-none shadow-2xl shadow-slate-200/30'
                }`}>
                  <div className={`markdown-body ${message.role === 'user' ? '!text-slate-500' : 'text-slate-200'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                      p: ({children}) => {
                        const content = String(children);
                        const property = parsePropertyCard(content);
                        
                        if (property) {
                          return (
                            <motion.div 
                              whileHover={{ y: -4 }}
                              onClick={() => setSelectedProperty(property)}
                              className="group my-6 p-1 bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-indigo-100 cursor-pointer transition-all overflow-hidden"
                            >
                              <div className="flex flex-col sm:flex-row gap-6 p-5">
                                <div className="w-full sm:w-32 h-32 rounded-2xl overflow-hidden shrink-0 relative bg-slate-50">
                                   <img 
                                    src={property.image} 
                                    alt={property.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[8px] font-bold text-white uppercase tracking-widest">
                                    {property.bhk} BHK
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none group-hover:text-indigo-600 transition-colors">{property.name}</h4>
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={(e) => toggleSaveProperty(e, property)}
                                        className="p-2 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors group/btn"
                                      >
                                        <Bookmark className={`w-4 h-4 transition-colors ${isPropertySaved(property.id) ? 'fill-indigo-600 text-indigo-600' : 'text-slate-400 group-hover/btn:text-indigo-500'}`} />
                                      </button>
                                      <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                                        <Maximize2 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-1.5 line-clamp-1">
                                    <MapPin className="w-3 h-3" />
                                    {property.insight.split('in ')[1] || 'NCR Region'}
                                  </p>
                                  <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Price</span>
                                      <span className="text-sm font-black text-emerald-600">Starts {property.price}</span>
                                    </div>
                                    <div className="w-px h-6 bg-slate-100" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Transit</span>
                                      <span className="text-sm font-black text-indigo-600">{property.transit} min</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        }
                        
                        return <p className="mb-4 last:mb-0 leading-relaxed text-slate-600">{children}</p>;
                      },
                      table: ({children}) => (
                        <div className="my-10 overflow-hidden border border-slate-800 rounded-3xl shadow-2xl bg-slate-900">
                          <div className="px-8 py-5 border-b border-slate-800 flex items-center gap-3 bg-slate-900/50">
                            <div className="w-6 h-6 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                              <Waves className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-xs font-black text-white uppercase tracking-[0.2em]">Market Comparison</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[13px] table-auto">
                              {children}
                            </table>
                          </div>
                        </div>
                      ),
                      thead: ({children}) => <thead className="bg-slate-900/80 text-[10px] text-slate-400 font-black tracking-[0.15em] border-b border-slate-800">{children}</thead>,
                      th: ({children}) => <th className="px-8 py-6 font-black text-white">{children}</th>,
                      td: ({children}) => <td className="px-8 py-6 border-t border-slate-800 text-slate-300 font-medium whitespace-nowrap">{children}</td>,
                      strong: ({children}) => <strong className="font-extrabold text-indigo-700">{children}</strong>,
                      hr: () => <hr className="my-10 border-t-2 border-slate-50" />,
                      h3: ({children}) => (
                        <h3 className="text-xl font-black text-slate-900 mt-12 mb-6 flex items-center gap-3">
                          <div className="w-2 h-6 bg-slate-300 rounded-full" />
                          {children}
                        </h3>
                      ),
                      h4: ({children}) => (
                        <div className="mt-8 p-8 bg-indigo-50/30 border-2 border-indigo-100/50 rounded-3xl shadow-inner">
                          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <Sparkles className="w-4 h-4" />
                             Top Recommendation
                          </h4>
                          <p className="text-indigo-950 font-semibold leading-relaxed">{children}</p>
                        </div>
                      ),
                      ul: ({children}) => <ul className="space-y-3 mb-8 ml-2">{children}</ul>,
                      li: ({children}) => (
                        <li className="list-none flex items-start gap-3 text-sm text-slate-500 mb-2">
                          <div className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                          <div className="flex-1">{children}</div>
                        </li>
                      )
                    }}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-4 p-6 bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100 max-w-fit"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 shadow-inner">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{steps[loadingStep].label}</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    {steps.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-700 ${i <= loadingStep ? 'w-8 bg-indigo-500 shadow-sm shadow-indigo-200' : 'w-2 bg-slate-100'}`} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <footer className="p-8 bg-white border-t border-slate-100 relative shadow-[0_-15px_30px_rgba(0,0,0,0.03)] shrink-0">
          <div className="relative flex items-center max-w-3xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 rounded-3xl blur-lg opacity-0 group-focus-within:opacity-10 transition-opacity" />
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="e.g. Noida under ₹50k with 2BHK" 
              className="relative w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] py-5 px-8 pr-16 text-sm font-semibold focus:outline-none focus:ring-0 focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 p-3 bg-slate-900 text-white hover:bg-indigo-600 rounded-2xl transition-all disabled:opacity-20 shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-4 flex gap-6 text-[9px] text-slate-400 justify-center font-black uppercase tracking-[0.2em] opacity-40">
            <span>Verified Listings</span>
            <span>NCR Hub</span>
            <span>Smart Search</span>
          </div>
        </footer>
      </main>

      {/* Property Modal */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10"
          >
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" 
              onClick={() => setSelectedProperty(null)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row h-full lg:h-[80vh]"
            >
              <button 
                onClick={() => setSelectedProperty(null)}
                className="absolute top-6 right-6 z-20 p-3 bg-white/20 backdrop-blur-xl text-white hover:bg-white/40 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Modal Left: Photos */}
              <div className="w-full lg:w-[45%] bg-slate-900 h-64 lg:h-full relative overflow-hidden shrink-0">
                <img 
                  src={selectedProperty.image} 
                  alt={selectedProperty.name}
                  className="w-full h-full object-cover opacity-90"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                <div className="absolute bottom-10 left-10 right-10">
                  <div className="inline-flex px-3 py-1 bg-indigo-500 rounded-lg text-[10px] font-black text-white uppercase tracking-widest mb-4">
                    Featured Choice
                  </div>
                  <h2 className="text-4xl font-black text-white tracking-tighter mb-2">{selectedProperty.name}</h2>
                  <p className="text-slate-300 text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedProperty.id} • Premium NCR Development
                  </p>
                </div>
              </div>

              {/* Modal Right: Details */}
              <div className="flex-1 overflow-y-auto p-10 lg:p-16 bg-white">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Rent</span>
                    <p className="text-xl font-black text-emerald-600 tracking-tight">{selectedProperty.price}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Size</span>
                    <p className="text-xl font-black text-slate-900 tracking-tight">{selectedProperty.size} <span className="text-xs text-slate-400">sqft</span></p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout</span>
                    <p className="text-xl font-black text-slate-900 tracking-tight">{selectedProperty.bhk} BHK</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transit Link</span>
                    <p className="text-xl font-black text-indigo-600 tracking-tight">{selectedProperty.transit} min <span className="text-xs text-slate-400">walk</span></p>
                  </div>
                </div>

                <div className="space-y-10">
                  <section>
                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 border-l-4 border-slate-900 pl-4">Expert Insight</h5>
                    <p className="text-lg text-slate-600 font-medium leading-relaxed italic">{selectedProperty.insight}</p>
                  </section>

                  <section>
                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 border-l-4 border-slate-900 pl-4">Premium Amenities</h5>
                    <div className="flex flex-wrap gap-3">
                      {selectedProperty.amenities.split(',').map((amenity, i) => (
                        <span key={i} className="px-5 py-3 bg-slate-50 rounded-2xl text-xs font-bold text-slate-700 border border-slate-100 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          {amenity.trim()}
                        </span>
                      ))}
                    </div>
                  </section>

                  <div className="pt-10 flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={(e) => toggleSaveProperty(e, selectedProperty)}
                      className={`flex-1 py-5 rounded-3xl font-black uppercase text-xs tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
                        isPropertySaved(selectedProperty.id) 
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' 
                          : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-200'
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${isPropertySaved(selectedProperty.id) ? 'fill-white' : ''}`} />
                      {isPropertySaved(selectedProperty.id) ? 'Saved' : 'Save Listing'}
                    </button>
                    <button className="flex-1 py-5 bg-indigo-50 text-indigo-700 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center justify-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Schedule Visit
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Properties View */}
      <AnimatePresence>
        {showSavedView && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10"
          >
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" 
              onClick={() => setShowSavedView(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col h-full lg:h-[80vh] overflow-hidden"
            >
              <header className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <Bookmark className="w-5 h-5 text-indigo-600 fill-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Saved Properties</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{savedProperties.length} Matches Found</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSavedView(false)}
                  className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 lg:p-10">
                {savedProperties.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-slate-200">
                      <Bookmark className="w-8 h-8 text-slate-200" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 mb-2">No Saved Properties</h3>
                      <p className="text-sm text-slate-500 max-w-xs mx-auto">Start browsing properties in the chat to save your favorite matches here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-10">
                    {savedProperties.map(property => (
                      <motion.div 
                        key={property.id}
                        layoutId={`saved-${property.id}`}
                        onClick={() => {
                          setSelectedProperty(property);
                          setShowSavedView(false);
                        }}
                        className="group p-1 bg-white border border-slate-100 rounded-3xl shadow-lg hover:shadow-xl hover:shadow-indigo-100 cursor-pointer transition-all overflow-hidden"
                      >
                        <div className="relative h-48 bg-slate-50 rounded-[1.4rem] overflow-hidden">
                          <img 
                            src={property.image} 
                            alt={property.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[8px] font-bold text-white uppercase tracking-widest">
                            {property.bhk} BHK
                          </div>
                          <button 
                            onClick={(e) => toggleSaveProperty(e, property)}
                            className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-xl text-indigo-600 shadow-lg hover:bg-white transition-all"
                          >
                            <Bookmark className="w-4 h-4 fill-current" />
                          </button>
                        </div>
                        <div className="p-5">
                          <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-4">{property.name}</h4>
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Rent</span>
                              <span className="text-sm font-black text-emerald-600">{property.price}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Transit</span>
                              <span className="text-sm font-black text-indigo-600">{property.transit}m</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

