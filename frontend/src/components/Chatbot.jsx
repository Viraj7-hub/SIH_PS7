import { useState } from 'react';
import { MessageSquareText, Send, Sparkles } from 'lucide-react';
import { sendChatMessage } from '../services/api';

const suggestions = [
  'How far is the destination?',
  'When will we arrive?',
  'What is our current speed?',
  'Is the route safe?',
  'What is the weather?',
  'Why was this route selected?',
];

export default function Chatbot({ shipId }) {
  const [messages, setMessages] = useState([
    { sender: 'assistant', text: 'Hello! I can help with route, arrival, weather, and safety updates.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (text = input) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    setMessages((current) => [...current, { sender: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(shipId, trimmed);
      setMessages((current) => [...current, { sender: 'assistant', text: response.data.reply }]);
    } catch {
      setMessages((current) => [...current, { sender: 'assistant', text: 'Unable to connect to voyage services.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <MessageSquareText className="h-5 w-5 text-cyan-300" />
            Voyage Assistant
          </div>
          <div className="text-sm text-slate-400">Ask anything about your journey</div>
        </div>
        <Sparkles className="h-4 w-4 text-cyan-300" />
      </div>

      <div className="mb-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/50 p-3">
        {messages.map((message, index) => (
          <div key={`${message.sender}-${index}`} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.sender === 'user' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-100'}`}>
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => handleSend(suggestion)} className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400 hover:text-white">
            {suggestion}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about your voyage..."
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
        />
        <button type="button" onClick={() => handleSend()} disabled={loading} className="rounded-xl bg-cyan-500 p-2.5 text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
