import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Header from '../../components/ui/Header';

const MayaAssistant = () => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'היי! אני מאיה, העוזרת הדיגיטלית שלך 🌸\nאפשר לשאול אותי על הכל - נהלים, דוחות, גינון ועוד.' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    const toggleListening = () => {
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
    };

    const sendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage = { role: 'user', content: inputText };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            // Call backend API (we'll create this endpoint)
            const response = await fetch('/api/maya/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: inputText })
            });

            const data = await response.json();
            const assistantMessage = { role: 'assistant', content: data.response || 'מצטערת, הייתה בעיה.' };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Maya error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאה בתקשורת. נסה שוב.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-purple-50 to-pink-50">
            <Header />

            {/* Chat Container */}
            <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 bg-white rounded-kiosk-lg shadow-kiosk p-4">
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
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
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
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white p-4 rounded-kiosk-lg shadow-md">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white rounded-kiosk-lg shadow-kiosk p-4">
                    <div className="flex items-center space-x-3">
                        {/* Voice Button */}
                        <button
                            onClick={toggleListening}
                            className={`p-4 rounded-full transition-all duration-200 touch-target ${isListening
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
                                }`}
                            disabled={isLoading}
                        >
                            <Icon name={isListening ? 'MicOff' : 'Mic'} size={24} />
                        </button>

                        {/* Text Input */}
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="כתוב שאלה או לחץ על המיקרופון..."
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-kiosk-md focus:border-purple-500 focus:outline-none text-right"
                            disabled={isLoading}
                        />

                        {/* Send Button */}
                        <button
                            onClick={sendMessage}
                            disabled={!inputText.trim() || isLoading}
                            className="p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Icon name="Send" size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MayaAssistant;
