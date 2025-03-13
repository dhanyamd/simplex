'use client';

import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import remarkGfm from 'remark-gfm'; 
import { Message, SearchResult, ChatSection,SuggestionType, TavilyImage,TavilyResponse } from '@/types/interface';
import { TopBar } from '@/components/TopBar';

export default function SimplexPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult[]>([]);
  const [showTavilyModal, setShowTavilyModal] = useState(false);
  const [showReasoningModal, setShowReasoningModal] = useState(false);
  const [selectedMessageData, setSelectedMessageData] = useState<{tavily?: TavilyResponse, reasoning?: string}>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [chatSections, setChatSections] = useState<ChatSection[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  
  const suggestions: SuggestionType[] = [
    { label: "Blog Post Ideas", prefix: "Generate blog post ideas about: " },
  { label: "Social Media Post Captions", prefix: "Write engaging social media captions for: " },
  { label: "Email Subject Lines", prefix: "Create compelling email subject lines for: " },
  { label: "Presentation Outline", prefix: "Develop a presentation outline about: " },
  ];

  const handleSuggestionClick = (suggestion: SuggestionType) => {
    setSelectedSuggestion(suggestion.label);
    if (input) {
      setInput(suggestion.prefix + input);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setHasSubmitted(true)
    setLastQuery(input)
    setError(null)
    setCurrentSearchResults([])
    if(abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const userMessage = { role: 'user' as const, content: input}
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setCurrentReasoning('')

    //creating new chat section with loading states
    const newSection: ChatSection = {
      query: input,
      searchResults: [],
      reasoning: '',
      response: '',
      error: null,
      isLoadingSources: true,
      isLoadingThinking: false
    }
    setChatSections(prev => [...prev, newSection]);
    const sectionIndex = chatSections.length;

    try {
      const searchResponse = await fetch('/api/tavilly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          query: input,
          includeImages: true,
          includeImagesDescription: true
        }),
        signal: abortControllerRef.current.signal
      })
      const searchData = await searchResponse.json()

      if(!searchResponse.ok) {
        throw new Error(searchData.error || 'Failed to fetch search results');
      }
      if (!searchData.results || searchData.results.length === 0) {
        throw new Error('No relevant search results found. Please try a different query.');
      }
      //combine images with result 
      const resultsWithImages = searchData.results.map((result: SearchResult, index: number) => ({
        ...result,
        image: searchData.images?.[index]
      }));
     //update section with search results and start thinking 
     setChatSections(prev => {
      const updated = [...prev];
      updated[sectionIndex] = {
        ...updated[sectionIndex],
        searchResults: resultsWithImages ,
        isLoadingSources: false,
        isLoadingThinking: true 
      };
      return updated;
     })
     
     //Step 2: Format search results for Deepseek 
     const searchContext = resultsWithImages 
            .map((result: SearchResult, index: number) => 
              `[Source ${index + 1}]: ${result.title}\n${result.content}\nURL: ${result.url}\n`
            )
            .join('\n\n');

    const tavilyAnswer = searchData.answer 
    ? `\nTavily's Direct Answer: ${searchData.answer}\n\n` 
    : '';

    // Add sources table at the end
    const sourcesTable = `\n\n## Sources\n| Number | Source | Description |\n|---------|---------|-------------|\n` +
    resultsWithImages.map((result: SearchResult, index: number) => 
      `| ${index + 1} | [${result.title}](${result.url}) | ${result.snippet || result.content.slice(0, 150)}${result.content.length > 150 ? '...' : ''} |`
    ).join('\n');
    const reasoningInput = `Here is the research data:${tavilyAnswer}\n${searchContext}\n\nPlease analyze this information and create a detailed report addressing the original query: "${input}". Include citations to the sources where appropriate. If the sources contain any potential biases or conflicting information, please note that in your analysis.\n\nIMPORTANT: Always end your response with a sources table listing all references used. Format it exactly as shown below:\n${sourcesTable}`;
   
    let assistantMessage: Message = {
      role: 'assistant',
      content: '',
      reasoning: '',
      searchResults: resultsWithImages,
      fullTavilyData: searchData,
      reasoningInput
    };
    
    //get analysis  from Deepseek 
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ messages: [
        userMessage,
        {
          role: 'assistant' as const,
          content: 'I found some relevant information. Let me analyze it and create a comprehensive report.',
        },
        {
          role: 'user' as const,
          content: reasoningInput,
        },
      ]}),
      signal: abortControllerRef.current.signal
    });
    if (!response.ok) {
      throw new Error('Failed to generate report. Please try again.');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.choices?.[0]?.delta?.reasoning_content) {
            const newReasoning = (assistantMessage.reasoning || '') + parsed.choices[0].delta.reasoning_content;
            assistantMessage.reasoning = newReasoning;
            setCurrentReasoning(newReasoning);
            setChatSections(prev => {
              const updated = [...prev];
              updated[sectionIndex] = {
                ...updated[sectionIndex],
                reasoning: newReasoning,
                isLoadingThinking: false
              };
              return updated;
            });
          } else if (parsed.choices?.[0]?.delta?.content) {
            const newContent = (assistantMessage.content || '') + parsed.choices[0].delta.content;
            assistantMessage.content = newContent;
            setChatSections(prev => {
              const updated = [...prev];
              updated[sectionIndex] = {
                ...updated[sectionIndex],
                response: newContent
              };
              return updated;
            });
          }
        } catch (e) {
          console.error('Error parsing chunk:', e);
        }
      }
    }

    // Update the section with search results
    setChatSections(prev => {
      const updated = [...prev];
      updated[sectionIndex] = {
        ...updated[sectionIndex],
        searchResults: resultsWithImages
      };
      return updated;
    });
    } catch (error : unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        console.error('Error:', error);
        setError(errorMessage);
        setChatSections(prev => {
          const updated = [...prev];
          updated[sectionIndex] = {
            ...updated[sectionIndex],
            error: errorMessage,
            isLoadingSources: false,
            isLoadingThinking: false
          };
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      setSearchStatus('');
      abortControllerRef.current = null;
    }
  }
  const toggleReasoning = (index: number) => {
    setChatSections(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isReasoningCollapsed: !updated[index].isReasoningCollapsed
      };
      return updated;
    });
  };
 return (
<div className='min-h-screen bg-white'>
<TopBar />
<div className='pt-14 pb-24'>
<main className='max-w-3xl mx-auto p-8'>
<AnimatePresence>
  {!hasSubmitted ? (
    <motion.div 
    className='min-h-screen flex flex-col items-center justify-center'
    initial={{ opacity: 1 }}
    exit={{opacity: 0, y:-50}}
    transition={{duration: 0.3}}
    >
      <div className="text-center mb-12">
                  <div className="inline-block px-4 py-1.5 bg-gray-900 text-white rounded-full text-sm font-medium mb-6">
                    
                  </div>
                  <h1 className="text-5xl font-serif text-gray-900 mb-4 tracking-tight">Your Personal Research Assistant</h1>
                  <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto leading-relaxed">
                    Do research for content in seconds, so you can spend more time going viral.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="w-full max-w-[704px] mx-4">
                  <div className="relative bg-gray-50 rounded-xl shadow-md border border-gray-300">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a question..."
                      className="w-full p-5 pr-32 rounded-xl border-2 border-transparent focus:border-gray-900 focus:shadow-lg focus:outline-none resize-none h-[92px] bg-gray-50 transition-all duration-200"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                    />
                    <div className="absolute right-3 bottom-3 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium relative overflow-hidden group"
                      >
                        <span className="relative z-10">{isLoading ? 'Thinking...' : 'Send'}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-white/15 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      </button>
                    </div>
                  </div>
                  

                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          selectedSuggestion === suggestion.label
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </form>
    </motion.div>
  ) : ''}
</AnimatePresence>
</main>
</div>
</div>
 )}
