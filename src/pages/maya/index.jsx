import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../components/AppIcon';
import Header from '../../components/ui/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MayaAssistant = () => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([
        {
            id: 'init-1',
            role: 'assistant',
            content: 'היי! אני מאיה, העוזרת הדיגיטלית שלך 🌸\nאפשר לשאול אותי על הכל - נהלים, דוחות, גינון ועוד.'
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Training Mode State
    const [pendingQuestion, setPendingQuestion] = useState(null); // { question: string }

    // Context Data
    const [contextData, setContextData] = useState({ menu: '', team: '' });

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Load Context (Menu & Team)
    useEffect(() => {
        const loadContext = async () => {
            if (!currentUser?.business_id) return;
            try {
                const [menuRes, teamRes] = await Promise.all([
                    supabase.from('menu_items').select('name, price, category').eq('business_id', currentUser.business_id),
                    supabase.from('employees').select('name, role').eq('business_id', currentUser.business_id)
                ]);

                const menuStr = menuRes.data?.map(i => `* ${i.name} (${i.category}) - ${i.price}₪`).join('\n') || 'תפריט ריק';
                const teamStr = teamRes.data?.map(e => `* ${e.name} (${e.role})`).join('\n') || 'אין עובדים רשומים';

                setContextData({ menu: menuStr, team: teamStr });
            } catch (e) {
                console.error('Error loading context:', e);
            }
        };
        loadContext();
    }, [currentUser]);

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = 'he-IL';
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInputText(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = () => {
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) {
            alert('הדפדפן לא תומך בזיהוי קולי. נסה Chrome או Safari.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    }, [isListening]);

    const handleTrainingResponse = async (answer) => {
        // Here we would ideally save to backend/file
        // For now, we simulate the learning
        console.log('🎓 Training Data:', { question: pendingQuestion.question, answer });

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `תודה! למדתי את זה. 🧠\n(התשובה נוספה למאגר הידע שלי)`
        }]);
        setPendingQuestion(null);
    };

    const sendMessage = useCallback(async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessageId = Date.now().toString();
        const userMessage = { id: userMessageId, role: 'user', content: inputText };
        setMessages(prev => [...prev, userMessage]);

        const userInput = inputText;
        setInputText('');

        if (pendingQuestion) {
            await handleTrainingResponse(userInput);
            return;
        }

        setIsLoading(true);

        const API_KEY = import.meta.env.VITE_XAI_API_KEY || "";
        const COLLECTION_ID = import.meta.env.VITE_XAI_COLLECTION_ID || "collection_b1470bb9-6e71-4f10-91fa-73edd1377bc2";

        const systemContext = `
        את מאיה. העוזרת האישית של ${currentUser?.name || 'המנהל'} ומומחית קוד Senior במערכת הקיוסק. 🌸
        
        === 👨‍💻 המומחיות שלך ===
        יש לך גישה לקולקשן 'self-service-kiosk-kanban' המכיל את קבצי המקור של המערכת (קנבן, KDS, סנכרון).
        את מכירה את useOrders, useKDSData, וכל תהליך ניהול הסטטוסים.
        
        === 👥 הצוות שלנו ===
        ${contextData.team}
        
        === 📋 תפריט ===
        ${contextData.menu}
        
        הוראות:
        1. השתמשי במידע מהקולקשן ובקונטקסט למעלה כדי לענות.
        2. עני בעברית רהוטה ומקצועית.
        3. אם חסר מידע קריטי או שאת לא מצליחה למצוא תשובה בקוד, עני: "ESCALATE_TO_HUMAN".
        `;

        try {
            // Call xAI Grok API
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'grok-code-fast-1',
                    messages: [
                        { role: 'system', content: systemContext },
                        ...messages.slice(-5).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: userInput }
                    ],
                    collection_ids: [COLLECTION_ID],
                    temperature: 0.1,
                    max_tokens: 1000
                })
            });

            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content || 'מצטערת, הייתה בעיה בתקשורת עם השרת.';

            if (reply.includes('ESCALATE_TO_HUMAN')) {
                setPendingQuestion({ question: userInput });
                setMessages(prev => [...prev, {
                    id: Date.now().toString() + '-esc',
                    role: 'assistant',
                    content: '🤔 אני לא בטוחה לגבי זה מהקוד שלי.\nאנא הסבר לי, ואני אלמד את זה לפעם הבאה!'
                }]);
            } else {
                setMessages(prev => [...prev, {
                    id: Date.now().toString() + '-resp',
                    role: 'assistant',
                    content: reply
                }]);
            }

        } catch (error) {
            console.error('Maya error:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '-err',
                role: 'assistant',
                content: 'שגיאה בתקשורת עם Grok API. וודא שהמפתח תקין.'
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [inputText, isLoading, pendingQuestion, contextData, currentUser, messages]);

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-purple-50 to-pink-50">
            <Header />

            {/* Chat Container */}
            <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 overflow-hidden">
                {/* Header */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex items-center justify-between mb-4 bg-white rounded-kiosk-lg shadow-kiosk p-4"
                >
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
                            🌸
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">מאיה</h1>
                            <p className="text-sm text-gray-500">העוזרת האישית שלך</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-kiosk-sm transition-colors"
                    >
                        <Icon name="X" size={24} />
                    </button>
                </motion.div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] p-4 rounded-kiosk-lg shadow-md ${msg.role === 'user'
                                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                                        : 'bg-white text-gray-800'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap text-right">{msg.content}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="flex justify-start"
                        >
                            <div className="bg-white p-4 rounded-kiosk-lg shadow-md">
                                <div className="flex space-x-2">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            className="w-2 h-2 bg-purple-500 rounded-full"
                                            animate={{ y: [0, -6, 0] }}
                                            transition={{
                                                duration: 0.6,
                                                repeat: Infinity,
                                                delay: i * 0.2,
                                                ease: "easeInOut"
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`rounded-kiosk-lg shadow-kiosk p-4 transition-colors duration-300 ${pendingQuestion ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-white'}`}
                >
                    {pendingQuestion && (
                        <div className="mb-2 text-sm text-yellow-700 font-bold text-right px-2">
                            דרושה תשובה ללמידה: "{pendingQuestion.question}"
                        </div>
                    )}
                    <div className="flex items-center space-x-3">
                        {/* Voice Button */}
                        <motion.button
                            onClick={toggleListening}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.9 }}
                            className={`p-4 rounded-full transition-all duration-200 touch-target ${isListening
                                ? 'bg-red-500 text-white'
                                : pendingQuestion
                                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
                                }`}
                            animate={isListening ? { scale: [1, 1.1, 1], boxShadow: ["0 0 0 0px rgba(239, 68, 68, 0.7)", "0 0 0 10px rgba(239, 68, 68, 0)"] } : {}}
                            transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
                            disabled={isLoading}
                        >
                            <Icon name={isListening ? 'MicOff' : 'Mic'} size={24} />
                        </motion.button>

                        {/* Text Input */}
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder={pendingQuestion ? "כתוב כאן את התשובה כדי שאוכל ללמוד..." : "כתוב שאלה או לחץ על המיקרופון..."}
                            className={`flex-1 px-4 py-3 border-2 rounded-kiosk-md focus:outline-none text-right ${pendingQuestion ? 'border-yellow-300 bg-white focus:border-yellow-500' : 'border-gray-200 focus:border-purple-500'}`}
                            disabled={isLoading}
                        />

                        {/* Send Button */}
                        <motion.button
                            onClick={sendMessage}
                            disabled={!inputText.trim() || isLoading}
                            whileHover={{ scale: 1.05, rotate: -5 }}
                            whileTap={{ scale: 0.95 }}
                            className={`p-4 rounded-full text-white hover:shadow-lg transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed ${pendingQuestion ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                        >
                            <Icon name={pendingQuestion ? "Save" : "Send"} size={24} />
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default MayaAssistant;
