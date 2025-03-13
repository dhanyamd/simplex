'use client';

import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import remarkGfm from 'remark-gfm'; 
import { Message, SearchResult, ChatSection,SuggestionType, TavilyImage,TavilyResponse } from '@/types/interface';

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
    } catch (error) {
      
    }
  }

}