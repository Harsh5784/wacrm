'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Button, Card, CardContent, Input, Textarea } from '@/components/ui';
import toast from 'react-hot-toast';
import { Bot, Send, Sparkles, MessageSquare, Wand2, Copy, RefreshCw, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'Generate a WhatsApp intro message for a new lead in retail',
  'Write a follow-up message after no response for 3 days (Hindi)',
  'Create an urgency message for a limited-time offer',
  'Write a professional closing message after deal is done',
  'Generate a re-engagement message for a cold lead',
  'Write a Diwali festival offer message in Hinglish',
];

export default function AIAssistantPage() {
  const searchParams = useSearchParams();
  const leadId = searchParams?.get('lead');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Namaste! 🙏 I'm your AI assistant for WhatsApp marketing.\n\nI can help you:\n• Generate personalized messages (Hindi/English/Hinglish)\n• Create follow-up sequences\n• Score and analyze leads\n• Suggest reply strategies\n\nWhat would you like to create today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'generator'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generator state
  const [genForm, setGenForm] = useState({
    purpose: '',
    business: '',
    language: 'english',
    tone: 'professional',
    context: '',
  });
  const [generatedMessages, setGeneratedMessages] = useState<string[]>([]);

  const { data: leadContext } = useQuery({
    queryKey: ['ai-lead-context', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${leadId}`);
      return data.data;
    },
    enabled: Boolean(leadId),
    retry: false,
  });

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const history = messages.filter(m => m.id !== '1').map(m => ({
        role: m.role,
        content: m.content,
      }));
      const { data } = await api.post('/ai/chat', {
        messages: [...history, { role: 'user', content: userMessage }],
        context: leadContext
          ? `WhatsApp marketing assistant for Indian businesses. Lead context: name=${leadContext.name}, phone=${leadContext.phone}, company=${leadContext.company || 'unknown'}, city=${leadContext.city || 'unknown'}, stage=${leadContext.stage}, score=${leadContext.score}, recent notes=${leadContext.notes?.map((n: any) => n.content).join('; ') || 'none'}, recent activity=${leadContext.activities?.map((a: any) => a.description).join('; ') || 'none'}. Generate English or Hinglish when requested.`
          : 'WhatsApp marketing assistant for Indian businesses',
      });
      return data.data.message;
    },
    onSuccess: (reply) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'AI response failed');
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post('/ai/generate-message', genForm),
    onSuccess: (res) => {
      setGeneratedMessages(res.data.data.messages);
      toast.success('Messages generated!');
    },
    onError: () => toast.error('Generation failed'),
  });

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    chatMutation.mutate(input);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {leadContext ? `Using lead context for ${leadContext.name}` : 'AI-powered message generation and marketing assistance'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'chat' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot className="w-4 h-4" /> AI Chat
        </button>
        <button
          onClick={() => setActiveTab('generator')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'generator' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wand2 className="w-4 h-4" /> Message Generator
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'chat' ? (
          <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-280px)]"
          >
            {/* Quick prompts sidebar */}
            <div className="lg:col-span-1 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Prompts</p>
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setInput(prompt)}
                  className="w-full text-left p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-xs text-muted-foreground hover:text-foreground leading-relaxed"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat */}
            <div className="lg:col-span-3 flex flex-col bg-card border border-border rounded-2xl overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'assistant' ? 'gradient-brand text-white' : 'bg-muted'
                    }`}>
                      {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : ''} flex flex-col gap-1`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-primary text-white rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => copyToClipboard(msg.content)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 self-start transition-colors"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl gradient-brand text-white flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i} className="w-2 h-2 rounded-full bg-muted-foreground/60"
                          animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-4">
                <div className="flex gap-3">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Ask AI to generate messages, follow-ups, or strategies..."
                    className="flex-1 h-10 rounded-xl border border-input bg-background px-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button size="icon" disabled={!input.trim()} loading={chatMutation.isPending} onClick={sendMessage}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="gen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Form */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" /> Message Generator
                </h2>
                <Textarea
                  label="Campaign Purpose *"
                  value={genForm.purpose}
                  onChange={e => setGenForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="e.g., Introduce our new product to shopkeepers in Mumbai"
                  className="min-h-[100px]"
                />
                <Input
                  label="Your Business"
                  value={genForm.business}
                  onChange={e => setGenForm(f => ({ ...f, business: e.target.value }))}
                  placeholder="e.g., Digital marketing agency"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Language</label>
                    <select
                      value={genForm.language}
                      onChange={e => setGenForm(f => ({ ...f, language: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="english">English</option>
                      <option value="hindi">Hindi</option>
                      <option value="hinglish">Hinglish</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Tone</label>
                    <select
                      value={genForm.tone}
                      onChange={e => setGenForm(f => ({ ...f, tone: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="casual">Casual</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <Textarea
                  label="Additional Context"
                  value={genForm.context}
                  onChange={e => setGenForm(f => ({ ...f, context: e.target.value }))}
                  placeholder="Any specific details, offer, or context..."
                  className="min-h-[80px]"
                />
                <Button
                  className="w-full"
                  loading={generateMutation.isPending}
                  disabled={!genForm.purpose}
                  onClick={() => generateMutation.mutate()}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate 3 Variations
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-4">
              {generatedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="p-4 rounded-2xl bg-muted mb-4">
                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">Generated messages will appear here</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Generated Messages</h3>
                    <Button variant="outline" size="sm" onClick={() => generateMutation.mutate()}>
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                    </Button>
                  </div>
                  {generatedMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card className="hover:border-primary/30 transition-colors">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">Variation {i + 1}</span>
                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(msg)}>
                              <Copy className="w-3.5 h-3.5" /> Copy
                            </Button>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-line bg-muted/50 p-3 rounded-xl">{msg}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
